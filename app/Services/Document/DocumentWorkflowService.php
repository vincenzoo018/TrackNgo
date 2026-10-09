<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\SignatureServiceInterface;
use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\RoutingSlip;
use App\Models\User;
use App\Services\Oic\OicService;
use App\Services\Sms\DocumentSmsNotifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentWorkflowService
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService,
        protected DocumentSmsNotifier $smsNotifier,
        protected DocumentRevisionService $revisionService,
        protected SignatureServiceInterface $signatureService,
        protected OicService $oic,
        protected MayoralActionService $mayoral
    ) {}

    /**
     * Sending the document to $official: while an Officer-in-Charge acts for them (LGC Sec. 46) it goes to the OIC,
     * held for the official. Returns who actually receives it, the holder columns to save, and the note the
     * routing slip carries ("Acting Mayor: X per Designation Order No. Y").
     *
     * @return array{holder: ?User, official: ?User, columns: array<string, int|null>, note: string}
     */
    public function deliveryTo(?User $official, ?int $fallbackDepartmentId = null): array
    {
        $recipient = $this->oic->recipientFor($official);
        $holder = $recipient['holder'];
        $designation = $recipient['designation'];

        return [
            'holder'   => $holder,
            'official' => $official,
            'columns'  => [
                'current_holder_id'            => $holder?->id,
                'current_holder_department_id' => $holder?->department_id ?? $fallbackDepartmentId,
                'held_for_user_id'             => $recipient['held_for']?->id,
            ],
            'note'     => $designation
                ? " {$designation->title()}: {$holder->name} per Designation Order No. {$designation->designation_order_number} (for {$official->name})."
                : '',
        ];
    }

    /** The person whose place $actor takes on this document: the absent official when acting as OIC, else themselves */
    public function actingAs(Document $document, User $actor): User
    {
        return $this->oic->actingFor($document, $actor) ?? $actor;
    }

    /**
     * Resolve target user, department, and role name based on destination type and id.
     */
    public function resolveRecipient(string $type, string|int $id, ?Document $document = null): array
    {
        $targetUserId = null;
        $targetDeptId = null;
        $targetRole = null;
        $recipientName = 'Recipient';

        if ($type === 'user') {
            $user = User::with(['department', 'role'])->find($id);
            if ($user) {
                $targetUserId = $user->id;
                $targetDeptId = $user->department_id;
                $roleName = $user->role?->role_name;
                $recipientName = $user->name . ($roleName ? " ({$roleName})" : '');
                // For direct user dispatch, targetRole is left null so the notification is 1:1 and not broadcast to the whole role
                $targetRole = null;
            }
        } elseif ($type === 'role') {
            $role = is_numeric($id)
                ? \App\Models\Role::find($id)
                : \App\Models\Role::where('role_name', 'like', "%{$id}%")->first();

            $targetRole = $role?->role_name ?? (string) $id;
            
            // Check if document has an associated department with a user matching this role (e.g. Dept Head of specific office)
            $user = null;
            if ($document && ($document->destination_department_id || $document->department_id)) {
                $deptId = $document->destination_department_id ?? $document->department_id;
                $user = User::where('department_id', $deptId)->where('role_id', $role?->role_id)->first();
            }
            if (!$user) {
                $user = User::where('role_id', $role?->role_id)->first();
            }

            if ($user) {
                $targetUserId = $user->id;
                $targetDeptId = $user->department_id;
                $recipientName = "Role: {$targetRole} ({$user->name})";
            } else {
                $recipientName = "Role: {$targetRole}";
            }
        } elseif ($type === 'department') {
            $dept = Department::find($id);
            if ($dept) {
                $targetDeptId = $dept->department_id;
                $recipientName = $dept->department_name;
                
                $deptUser = User::where('department_id', $dept->department_id)
                    ->whereHas('role', fn($q) => $q->whereIn('role_name', ['Department Head', 'Mayor', 'Receiving Clerk', 'HR']))
                    ->first() ?? User::where('department_id', $dept->department_id)->first();
                    
                if ($deptUser) {
                    $targetUserId = $deptUser->id;
                }
            }
        }

        return [
            'user_id'         => $targetUserId,
            'department_id'   => $targetDeptId,
            'role_name'       => $targetRole,
            'display_name'    => $recipientName,
        ];
    }

    public function register(Document $document, array $params, User $actor, ?string $ip = null): Document
    {
        $trackingNumber = $document->tracking_number;
        if (empty($trackingNumber) || str_starts_with($trackingNumber, 'PENDING-')) {
            $numberGenerator = app(\App\Services\Document\DocumentNumberGenerator::class);
            $trackingNumber = $numberGenerator->generateTrackingNumber();
        }

        $targetDeptId = $document->destination_department_id ?? $document->department_id;
        if (!$targetDeptId && !empty($params['target_department_id'])) {
            $targetDeptId = (int) $params['target_department_id'];
        }

        // The clerk only registers: the document goes to the person the sender chose when filing it
        $targetUserId = $document->destination_user_id
            ?: (!empty($params['to_user_id']) ? (int) $params['to_user_id'] : null);
        if (!$targetUserId && $targetDeptId) {
            // e.g. the HR office has an HR Manager but no "Department Head"
            $targetUserId = $this->resolveOfficeHead((int) $targetDeptId, $document->submitted_by)?->id;
        }
        $targetUser = $targetUserId ? User::with('role')->find($targetUserId) : null;
        if ($targetUser?->department_id) {
            $targetDeptId = $targetUser->department_id;
        }
        // The Acting Mayor / OIC receives it while the addressee is away
        $delivery = $this->deliveryTo($targetUser, $targetDeptId ? (int) $targetDeptId : null);
        $targetUserId = $delivery['holder']?->id ?? $targetUserId;
        $targetDeptId = $delivery['columns']['current_holder_department_id'] ?? $targetDeptId;

        $stepIndex = 2;
        $newStatus = 'registered';

        // Carry the sender's instructions to the recipient
        $senderInstruction = RoutingSlip::where('document_id', $document->document_id)->orderBy('slip_id')->value('instruction');
        if ($senderInstruction === DocumentService::REGISTRATION_INSTRUCTION) {
            $senderInstruction = null;
        }

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $trackingNumber,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $actor->department_id ?? $document->current_holder_department_id,
            'to_user_id'           => $targetUserId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'register',
            'instruction'          => ($params['instruction'] ?? $senderInstruction ?? 'Document officially registered and routed for processing.') . $delivery['note'],
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        $document->update([
            'tracking_number'              => $trackingNumber,
            'status'                       => $newStatus,
            'current_holder_department_id' => $targetDeptId,
            'current_holder_id'            => $targetUserId,
            'held_for_user_id'             => $delivery['columns']['held_for_user_id'],
            'current_step_index'           => $stepIndex,
        ]);
        $this->mayoral->markReceived($document, $targetUser, $actor);

        $holder = $delivery['holder'] ?? $targetUser;
        $destName = $targetDeptId ? Department::find($targetDeptId)?->department_name : 'Destination Department';
        if ($holder) {
            $destName = "{$holder->name} ({$destName})" . ($delivery['columns']['held_for_user_id'] ? " for {$targetUser->name}" : '');
        }
        $targetUser = $holder;

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Register',
            description: "Document officially registered by {$actor->name} with Tracking No. {$trackingNumber} and routed to {$destName}.",
            actor: $actor,
            ipAddress: $ip
        );

        // Notify the assigned holder directly; with no assignee, notify the destination office (never every Dept Head)
        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $targetUserId,
            targetDeptId: $targetDeptId,
            targetRole: $targetUser?->role?->role_name,
            sender: $actor
        );

        return $document;
    }

    /**
     * The person who receives documents for an office: its Department Head, or the equivalent
     * head for offices without one (HR Manager, Mayor), otherwise any active non-clerk staff.
     * The sender is skipped so a document addressed to their own office never comes back to them.
     */
    public function resolveOfficeHead(int $departmentId, ?int $excludeUserId = null): ?User
    {
        $staff = User::with('role')
            ->where('department_id', $departmentId)
            ->where('is_active', true)
            ->when($excludeUserId, fn ($q) => $q->where('id', '!=', $excludeUserId))
            ->get();

        foreach (['Department Head', 'HR', 'Mayor'] as $roleName) {
            if ($head = $staff->first(fn (User $u) => $u->role?->role_name === $roleName)) {
                return $head;
            }
        }

        return $staff->first(fn (User $u) => !in_array($u->role?->role_name, ['Receiving Clerk', 'Admin'], true));
    }

    /**
     * FSM step map (current_step_index is the source of truth rendered by StepProgress):
     *  External (7):        1 Submitted (Clerk) → 2 Accepted (Dept Head) → 3 Reviewed (Dept Head) → 4 Forwarded (Dept Head → Mayor)
     *                       → 5 Accepted (Mayor) → 6 Reviewed (Mayor) → 7 Forwarded to Receiving Clerk → Released
     *  Internal Dept (6):   1 Submitted (Dept Head) → 2 Registered (Clerk) → 3 Reviewed (Dept Head) → 4 Forwarded (Dept Head → Mayor)
     *                       → 5 Accepted (Mayor) → 6 Reviewed (Mayor) → Forward to Receiving Clerk → Released
     *  Internal Mayor (6):  1 Submitted (Mayor) → 2 Registered (Clerk) → 3 Reviewed (Dept Head) → 4 Forwarded (Dept Head → next)
     *                       → 5 Accepted (Dept Head) → 6 Reviewed (Dept) → Forward to Receiving Clerk → Released
     */
    public function accept(Document $document, User $actor, ?string $ip = null): Document
    {
        $current = (int) $document->current_step_index;
        if ($current >= 4) {
            // Second-stage receiver (Mayor, or next Dept Head for mayor-origin) accepts the forwarded document
            $stepIndex = max($current, 5);
        } elseif ($document->is_internal) {
            // Internal docs are already at "Registered"; acceptance by the Dept Head does not skip Review
            $stepIndex = max($current, 2);
        } else {
            $stepIndex = 2;
        }

        $document->update([
            'status'                       => 'Accepted',
            'current_holder_id'            => $actor->id,
            'current_holder_department_id' => $actor->department_id ?? $document->current_holder_department_id,
            'current_step_index'           => $stepIndex,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Accepted',
            description: "Document officially received and accepted by {$actor->name}.",
            actor: $actor,
            ipAddress: $ip
        );

        if ($document->submitted_by && $document->submitted_by !== $actor->id) {
            \App\Services\NotificationService::triggerDocumentReceiptNotification(
                document: $document,
                targetUserId: $document->submitted_by,
                sender: $actor
            );
        }

        return $document;
    }

    public function review(Document $document, User $actor, ?string $ip = null): Document
    {
        $stepIndex = (int) $document->current_step_index >= 4 ? 6 : 3;

        $document->update([
            'status'             => 'Ongoing',
            'current_step_index' => $stepIndex,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Review',
            description: "Document has been reviewed and marked as ongoing by {$actor->name}.",
            actor: $actor,
            ipAddress: $ip
        );

        return $document;
    }

    public function endorse(Document $document, array $params, User $actor, ?string $ip = null): Document
    {
        $destType = $params['destination_type'] ?? 'department';
        $destinationId = $params['destination_id'];
        $remarks = $params['remarks'] ?? null;

        $recipient = $this->resolveRecipient($destType, $destinationId, $document);
        $targetUserId = $recipient['user_id'];
        $targetDeptId = $recipient['department_id'];
        $targetRole = $recipient['role_name'];
        $destName = $recipient['display_name'];
        $actingFor = $this->oic->actingFor($document, $actor);
        // The Acting Mayor / OIC receives it while the addressee is away
        $official = $targetUserId ? User::find($targetUserId) : null;
        $delivery = $this->deliveryTo($official, $targetDeptId ? (int) $targetDeptId : null);
        if ($delivery['columns']['held_for_user_id']) {
            $targetUserId = $delivery['holder']->id;
            $targetDeptId = $delivery['columns']['current_holder_department_id'];
        }

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $targetUserId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'endorse',
            'instruction'          => trim(($remarks ?? '') . $delivery['note']) ?: null,
            'status'               => 'pending',
            'date_received'        => now(),
            'acting_for_user_id'   => $actingFor?->id,
        ]);

        // Forwarding moves the doc to step 4; a later re-endorsement never rewinds the FSM
        $stepIndex = max((int) $document->current_step_index, 4);

        $document->update([
            'status'                       => 'Sent',
            'current_holder_department_id' => $targetDeptId,
            'current_holder_id'            => $targetUserId,
            'held_for_user_id'             => $delivery['columns']['held_for_user_id'],
            'current_step_index'           => $stepIndex,
        ]);
        $this->mayoral->markReceived($document, $official, $actor);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Endorse',
            description: "Document endorsed to {$destName}" . ($remarks ? ": {$remarks}" : ''),
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: ($destType === 'role' ? null : $targetUserId),
            targetDeptId: $targetDeptId,
            targetRole: $targetRole,
            sender: $actor
        );

        return $document;
    }

    public function escalate(Document $document, string $justification, User $actor, ?string $ip = null): Document
    {
        $document->update([
            'is_escalated' => true,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'escalated',
            description: "Document escalated to CART. Justification: {$justification}",
            actor: $actor,
            ipAddress: $ip
        );

        return $document;
    }

    public function link(Document $document, string $trackingNumber, User $actor, ?string $ip = null): Document
    {
        $linkedDoc = Document::where('tracking_number', $trackingNumber)->firstOrFail();

        $document->update([
            'linked_document_id' => $linkedDoc->document_id,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'linked',
            description: "Document linked to tracking number {$trackingNumber}",
            actor: $actor,
            ipAddress: $ip
        );

        return $document;
    }

    /**
     * Route-based documents: the holder approves (their signature is stamped beforehand when their stop signs,
     * see DocumentService) and the document goes to the next person on the route without anyone choosing.
     * After the last person it goes to the Receiving Clerk for release (external) or is completed and returned
     * to the sender (internal).
     */
    public function approveOnRoute(Document $document, User $actor, ?string $ip = null): Document
    {
        $route = app(DocumentRoute::class);
        if (strtolower((string) $document->status) === 'returned') {
            throw ValidationException::withMessages(['route' => 'This document was returned. Upload the correction (or return it further back) instead.']);
        }
        // An Officer-in-Charge approves the absent official's stop (LGC Sec. 46)
        $actingFor = $this->oic->actingFor($document, $actor);
        $actingAs = $actingFor ?? $actor;
        if (!$route->isOnRoute($document, $actingAs) && !$actor->hasRole('Admin')) {
            throw ValidationException::withMessages(['route' => 'Only the people on this document\'s route can approve it.']);
        }

        // Someone who already approved may hold it again after a correction; their stop stays approved
        $route->pendingStopFor($document, $actingAs)?->update(['approved_at' => now()]);
        $this->mayoral->recordSigned($document, $actor, $actingAs, $this->oic->designationFor($document, $actor));

        $next = $route->nextStop($document);
        if (!$next) {
            return $this->approveAndRouteToReceiving($document, $actor, $ip);
        }

        $nextUser = $next->user;
        $delivery = $this->deliveryTo($nextUser, $document->current_holder_department_id);
        $holder = $delivery['holder'];
        $nextDeptId = $delivery['columns']['current_holder_department_id'];
        $task = $next->signs ? 'signature' : 'approval';

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number ?: ('PENDING-' . $document->reference_number),
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $holder?->id,
            'target_department_id' => $nextDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'route',
            'instruction'          => "Approved by {$actor->name}. For your {$task}." . $delivery['note'],
            'status'               => 'pending',
            'date_received'        => now(),
            'acting_for_user_id'   => $actingFor?->id,
        ]);

        $document->update(['status' => 'Sent'] + $delivery['columns']);
        $this->mayoral->markReceived($document, $nextUser, $actor);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Approve',
            description: "Approved by {$actor->name} and sent to " . ($holder?->name ?? 'the next office')
                . ($delivery['columns']['held_for_user_id'] ? " (Officer-in-Charge for {$nextUser->name})" : '')
                . " for {$task} (stop {$next->position} of the route).",
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $holder?->id,
            targetDeptId: $nextDeptId,
            targetRole: $holder?->role?->role_name,
            sender: $actor
        );

        return $document;
    }

    public function approveAndRouteToReceiving(Document $document, User $actor, ?string $ip = null): Document
    {
        // Internal documents need no release at the counter: the final approval completes them
        if ($document->is_internal) {
            return $this->completeInternal($document, $actor, $ip);
        }

        $clerkUser = User::where('is_active', true)->whereHas('role', fn($q) => $q->where('role_name', 'Receiving Clerk'))->first();
        $destDeptId = $clerkUser?->department_id ?? 2;
        $destUserId = $clerkUser?->id ?? 5;
        $actingFor = $this->oic->actingFor($document, $actor);
        $this->mayoral->recordSigned($document, $actor, $actingFor ?? $actor, $this->oic->designationFor($document, $actor));

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $destUserId,
            'target_department_id' => $destDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'forward',
            'instruction'          => "Approved by {$actor->name}. For final release to applicant.",
            'status'               => 'pending',
            'date_received'        => now(),
            'acting_for_user_id'   => $actingFor?->id,
        ]);

        // External: step 7 "Forwarded to Receiving Clerk", completed when the clerk releases it to the applicant
        $document->update([
            'status'                       => 'approved',
            'current_holder_department_id' => $destDeptId,
            'current_holder_id'            => $destUserId,
            'held_for_user_id'             => null,
            'current_step_index'           => 7,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Approve',
            description: 'Document approved and routed to Receiving Clerk for release.',
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $destUserId,
            targetDeptId: $destDeptId,
            targetRole: 'Receiving Clerk',
            sender: $actor
        );

        $this->smsNotifier->readyForPickup($document);

        return $document;
    }

    /**
     * Final approval of an internal document (the Mayor, or the last reviewing office when the Mayor filed it):
     * it is completed on the spot and the finished document — with every signature stamped — goes back to the
     * sender. The Receiving Clerk keeps the record (registration and trail) but has nothing to release.
     */
    protected function completeInternal(Document $document, User $actor, ?string $ip = null): Document
    {
        $sender = $document->submitted_by ? User::find($document->submitted_by) : null;
        $actingFor = $this->oic->actingFor($document, $actor);
        $this->mayoral->recordSigned($document, $actor, $actingFor ?? $actor, $this->oic->designationFor($document, $actor));

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number ?: ('PENDING-' . $document->reference_number),
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $sender?->id,
            'target_department_id' => $sender?->department_id ?? $document->department_id,
            'sender_name'          => $actor->name,
            'action'               => 'approve',
            'instruction'          => "Approved by {$actor->name}. The completed document is returned to the sender.",
            'status'               => 'completed',
            'date_received'        => now(),
            'acting_for_user_id'   => $actingFor?->id,
        ]);

        $document->update([
            'status'                       => 'completed',
            'completed_at'                 => now(),
            'current_holder_id'            => null,
            'current_holder_department_id' => null,
            'held_for_user_id'             => null,
            'current_step_index'           => $document->total_steps ?: 6,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Approve',
            description: "Final approval given by {$actor->name}.",
            actor: $actor,
            ipAddress: $ip
        );

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Completed',
            description: 'Internal document completed and returned to ' . ($sender?->name ?? 'the sender')
                . ' automatically after the final approval (no release by the Receiving Clerk needed).',
            actor: $actor,
            ipAddress: $ip
        );

        if ($sender && (int) $sender->id !== (int) $actor->id) {
            \App\Services\NotificationService::triggerDocumentReceiptNotification(
                document: $document,
                targetUserId: $sender->id,
                targetDeptId: $sender->department_id,
                sender: $actor,
                title: 'Document Approved & Completed'
            );
            $this->smsNotifier->documentCompleted($document, $sender);
        }

        return $document;
    }

    public function releaseToApplicant(Document $document, User $actor, ?string $ip = null): Document
    {
        $stepIndex = $document->total_steps ?: ($document->is_internal ? 6 : 7);
        $document->update([
            'status'                       => 'completed',
            'completed_at'                 => now(),
            'current_holder_id'            => null,
            'current_holder_department_id' => null,
            'held_for_user_id'             => null,
            'current_step_index'           => $stepIndex,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Release',
            description: $document->isDeemedApproved()
                ? "Deemed-approved document ({$document->deemed_approval_basis}) released to the applicant and marked as completed."
                : 'Document officially released to applicant and marked as completed.',
            actor: $actor,
            ipAddress: $ip
        );

        $this->smsNotifier->documentReleased($document);

        return $document;
    }

    public function archive(Document $document, User $actor, ?string $ip = null): Document
    {
        $document->update([
            'status'       => 'archived',
            'completed_at' => $document->completed_at ?? now(),
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Archive',
            description: "Document moved to Central Archive Repository by {$actor->name}",
            actor: $actor,
            ipAddress: $ip
        );

        return $document;
    }

    /**
     * One step back: whoever passed the document to the actor (forward / endorse / correction). A clerk's
     * registration is skipped — the clerk only records internal documents — so those go back to the sender.
     */
    /** Slips that move a document without anyone passing it on (OIC hand-over, deemed approval) */
    public const SYSTEM_SLIP_ACTIONS = ['oic', 'deemed_approved'];

    public function previousHolderId(Document $document, User $actor): ?int
    {
        // An Officer-in-Charge returns it to whoever passed it to the official they act for
        $recipients = array_filter([$actor->id, $this->oic->actingFor($document, $actor)?->id]);
        $inbound = RoutingSlip::where('document_id', $document->document_id)
            ->whereIn('to_user_id', $recipients)
            ->whereNotIn('action', ['return', 'veto', ...self::SYSTEM_SLIP_ACTIONS])
            ->orderByDesc('slip_id')
            ->first();

        // A slip sent by an OIC came from the official's place on the route
        $previous = $inbound && $inbound->action !== 'register'
            ? ($inbound->acting_for_user_id ?? $inbound->from_user_id)
            : $document->submitted_by;

        return $previous ? (int) $previous : null;
    }

    public function returnDocument(Document $document, string $reason, User $actor, ?string $ip = null): Document
    {
        if ($document->isDeemedApproved()) {
            throw ValidationException::withMessages(['reason' => 'This document is deemed approved by law and can no longer be returned. Release it to the applicant.']);
        }
        $actingFor = $this->oic->actingFor($document, $actor);
        $targetHolderId = $this->previousHolderId($document, $actor) ?? $document->current_holder_id;
        if ((int) $targetHolderId === (int) $actor->id || ($actingFor && (int) $targetHolderId === (int) $actingFor->id)) {
            throw ValidationException::withMessages(['reason' => 'This document started with you, so there is no one to return it to.']);
        }
        $official = $targetHolderId ? User::find($targetHolderId) : null;
        // The returning office, captured before the holder changes (used to route the correction back)
        $fromDeptId = $document->current_holder_department_id ?? $actor->department_id;
        // Returned to someone who is away: their Officer-in-Charge receives it
        $delivery = $this->deliveryTo($official, $official?->department_id ?? $document->department_id);
        $targetHolder = $delivery['holder'];
        $targetHolderId = $targetHolder?->id ?? $targetHolderId;
        $targetDeptId = $delivery['columns']['current_holder_department_id'];

        $document->update([
            'status'        => 'Returned',
            'return_reason' => $reason,
        ] + $delivery['columns']);

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number ?: ('RS-RET-' . $document->reference_number),
            'from_user_id'         => $actor->id,
            'from_department_id'   => $fromDeptId,
            'to_user_id'           => $targetHolderId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'return',
            'instruction'          => "Returned: {$reason}" . $delivery['note'],
            'status'               => 'returned',
            'date_received'        => now(),
            'acting_for_user_id'   => $actingFor?->id,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Return',
            description: 'Document returned for revision' . ($targetHolder ? " to {$targetHolder->name}" : '')
                . ($delivery['columns']['held_for_user_id'] ? " (Officer-in-Charge for {$official->name})" : '') . ". Reason: {$reason}",
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $targetHolderId,
            targetDeptId: $targetDeptId,
            targetRole: $targetHolder?->role?->role_name,
            sender: $actor
        );

        return $document;
    }

    /**
     * A returned document is corrected by its holder and goes back to whoever returned it, at the step where
     * they accept it again. The correction is either supporting files, kept as attachments next to the main
     * file, or a corrected main file ($mainFile), stored as a new version while the earlier versions are kept.
     * A signatory whose signature was on the earlier version signs the new one as they send it back.
     *
     * @param  \Illuminate\Http\UploadedFile[]  $files
     */
    public function resubmit(Document $document, array $files, ?string $note, User $actor, ?string $ip = null, ?UploadedFile $mainFile = null, ?string $ocrText = null): Document
    {
        if (strtolower((string) $document->status) !== 'returned') {
            throw ValidationException::withMessages(['files' => 'Only a returned document can be corrected and resubmitted.']);
        }
        if (!$mainFile && $files === []) {
            throw ValidationException::withMessages(['files' => 'Attach the corrected file or at least one supporting file.']);
        }

        // Back to whoever returned it; an Officer-in-Charge returned it from the official's place, so it goes back to
        // that place (the OIC again while the designation lasts, otherwise the official)
        $returnSlip = RoutingSlip::where('document_id', $document->document_id)
            ->where('action', 'return')
            ->orderByDesc('slip_id')
            ->first();
        $returnerId = $returnSlip
            ? ($returnSlip->acting_for_user_id ?? $returnSlip->from_user_id)
            : AuditTrail::where('document_id', $document->document_id)
                ->where('action', 'Return')
                ->orderByDesc('audit_id')
                ->value('user_id');
        $official = $returnerId ? User::with('role')->find($returnerId) : null;

        if (!$official) {
            throw ValidationException::withMessages(['files' => 'The office that returned this document could not be determined.']);
        }
        $delivery = $this->deliveryTo($official, $official->department_id);
        $returner = $delivery['holder'];
        $actingFor = $this->oic->actingFor($document, $actor);
        $actingAs = $actingFor ?? $actor;

        $note = $note !== null && trim($note) !== '' ? trim($note) : null;
        $returnedAt = (int) $document->current_step_index;
        // Back to the returner's acceptance point: Mayor stage (4 → accept 5), internal registered (≤2), external submitted (1)
        $stepIndex = $returnedAt >= 4 ? 4 : ($document->is_internal ? min(max($returnedAt, 1), 2) : 1);
        $version = preg_match('/^v?(\d+)\.(\d+)$/', (string) ($document->version ?: 'v1.0'), $m)
            ? 'v' . $m[1] . '.' . ((int) $m[2] + 1)
            : 'v1.1';

        $storedPaths = [];

        try {
            DB::transaction(function () use ($document, $files, $note, $actor, $ip, $returner, $stepIndex, $version, $mainFile, $ocrText, $delivery, $actingFor, $actingAs, &$storedPaths) {
                $fileNames = [];
                $revision = null;
                if ($mainFile) {
                    $signedEarlierVersion = $document->signatories()->where('user_id', $actingAs->id)->whereNotNull('signed_at')->exists();
                    $revision = $this->revisionService->create(
                        $document, $mainFile, $note ?? 'Correction for: ' . ($document->return_reason ?: 'returned document'), $actor, $ip, $ocrText
                    );
                    $storedPaths[] = $revision->file_path;
                    $fileNames[] = "Version {$revision->version_number}: {$revision->file_name}";
                    $version = "v{$revision->version_number}.0";

                    // Sending the corrected file on is their approval of it: they sign the new version now
                    if ($signedEarlierVersion) {
                        $this->signatureService->stampIfDue($document, $actor, $ip);
                        app(DocumentRoute::class)->pendingStopFor($document, $actingAs)?->update(['approved_at' => now()]);
                    }
                }

                foreach ($files as $file) {
                    $path = $file->store('attachments', Document::FILE_DISK);
                    $storedPaths[] = $path;
                    $fileNames[] = $file->getClientOriginalName();

                    DocumentAttachment::create([
                        'document_id' => $document->document_id,
                        'user_id'     => $actor->id,
                        'file_name'   => $file->getClientOriginalName(),
                        'file_path'   => $path,
                        'file_size'   => $file->getSize(),
                        'file_type'   => $file->getClientMimeType(),
                        'reason'      => $note ?? 'Correction for: ' . ($document->return_reason ?: 'returned document'),
                    ]);
                }

                RoutingSlip::create([
                    'document_id'          => $document->document_id,
                    'tracking_number'      => $document->tracking_number ?: ('RS-RET-' . $document->reference_number),
                    'from_user_id'         => $actor->id,
                    'from_department_id'   => $actor->department_id ?? $document->current_holder_department_id,
                    'to_user_id'           => $returner->id,
                    'target_department_id' => $delivery['columns']['current_holder_department_id'],
                    'sender_name'          => $actor->name,
                    'action'               => 'resubmit',
                    'instruction'          => 'Corrected and resubmitted' . ($revision ? " as Version {$revision->version_number}" : '') . ($note ? ": {$note}" : '.') . $delivery['note'],
                    'status'               => 'pending',
                    'date_received'        => now(),
                    'acting_for_user_id'   => $actingFor?->id,
                ]);

                $document->update([
                    'status'             => 'Sent',
                    'return_reason'      => null,
                    'current_step_index' => $stepIndex,
                    'version'            => $version,
                ] + $delivery['columns']);

                $this->auditTrailService->logDocumentAction(
                    document: $document,
                    action: 'Resubmitted',
                    description: 'Correction submitted (' . implode(', ', $fileNames) . ") and sent back to {$returner->name}." . ($note ? " Note: {$note}" : ''),
                    actor: $actor,
                    ipAddress: $ip
                );
            });
        } catch (\Throwable $e) {
            foreach ($storedPaths as $path) {
                Storage::disk(Document::FILE_DISK)->delete($path);
            }
            throw $e;
        }

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $returner->id,
            targetDeptId: $returner->department_id,
            targetRole: $returner->role?->role_name,
            sender: $actor
        );

        return $document;
    }

    /**
     * LGC Sec. 54: the Mayor (or the Acting Mayor) vetoes an ordinance / resolution, stating the reasons. It is
     * closed as "Vetoed" and goes back to whoever filed it with the veto message.
     */
    public function veto(Document $document, string $reasons, User $actor, ?string $ip = null): Document
    {
        $document->loadMissing(['type', 'submitter']);
        $actingFor = $this->oic->actingFor($document, $actor);
        $designation = $this->oic->designationFor($document, $actor);

        if (!$document->requiresMayoralAction()) {
            throw ValidationException::withMessages(['reasons' => 'Only ordinances and resolutions can be vetoed.']);
        }
        if (!MayoralActionService::isMayor($actingFor ?? $actor)) {
            throw new \Illuminate\Auth\Access\AuthorizationException('Only the City Mayor, or the Acting Mayor while one is designated, can veto an ordinance or resolution.');
        }
        if ($document->isClosed() || $document->isDeemedApproved()) {
            throw ValidationException::withMessages(['reasons' => 'This document is already closed or deemed approved.']);
        }
        if ($this->mayoral->finalAction($document)) {
            throw ValidationException::withMessages(['reasons' => 'The Mayor has already acted on this document.']);
        }
        if (strtolower((string) $document->status) === 'returned') {
            throw ValidationException::withMessages(['reasons' => 'This document was returned for correction. Wait for it to come back before acting on it.']);
        }

        $filer = $document->submitter;

        DB::transaction(function () use ($document, $reasons, $actor, $ip, $actingFor, $designation, $filer) {
            $this->mayoral->recordVeto($document, $reasons, $actor, $designation);

            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => $document->tracking_number ?: ('PENDING-' . $document->reference_number),
                'from_user_id'         => $actor->id,
                'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
                'to_user_id'           => $filer?->id,
                'target_department_id' => $filer?->department_id ?? $document->department_id,
                'sender_name'          => $actor->name,
                'action'               => 'veto',
                'instruction'          => "Vetoed by {$actor->name} (LGC Sec. 54). Reasons: {$reasons}",
                'status'               => 'vetoed',
                'date_received'        => now(),
                'acting_for_user_id'   => $actingFor?->id,
            ]);

            $document->update([
                'status'                       => Document::STATUS_VETOED,
                'completed_at'                 => now(),
                'current_holder_id'            => null,
                'current_holder_department_id' => null,
                'held_for_user_id'             => null,
            ]);

            $this->auditTrailService->logDocumentAction(
                document: $document,
                action: 'Vetoed',
                description: "Vetoed by {$actor->name} under LGC Sec. 54 and returned to " . ($filer?->name ?? 'the filer') . ". Reasons: {$reasons}",
                actor: $actor,
                ipAddress: $ip
            );
        });

        if ($filer && (int) $filer->id !== (int) $actor->id) {
            \App\Services\NotificationService::triggerDocumentReceiptNotification(
                document: $document,
                targetUserId: $filer->id,
                targetDeptId: $filer->department_id,
                sender: $actor,
                title: 'Document Vetoed by the Mayor'
            );
        }

        return $document;
    }

    public function forward(Document $document, array $params, User $actor, ?string $ip = null): Document
    {
        $destDeptId = $params['forward_to_department'];
        $destUserId = $params['forward_to_user'] ?? null;
        $instruction = $params['instruction'] ?? null;

        if (!$destUserId && $destDeptId) {
            $destUserId = $this->resolveOfficeHead((int) $destDeptId)?->id;
        }
        $actingFor = $this->oic->actingFor($document, $actor);
        $official = $destUserId ? User::find($destUserId) : null;
        $delivery = $this->deliveryTo($official, (int) $destDeptId);
        $destUserId = $delivery['holder']?->id ?? $destUserId;

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $destUserId,
            'target_department_id' => $destDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'forward',
            'instruction'          => trim(($instruction ?? '') . $delivery['note']) ?: null,
            'status'               => 'pending',
            'date_received'        => now(),
            'acting_for_user_id'   => $actingFor?->id,
        ]);

        $document->update([
            'current_holder_department_id' => $delivery['columns']['held_for_user_id'] ? $delivery['columns']['current_holder_department_id'] : $destDeptId,
            'current_holder_id'            => $destUserId,
            'held_for_user_id'             => $delivery['columns']['held_for_user_id'],
            'status'                       => 'Ongoing',
            'current_step_index'           => max((int) $document->current_step_index, 4),
        ]);
        $this->mayoral->markReceived($document, $official, $actor);

        $deptName = Department::find($destDeptId)?->department_name ?? 'destination';
        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Forward',
            description: "Document forwarded to {$deptName}" . ($instruction ? ": {$instruction}" : ''),
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $destUserId,
            targetDeptId: $destDeptId,
            targetRole: 'Department Head',
            sender: $actor
        );

        return $document;
    }
}

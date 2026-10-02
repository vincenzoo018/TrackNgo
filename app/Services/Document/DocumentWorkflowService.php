<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\RoutingSlip;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentWorkflowService
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

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
            'instruction'          => $params['instruction'] ?? $senderInstruction ?? 'Document officially registered and routed for processing.',
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        $document->update([
            'tracking_number'              => $trackingNumber,
            'status'                       => $newStatus,
            'current_holder_department_id' => $targetDeptId,
            'current_holder_id'            => $targetUserId,
            'current_step_index'           => $stepIndex,
        ]);

        $destName = $targetDeptId ? Department::find($targetDeptId)?->department_name : 'Destination Department';
        if ($targetUser) {
            $destName = "{$targetUser->name} ({$destName})";
        }

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

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $targetUserId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'endorse',
            'instruction'          => $remarks,
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        // Forwarding moves the doc to step 4; a later re-endorsement never rewinds the FSM
        $stepIndex = max((int) $document->current_step_index, 4);

        $document->update([
            'status'                       => 'Sent',
            'current_holder_department_id' => $targetDeptId,
            'current_holder_id'            => $targetUserId,
            'current_step_index'           => $stepIndex,
        ]);

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

    public function approveAndRouteToReceiving(Document $document, User $actor, ?string $ip = null): Document
    {
        // Internal documents need no release at the counter: the final approval completes them
        if ($document->is_internal) {
            return $this->completeInternal($document, $actor, $ip);
        }

        $clerkUser = User::whereHas('role', fn($q) => $q->where('role_name', 'Receiving Clerk'))->first();
        $destDeptId = $clerkUser?->department_id ?? 2;
        $destUserId = $clerkUser?->id ?? 5;

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $destUserId,
            'target_department_id' => $destDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'forward',
            'instruction'          => 'Approved by Mayor. For final release to applicant.',
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        // External: step 7 "Forwarded to Receiving Clerk", completed when the clerk releases it to the applicant
        $document->update([
            'status'                       => 'approved',
            'current_holder_department_id' => $destDeptId,
            'current_holder_id'            => $destUserId,
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
        ]);

        $document->update([
            'status'                       => 'completed',
            'completed_at'                 => now(),
            'current_holder_id'            => null,
            'current_holder_department_id' => null,
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
            'current_step_index'           => $stepIndex,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Release',
            description: 'Document officially released to applicant and marked as completed.',
            actor: $actor,
            ipAddress: $ip
        );

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
    public function previousHolderId(Document $document, User $actor): ?int
    {
        $inbound = RoutingSlip::where('document_id', $document->document_id)
            ->where('to_user_id', $actor->id)
            ->where('action', '!=', 'return')
            ->orderByDesc('slip_id')
            ->first();

        $previous = $inbound && $inbound->action !== 'register' ? $inbound->from_user_id : $document->submitted_by;

        return $previous ? (int) $previous : null;
    }

    public function returnDocument(Document $document, string $reason, User $actor, ?string $ip = null): Document
    {
        $targetHolderId = $this->previousHolderId($document, $actor) ?? $document->current_holder_id;
        if ((int) $targetHolderId === (int) $actor->id) {
            throw ValidationException::withMessages(['reason' => 'This document started with you, so there is no one to return it to.']);
        }
        $targetHolder = $targetHolderId ? User::find($targetHolderId) : null;
        $targetDeptId = $targetHolder?->department_id ?? $document->department_id;
        // The returning office, captured before the holder changes (used to route the correction back)
        $fromDeptId = $document->current_holder_department_id ?? $actor->department_id;

        $document->update([
            'status'                       => 'Returned',
            'return_reason'                => $reason,
            'current_holder_id'            => $targetHolderId,
            'current_holder_department_id' => $targetDeptId,
        ]);

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number ?: ('RS-RET-' . $document->reference_number),
            'from_user_id'         => $actor->id,
            'from_department_id'   => $fromDeptId,
            'to_user_id'           => $targetHolderId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'return',
            'instruction'          => "Returned: {$reason}",
            'status'               => 'returned',
            'date_received'        => now(),
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Return',
            description: 'Document returned for revision' . ($targetHolder ? " to {$targetHolder->name}" : '') . ". Reason: {$reason}",
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
     * A returned document is corrected by its holder: the uploaded files are kept as attachments (the
     * original stays the main file) and the document goes back to whoever returned it, at the step where
     * they accept it again.
     *
     * @param  \Illuminate\Http\UploadedFile[]  $files
     */
    public function resubmit(Document $document, array $files, ?string $note, User $actor, ?string $ip = null): Document
    {
        if (strtolower((string) $document->status) !== 'returned') {
            throw ValidationException::withMessages(['files' => 'Only a returned document can be corrected and resubmitted.']);
        }

        $returnerId = RoutingSlip::where('document_id', $document->document_id)
            ->where('action', 'return')
            ->orderByDesc('slip_id')
            ->value('from_user_id')
            ?? AuditTrail::where('document_id', $document->document_id)
                ->where('action', 'Return')
                ->orderByDesc('audit_id')
                ->value('user_id');
        $returner = $returnerId ? User::with('role')->find($returnerId) : null;

        if (!$returner) {
            throw ValidationException::withMessages(['files' => 'The office that returned this document could not be determined.']);
        }

        $note = $note !== null && trim($note) !== '' ? trim($note) : null;
        $returnedAt = (int) $document->current_step_index;
        // Back to the returner's acceptance point: Mayor stage (4 → accept 5), internal registered (≤2), external submitted (1)
        $stepIndex = $returnedAt >= 4 ? 4 : ($document->is_internal ? min(max($returnedAt, 1), 2) : 1);
        $version = preg_match('/^v?(\d+)\.(\d+)$/', (string) ($document->version ?: 'v1.0'), $m)
            ? 'v' . $m[1] . '.' . ((int) $m[2] + 1)
            : 'v1.1';

        $storedPaths = [];

        try {
            DB::transaction(function () use ($document, $files, $note, $actor, $ip, $returner, $stepIndex, $version, &$storedPaths) {
                $fileNames = [];
                foreach ($files as $file) {
                    $path = $file->store('attachments', 'public');
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
                    'target_department_id' => $returner->department_id,
                    'sender_name'          => $actor->name,
                    'action'               => 'resubmit',
                    'instruction'          => 'Corrected and resubmitted' . ($note ? ": {$note}" : '.'),
                    'status'               => 'pending',
                    'date_received'        => now(),
                ]);

                $document->update([
                    'status'                       => 'Sent',
                    'return_reason'                => null,
                    'current_holder_id'            => $returner->id,
                    'current_holder_department_id' => $returner->department_id,
                    'current_step_index'           => $stepIndex,
                    'version'                      => $version,
                ]);

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
                Storage::disk('public')->delete($path);
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

    public function forward(Document $document, array $params, User $actor, ?string $ip = null): Document
    {
        $destDeptId = $params['forward_to_department'];
        $destUserId = $params['forward_to_user'] ?? null;
        $instruction = $params['instruction'] ?? null;

        if (!$destUserId && $destDeptId) {
            $destUserId = $this->resolveOfficeHead((int) $destDeptId)?->id;
        }

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
            'to_user_id'           => $destUserId,
            'target_department_id' => $destDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'forward',
            'instruction'          => $instruction,
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        $document->update([
            'current_holder_department_id' => $destDeptId,
            'current_holder_id'            => $destUserId,
            'status'                       => 'Ongoing',
            'current_step_index'           => max((int) $document->current_step_index, 4),
        ]);

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

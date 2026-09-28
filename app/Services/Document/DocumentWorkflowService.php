<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\Department;
use App\Models\Document;
use App\Models\RoutingSlip;
use App\Models\User;

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

        $targetUserId = !empty($params['to_user_id']) ? (int) $params['to_user_id'] : null;
        if (!$targetUserId && $targetDeptId) {
            $deptHead = User::where('department_id', $targetDeptId)
                ->whereHas('role', fn($q) => $q->where('role_name', 'Department Head'))
                ->first();
            $targetUserId = $deptHead?->id;
        }

        $stepIndex = 2;
        $newStatus = 'registered';

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $trackingNumber,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $actor->department_id ?? $document->current_holder_department_id,
            'to_user_id'           => $targetUserId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'register',
            'instruction'          => $params['instruction'] ?? 'Document officially registered and routed for processing.',
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

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Register',
            description: "Document officially registered by {$actor->name} with Tracking No. {$trackingNumber} and routed to {$destName}.",
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $targetUserId,
            targetDeptId: $targetDeptId,
            targetRole: 'Department Head',
            sender: $actor
        );

        return $document;
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

        // External: step 7 "Forwarded to Receiving Clerk" (released on clerk release).
        // Internal: stays on final step 6 until the clerk releases it.
        $stepIndex = $document->is_internal ? 6 : 7;
        $document->update([
            'status'                       => 'approved',
            'current_holder_department_id' => $destDeptId,
            'current_holder_id'            => $destUserId,
            'current_step_index'           => $stepIndex,
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

    public function returnDocument(Document $document, string $reason, User $actor, ?string $ip = null): Document
    {
        $targetHolderId = $document->submitted_by ?? $document->current_holder_id;
        $targetHolder = $targetHolderId ? User::find($targetHolderId) : null;
        $targetDeptId = $targetHolder?->department_id ?? $document->department_id;

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
            'from_department_id'   => $document->current_holder_department_id ?? $actor->department_id,
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
            description: "Document returned for revision. Reason: {$reason}",
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

    public function forward(Document $document, array $params, User $actor, ?string $ip = null): Document
    {
        $destDeptId = $params['forward_to_department'];
        $destUserId = $params['forward_to_user'] ?? null;
        $instruction = $params['instruction'] ?? null;

        if (!$destUserId && $destDeptId) {
            $destHead = User::where('department_id', $destDeptId)
                ->whereHas('role', fn($q) => $q->where('role_name', 'Department Head'))
                ->first();
            $destUserId = $destHead?->id;
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

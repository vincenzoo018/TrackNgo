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

        $stepIndex = 2;
        $newStatus = 'registered';

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $trackingNumber,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $actor->department_id ?? $document->current_holder_department_id,
            'to_user_id'           => $params['to_user_id'] ?? null,
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
            'current_holder_id'            => $params['to_user_id'] ?? null,
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

        \App\Services\NotificationService::triggerDocumentReceiptNotification($document, $actor);

        return $document;
    }

    public function accept(Document $document, User $actor, ?string $ip = null): Document
    {
        $stepIndex = $document->is_internal ? 5 : 2;
        if (!$document->is_internal && $document->current_step_index >= 4) {
            $stepIndex = 5;
        }

        $document->update([
            'status'             => 'Accepted',
            'current_step_index' => $stepIndex,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Accepted',
            description: "Document officially received and accepted by {$actor->name}.",
            actor: $actor,
            ipAddress: $ip
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification($document, $actor);

        return $document;
    }

    public function review(Document $document, User $actor, ?string $ip = null): Document
    {
        $stepIndex = 3;
        if ($document->current_step_index >= 4) {
            $stepIndex = 6;
        }

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
        $isDept = ($params['destination_type'] ?? '') === 'department';
        $destinationId = $params['destination_id'];
        $remarks = $params['remarks'] ?? null;

        $targetDeptId = $isDept ? $destinationId : User::find($destinationId)?->department_id;
        $targetUserId = $isDept ? null : $destinationId;

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id,
            'to_user_id'           => $targetUserId,
            'target_department_id' => $targetDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'endorse',
            'instruction'          => $remarks,
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        $document->update([
            'status'                       => 'Sent',
            'current_holder_department_id' => $targetDeptId,
            'current_holder_id'            => $targetUserId,
            'current_step_index'           => 4,
        ]);

        $destName = $isDept
            ? Department::find($destinationId)?->department_name
            : User::find($destinationId)?->name;

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Endorse',
            description: "Document endorsed to {$destName}" . ($remarks ? ": {$remarks}" : ''),
            actor: $actor,
            ipAddress: $ip
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
        $receivingDept = Department::where('department_name', 'like', '%Receiving%')->orWhere('code', 'REC')->first();
        $destDeptId = $receivingDept ? $receivingDept->department_id : 1;

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id,
            'to_user_id'           => null,
            'target_department_id' => $destDeptId,
            'sender_name'          => $actor->name,
            'action'               => 'forward',
            'instruction'          => 'Approved by Mayor. For final release to applicant.',
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        $stepIndex = $document->is_internal ? 5 : 6;
        $document->update([
            'status'                       => 'approved',
            'current_holder_department_id' => $destDeptId,
            'current_holder_id'            => null,
            'current_step_index'           => $stepIndex,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Approve',
            description: 'Document approved and routed to Receiving Clerk for release.',
            actor: $actor,
            ipAddress: $ip
        );

        return $document;
    }

    public function releaseToApplicant(Document $document, User $actor, ?string $ip = null): Document
    {
        $stepIndex = $document->is_internal ? 6 : 7;
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

        $document->update([
            'status'            => 'Returned',
            'return_reason'     => $reason,
            'current_holder_id' => $targetHolderId,
        ]);

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number ?: ('RS-RET-' . $document->reference_number),
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id,
            'to_user_id'           => $targetHolderId,
            'target_department_id' => $document->department_id,
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

        return $document;
    }

    public function forward(Document $document, array $params, User $actor, ?string $ip = null): Document
    {
        $destDeptId = $params['forward_to_department'];
        $destUserId = $params['forward_to_user'] ?? null;
        $instruction = $params['instruction'] ?? null;

        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $document->current_holder_department_id,
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
        ]);

        $deptName = Department::find($destDeptId)?->department_name ?? 'destination';
        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Forward',
            description: "Document forwarded to {$deptName}" . ($instruction ? ": {$instruction}" : ''),
            actor: $actor,
            ipAddress: $ip
        );

        return $document;
    }
}

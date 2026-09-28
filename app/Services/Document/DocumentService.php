<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\DocumentServiceInterface;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DocumentComment;
use App\Models\RoutingSlip;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DocumentService implements DocumentServiceInterface
{
    /**
     * FSM transitions only the current holder may perform. Escalate / link / comments stay open
     * to anyone who can view the document.
     */
    private const HOLDER_ONLY_ACTIONS = [
        'register', 'receive', 'accept', 'review', 'endorse', 'forward',
        'approveAndRouteToReceiving', 'releaseToApplicant', 'return',
    ];

    public function __construct(
        protected DocumentRepository $repository,
        protected DocumentNumberGenerator $numberGenerator,
        protected DocumentWorkflowService $workflowService,
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    public function getDocumentsForUser(User $user): Collection
    {
        return $this->repository->getDocumentsForUser($user);
    }

    public function getDocumentWithConfidentialityGuard(int $id, User $user): Document
    {
        $document = $this->repository->findWithRelations($id);

        // Role is stored as "Receiving Clerk"; classification casing varies ("Confidential" from the UI)
        if (strtolower((string) $document->classification) === 'confidential' && $user->hasRole('Receiving Clerk')) {
            $document->attachment_path = null;
            $document->ocr_text = 'Confidential Document — Metadata Only. You are authorized to route this document but not view its contents.';
            $document->is_confidential_hidden = true;
        }

        return $document;
    }

    public function createDocument(array $data, ?UploadedFile $file, User $actor, ?string $ipAddress = null): Document
    {
        $path = $file ? $file->store('documents', 'public') : null;

        // Document, routing slip, audit entry and notification are saved atomically;
        // on any failure nothing is half-written and the uploaded file is removed.
        try {
            return DB::transaction(fn () => $this->persistDocument($data, $path, $actor, $ipAddress));
        } catch (\Throwable $e) {
            if ($path) {
                Storage::disk('public')->delete($path);
            }
            throw $e;
        }
    }

    protected function persistDocument(array $data, ?string $path, User $actor, ?string $ipAddress = null): Document
    {
        $referenceNumber = $this->numberGenerator->generateReferenceNumber($data['department_id'] ?? null);
        $isReceivingClerk = $actor->hasRole('Receiving Clerk');

        // Receiving Clerks only file external documents; Confidential / Internal are Dept Head & Mayor options
        if ($isReceivingClerk) {
            $data['is_internal'] = false;
            $data['classification'] = 'normal';
        }
        $isInternal = !empty($data['is_internal']);

        if ($isInternal) {
            $trackingNumber = null;
            $status = 'Ongoing';
            $receivingUser = User::whereHas('role', fn($q) => $q->where('role_name', 'Receiving Clerk'))->first();
            $currentHolderDeptId = $receivingUser?->department_id ?? 2;
            $currentHolderId = $receivingUser?->id ?? 5;
            $destinationDeptId = $data['forward_to'];
            $targetUser = $receivingUser;
        } else {
            $trackingNumber = $this->numberGenerator->generateTrackingNumber();
            $status = 'Sent';
            $currentHolderDeptId = $data['forward_to'];
            if (!empty($data['forward_to_user'])) {
                $currentHolderId = (int)$data['forward_to_user'];
                $targetUser = User::find($currentHolderId);
            } elseif ($isReceivingClerk) {
                // External Step 2 (Accepted) belongs to the Department Head of the destination office
                $targetUser = User::where('department_id', $currentHolderDeptId)
                    ->where('is_active', true)
                    ->whereHas('role', fn($q) => $q->where('role_name', 'Department Head'))
                    ->first();
                $currentHolderId = $targetUser?->id;
            } else {
                $targetUser = User::where('department_id', $currentHolderDeptId)
                    ->where('is_active', true)
                    ->whereHas('role', fn($q) => $q->whereIn('role_name', ['Department Head', 'Mayor', 'HR', 'Receiving Clerk', 'Admin', 'CART']))
                    ->orderByRaw("CASE 
                        WHEN role_id = 3 THEN 1 
                        WHEN role_id = 2 THEN 2 
                        WHEN role_id = 6 THEN 3 
                        WHEN role_id = 5 THEN 4 
                        ELSE 5 END")
                    ->first() ?? User::where('department_id', $currentHolderDeptId)->first();
                $currentHolderId = $targetUser?->id;
            }
            $destinationDeptId = null;
        }

        $document = Document::create([
            'reference_number'             => $referenceNumber,
            'tracking_number'              => $trackingNumber,
            'title'                        => $data['title'],
            'type_id'                      => $data['type_id'],
            'department_id'                => $data['department_id'],
            'submitted_by'                 => $actor->id,
            'attachment_path'              => $path,
            'classification'               => $data['classification'],
            'urgency_justification'        => $data['urgency_justification'] ?? null,
            'status'                       => $status,
            'ocr_text'                     => $data['ocr_text'] ?? null,
            'current_step_index'           => 1,
            'total_steps'                  => $isInternal ? 6 : 7,
            'sender'                       => $actor->name,
            'current_holder_department_id' => $currentHolderDeptId,
            'current_holder_id'            => $currentHolderId,
            'is_internal'                  => $isInternal,
            'destination_department_id'    => $destinationDeptId,
            'date_filed'                   => now(),
        ]);

        if ($isInternal) {
            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => 'PENDING-' . $document->reference_number,
                'from_user_id'         => $actor->id,
                'from_department_id'   => $data['department_id'],
                'to_user_id'           => $currentHolderId,
                'target_department_id' => $currentHolderDeptId,
                'sender_name'          => $actor->name,
                'action'               => 'forward',
                'instruction'          => 'Submitted for registration and routing.',
                'status'               => 'pending',
                'date_received'        => now(),
            ]);
        } else {
            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => $trackingNumber,
                'from_user_id'         => $actor->id,
                'from_department_id'   => $data['department_id'],
                'to_user_id'           => $currentHolderId,
                'target_department_id' => $data['forward_to'],
                'sender_name'          => $actor->name,
                'action'               => 'forward',
                'instruction'          => $data['instruction'] ?? null,
                'status'               => 'pending',
                'date_received'        => now(),
            ]);
        }

        $destDept = Department::find($data['forward_to']);
        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Submit',
            description: 'Document submitted and routed to ' . ($destDept?->department_name ?? 'destination'),
            actor: $actor,
            ipAddress: $ipAddress
        );

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $currentHolderId,
            targetDeptId: $currentHolderDeptId,
            targetRole: $targetUser?->role?->role_name,
            sender: $actor
        );

        return $document;
    }

    public function executeWorkflowAction(
        int $documentId,
        string $action,
        array $params,
        User $actor,
        ?string $ipAddress = null
    ): Document {
        $document = Document::findOrFail($documentId);

        if (in_array($action, self::HOLDER_ONLY_ACTIONS, true)) {
            $this->ensureActorHoldsDocument($document, $actor);
        }

        return match ($action) {
            'register'                  => $this->workflowService->register($document, $params, $actor, $ipAddress),
            'receive'                   => $this->workflowService->accept($document, $actor, $ipAddress),
            'accept'                    => $this->workflowService->accept($document, $actor, $ipAddress),
            'review'                    => $this->workflowService->review($document, $actor, $ipAddress),
            'endorse'                   => $this->workflowService->endorse($document, $params, $actor, $ipAddress),
            'escalate'                  => $this->workflowService->escalate($document, $params['justification'] ?? '', $actor, $ipAddress),
            'link'                      => $this->workflowService->link($document, $params['tracking_number'] ?? '', $actor, $ipAddress),
            'approveAndRouteToReceiving'=> $this->workflowService->approveAndRouteToReceiving($document, $actor, $ipAddress),
            'releaseToApplicant'        => $this->workflowService->releaseToApplicant($document, $actor, $ipAddress),
            'archive'                   => $this->workflowService->archive($document, $actor, $ipAddress),
            'return'                    => $this->workflowService->returnDocument($document, $params['reason'] ?? '', $actor, $ipAddress),
            'forward'                   => $this->workflowService->forward($document, $params, $actor, $ipAddress),
            default                     => throw new \InvalidArgumentException("Unknown workflow action: {$action}"),
        };
    }

    /**
     * A document is acted on by whoever holds it: the assigned user, or anyone in the holding
     * office while unassigned. Admin keeps override rights. Mirrors resources/js/lib/document-holder.ts.
     */
    protected function ensureActorHoldsDocument(Document $document, User $actor): void
    {
        if ($actor->hasRole('Admin')) {
            return;
        }

        $holdsIt = $document->current_holder_id
            ? (int) $document->current_holder_id === (int) $actor->id
            : (!$document->current_holder_department_id
                || (int) $document->current_holder_department_id === (int) $actor->department_id);

        if (!$holdsIt) {
            $holder = $document->currentHolder?->name
                ?? $document->currentHolderDepartment?->department_name
                ?? 'another office';

            throw new AuthorizationException("This document is currently with {$holder}. Only the current holder can act on it.");
        }
    }

    public function addComment(int $documentId, string $comment, User $actor, ?string $ipAddress = null): DocumentComment
    {
        $document = Document::findOrFail($documentId);

        $docComment = DocumentComment::create([
            'document_id' => $document->document_id,
            'user_id'     => $actor->id,
            'comment'     => $comment,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Comment',
            description: "{$actor->name} added a discussion note: " . mb_strimwidth($comment, 0, 50, '...'),
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $docComment;
    }

    public function addAttachment(int $documentId, UploadedFile $file, string $description, User $actor, ?string $ipAddress = null): DocumentAttachment
    {
        $document = Document::findOrFail($documentId);
        $path = $file->store('attachments', 'public');

        $attachment = DocumentAttachment::create([
            'document_id'   => $document->document_id,
            'user_id'       => $actor->id,
            'file_path'     => $path,
            'file_name'     => $file->getClientOriginalName(),
            'description'   => $description,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Attachment',
            description: "{$actor->name} uploaded secondary attachment: {$attachment->file_name}",
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $attachment;
    }

    public function updateDocument(int $documentId, array $data, User $actor, ?string $ipAddress = null): Document
    {
        $document = Document::findOrFail($documentId);
        $document->update($data);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Update',
            description: "Document details updated by {$actor->name}.",
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $document;
    }

    public function deleteDocument(int $documentId, User $actor, ?string $ipAddress = null): void
    {
        $document = Document::findOrFail($documentId);
        $ref = $document->reference_number;
        $document->delete();

        $this->auditTrailService->logDocumentAction(
            document: $documentId,
            action: 'Delete',
            description: "Document {$ref} deleted by {$actor->name}.",
            actor: $actor,
            ipAddress: $ipAddress
        );
    }
}

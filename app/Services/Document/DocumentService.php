<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\DocumentServiceInterface;
use App\Contracts\SignatureServiceInterface;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DocumentClient;
use App\Models\DocumentComment;
use App\Models\DocumentSignatory;
use App\Models\RoutingSlip;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentService implements DocumentServiceInterface
{
    /**
     * Actions only the current holder may perform: once a user forwards / approves the document it is out of
     * their hands until it is returned to them. Escalation to CART and comments stay open to anyone who can
     * view the document.
     */
    private const HOLDER_ONLY_ACTIONS = [
        'register', 'receive', 'accept', 'review', 'endorse', 'forward',
        'approveAndRouteToReceiving', 'releaseToApplicant', 'return', 'resubmit', 'link',
    ];

    /** Passing the document on is the holder's approval: a signatory's registered signature is stamped then */
    private const APPROVING_ACTIONS = ['endorse', 'forward', 'approveAndRouteToReceiving'];

    /** Routing slip instruction to the clerk when the sender left no instructions */
    public const REGISTRATION_INSTRUCTION = 'Submitted for registration and routing.';

    public function __construct(
        protected DocumentRepository $repository,
        protected DocumentNumberGenerator $numberGenerator,
        protected DocumentWorkflowService $workflowService,
        protected AuditTrailServiceInterface $auditTrailService,
        protected SignatureServiceInterface $signatureService
    ) {}

    public function getDocumentsForUser(User $user): Collection
    {
        return $this->repository->getDocumentsForUser($user);
    }

    public function getDocumentWithConfidentialityGuard(int $id, User $user): Document
    {
        // Document::toArray() strips confidential contents for viewers outside the route (see DocumentConfidentiality)
        return $this->repository->findWithRelations($id);
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
        $isReceivingClerk = $actor->hasRole('Receiving Clerk');
        // The routing slip is always issued from the filer's own office
        $slipFromDepartmentId = $data['department_id'];

        // Receiving Clerks only file external documents; Confidential / Internal are Dept Head & Mayor options.
        // The document originates from an external client, so it is filed under the office that will handle it
        // (e.g. BPLO-2026-0004) instead of the clerk's own office.
        $client = null;
        if ($isReceivingClerk) {
            $data['is_internal'] = false;
            $data['classification'] = 'normal';
            $data['department_id'] = $data['forward_to'];
            $slipFromDepartmentId = $actor->department_id ?? $slipFromDepartmentId;
            $client = $data['client'] ?? null;
        } else {
            // Documents from internal personnel always pass through the Receiving Clerk, who registers them
            // for the record before they reach the person the sender chose (same office or another office)
            $data['is_internal'] = true;
            // Staff always file from their own office
            if ($actor->department_id) {
                $data['department_id'] = $actor->department_id;
                $slipFromDepartmentId = $actor->department_id;
            }
        }
        $isInternal = !empty($data['is_internal']);
        $referenceNumber = $this->numberGenerator->generateReferenceNumber($data['department_id'] ?? null);
        $clientName = $client ? (new DocumentClient($client))->full_name : null;
        $destinationUserId = null;

        if ($isInternal) {
            $trackingNumber = null;
            $status = 'Ongoing';
            $receivingUser = User::whereHas('role', fn($q) => $q->where('role_name', 'Receiving Clerk'))
                ->where('is_active', true)
                ->first();
            $currentHolderDeptId = $receivingUser?->department_id ?? 2;
            $currentHolderId = $receivingUser?->id ?? 5;
            $destinationDeptId = $data['forward_to'];
            // Kept on the document so the clerk's registration routes it to exactly this person
            $destinationUserId = !empty($data['forward_to_user'])
                ? (int) $data['forward_to_user']
                : $this->workflowService->resolveOfficeHead((int) $destinationDeptId, $actor->id)?->id;
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
            // External documents are "from" the client; staff-filed documents are from the filer
            'sender'                       => $clientName ? mb_substr($clientName, 0, 100) : $actor->name,
            'contact_number'               => $client['contact_number'] ?? null,
            'current_holder_department_id' => $currentHolderDeptId,
            'current_holder_id'            => $currentHolderId,
            'is_internal'                  => $isInternal,
            'destination_department_id'    => $destinationDeptId,
            'destination_user_id'          => $destinationUserId,
            'requires_signature'           => !empty($data['signatories']),
            'date_filed'                   => now(),
        ]);

        if ($client) {
            $document->client()->create($client);
        }

        foreach (array_values(array_unique(array_map('intval', $data['signatories'] ?? []))) as $index => $signatoryId) {
            DocumentSignatory::create([
                'document_id' => $document->document_id,
                'user_id'     => $signatoryId,
                'sign_order'  => $index + 1,
            ]);
        }
        // A sender who listed themselves signs by submitting it
        $this->signatureService->stampIfDue($document, $actor, $ipAddress);

        if ($isInternal) {
            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => 'PENDING-' . $document->reference_number,
                'from_user_id'         => $actor->id,
                'from_department_id'   => $slipFromDepartmentId,
                'to_user_id'           => $currentHolderId,
                'target_department_id' => $currentHolderDeptId,
                'sender_name'          => $actor->name,
                'action'               => 'forward',
                // The sender's instructions travel with the document to the recipient (see register)
                'instruction'          => $data['instruction'] ?? self::REGISTRATION_INSTRUCTION,
                'status'               => 'pending',
                'date_received'        => now(),
            ]);
        } else {
            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => $trackingNumber,
                'from_user_id'         => $actor->id,
                'from_department_id'   => $slipFromDepartmentId,
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
        $addressee = $destinationUserId ? User::find($destinationUserId)?->name : null;
        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Submit',
            description: $isInternal
                ? 'Document submitted to the Receiving Clerk for registration, addressed to '
                    . ($addressee ? "{$addressee} (" . ($destDept?->department_name ?? 'destination') . ')' : ($destDept?->department_name ?? 'destination'))
                : 'Document submitted and routed to ' . ($destDept?->department_name ?? 'destination'),
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
        $this->ensureSignaturesAllow($document, $action, $actor);

        if (in_array($action, self::APPROVING_ACTIONS, true)) {
            // The signature and the move succeed or fail together
            return DB::transaction(function () use ($document, $action, $params, $actor, $ipAddress) {
                $this->signatureService->stampIfDue($document, $actor, $ipAddress);

                return $this->performWorkflowAction($document, $action, $params, $actor, $ipAddress);
            });
        }

        return $this->performWorkflowAction($document, $action, $params, $actor, $ipAddress);
    }

    protected function performWorkflowAction(Document $document, string $action, array $params, User $actor, ?string $ipAddress): Document
    {
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
            'resubmit'                  => $this->workflowService->resubmit($document, $params['files'] ?? [], $params['note'] ?? null, $actor, $ipAddress),
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

    /**
     * Signed documents: nothing goes to the Receiving Clerk for release while another signatory has yet to
     * sign (the actor's own signature is stamped by the approval itself), and the clerk only releases it once
     * the final signed copy is attached.
     */
    protected function ensureSignaturesAllow(Document $document, string $action, User $actor): void
    {
        if (!$document->requires_signature || !in_array($action, ['approveAndRouteToReceiving', 'releaseToApplicant'], true)) {
            return;
        }

        $pending = $document->signatories()->whereNull('signed_at')->with('user')->get()
            ->reject(fn ($s) => $action === 'approveAndRouteToReceiving' && (int) $s->user_id === (int) $actor->id);

        if ($pending->isNotEmpty()) {
            throw ValidationException::withMessages([
                'signature' => 'Still waiting for the signature of ' . $pending->map(fn ($s) => $s->user?->name ?? 'a signatory')->join(', ', ' and ')
                    . '. Route the document to them so they can approve it first.',
            ]);
        }

        if ($action === 'releaseToApplicant' && !$document->signed_file_path) {
            throw ValidationException::withMessages([
                'signature' => 'All signatures are stamped, but the final signed copy is not attached yet. It is generated when the sender or a signatory opens the document.',
            ]);
        }
    }

    /** Comments and uploads on a confidential document are limited to the people who can open it. */
    protected function ensureCanViewContents(Document $document, User $actor): void
    {
        if (!$document->contentsVisibleTo($actor)) {
            throw new AuthorizationException('This document is confidential. Only its sender and recipients can open it.');
        }
    }

    public function addComment(int $documentId, string $comment, User $actor, ?string $ipAddress = null, ?string $quotedText = null): DocumentComment
    {
        $document = Document::findOrFail($documentId);
        $this->ensureCanViewContents($document, $actor);
        $quotedText = $quotedText !== null && trim($quotedText) !== '' ? trim($quotedText) : null;

        // Anchored comments keep the passage of the document they refer to
        $docComment = DocumentComment::create([
            'document_id' => $document->document_id,
            'user_id'     => $actor->id,
            'comment'     => $comment,
            'is_anchored' => $quotedText !== null,
            'quoted_text' => $quotedText,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: $quotedText !== null ? 'Anchored Comment' : 'Comment',
            description: $quotedText !== null
                ? "{$actor->name} commented on \"" . mb_strimwidth($quotedText, 0, 40, '...') . '": ' . mb_strimwidth($comment, 0, 50, '...')
                : "{$actor->name} added a discussion note: " . mb_strimwidth($comment, 0, 50, '...'),
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $docComment;
    }

    public function addAttachment(int $documentId, UploadedFile $file, string $description, User $actor, ?string $ipAddress = null): DocumentAttachment
    {
        $document = Document::findOrFail($documentId);
        $this->ensureCanViewContents($document, $actor);
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

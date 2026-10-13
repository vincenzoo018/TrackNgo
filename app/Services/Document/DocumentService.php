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
use App\Models\DocumentRouteStop;
use App\Models\DocumentSignatory;
use App\Models\DocumentType;
use App\Models\RoutingSlip;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Oic\OicService;
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
        'receive', 'accept', 'review', 'endorse', 'forward', 'approveRoute',
        'approveAndRouteToReceiving', 'releaseToApplicant', 'return', 'resubmit', 'link', 'veto',
    ];

    /** Passing the document on is the holder's approval: a signatory's registered signature is stamped then */
    private const APPROVING_ACTIONS = ['endorse', 'forward', 'approveAndRouteToReceiving', 'approveRoute'];

    /** Route-based documents follow the route chosen at filing; nobody picks the next person by hand */
    private const MANUAL_ROUTING_ACTIONS = ['endorse', 'forward', 'approveAndRouteToReceiving'];

    public function __construct(
        protected DocumentRepository $repository,
        protected DocumentNumberGenerator $numberGenerator,
        protected DocumentWorkflowService $workflowService,
        protected AuditTrailServiceInterface $auditTrailService,
        protected SignatureServiceInterface $signatureService,
        protected DocumentRoute $route,
        protected DocumentRevisionService $revisionService,
        protected WorkingDayCalendar $calendar,
        protected OicService $oic,
        protected MayoralActionService $mayoral
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

    /** $data['attachments']: supporting files uploaded with the main document, kept as its attachments */
    public function createDocument(array $data, ?UploadedFile $file, User $actor, ?string $ipAddress = null): Document
    {
        $path = $file ? $file->store('documents', Document::FILE_DISK) : null;
        $storedPaths = array_filter([$path]);

        // Document, routing slip, audit entry and notification are saved atomically;
        // on any failure nothing is half-written and the uploaded files are removed.
        try {
            return DB::transaction(function () use ($data, $file, $path, $actor, $ipAddress, &$storedPaths) {
                $document = $this->persistDocument($data, $path, $actor, $ipAddress);
                if ($file && $path) {
                    // The submitted file is Version 1; corrections become later versions and never overwrite it
                    $this->revisionService->recordOriginal($document, $file, $path, $actor);
                }

                foreach ($data['attachments'] ?? [] as $attachment) {
                    $attachmentPath = $attachment->store('attachments', Document::FILE_DISK);
                    $storedPaths[] = $attachmentPath;
                    DocumentAttachment::create([
                        'document_id' => $document->document_id,
                        'user_id'     => $actor->id,
                        'file_name'   => $attachment->getClientOriginalName(),
                        'file_path'   => $attachmentPath,
                        'file_size'   => $attachment->getSize(),
                        'file_type'   => $attachment->getClientMimeType(),
                        'reason'      => 'Supporting file submitted with the document',
                    ]);
                }

                return $document;
            });
        } catch (\Throwable $e) {
            foreach ($storedPaths as $storedPath) {
                Storage::disk(Document::FILE_DISK)->delete($storedPath);
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
            // Documents from internal personnel are registered automatically and go straight to the person the
            // sender chose (same office or another office); the Receiving Clerk only monitors them
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
        // External documents go straight to their first recipient: the official, or their OIC while they are away
        $firstOfficial = null;
        $heldFor = null;
        $deliveryNote = '';

        // Every document is registered (gets its tracking number) when it is filed, internal ones included
        $trackingNumber = $this->numberGenerator->generateTrackingNumber();
        $status = 'Sent';

        if ($isInternal) {
            // The person the sender chose (first on the route), or the head of the office it is addressed to
            $destinationDeptId = $data['forward_to'];
            $destinationUserId = !empty($data['forward_to_user'])
                ? (int) $data['forward_to_user']
                : $this->workflowService->resolveOfficeHead((int) $destinationDeptId, $actor->id)?->id;
            $targetUser = $destinationUserId ? User::find($destinationUserId) : null;
            $currentHolderId = $targetUser?->id;
            $currentHolderDeptId = $targetUser?->department_id ?? $destinationDeptId;
        } else {
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

        // LGC Sec. 46: the Officer-in-Charge receives it while the first recipient is away
        $firstOfficial = $targetUser ?? ($currentHolderId ? User::find($currentHolderId) : null);
        $delivery = $this->workflowService->deliveryTo($firstOfficial, $currentHolderDeptId ? (int) $currentHolderDeptId : null);
        if ($delivery['columns']['held_for_user_id']) {
            $targetUser = $delivery['holder'];
            $currentHolderId = $targetUser->id;
            $currentHolderDeptId = $delivery['columns']['current_holder_department_id'];
            $heldFor = $firstOfficial->id;
            $deliveryNote = $delivery['note'];
        }

        $type = DocumentType::find($data['type_id']);

        $document = Document::create([
            // Holiday-aware ARTA deadline (working days; calendar days for ordinances / resolutions)
            'arta_due_date'                => $this->calendar->dueDate(now(), $type)->toDateString(),
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
            // Fixed-flow internal documents start at step 2 "Registered" (route-based ones are synced below)
            'current_step_index'           => $isInternal ? 2 : 1,
            'total_steps'                  => $isInternal ? 6 : 7,
            // External documents are "from" the client; staff-filed documents are from the filer
            'sender'                       => $clientName ? mb_substr($clientName, 0, 100) : $actor->name,
            'contact_number'               => $client['contact_number'] ?? null,
            'current_holder_department_id' => $currentHolderDeptId,
            'current_holder_id'            => $currentHolderId,
            'held_for_user_id'             => $heldFor,
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

        // Flexible route chosen at filing (StoreDocumentRequest derived forward_to / signatories from it)
        foreach (array_values($data['route'] ?? []) as $index => $stop) {
            $isFiler = (int) $stop['user_id'] === (int) $actor->id;
            DocumentRouteStop::create([
                'document_id' => $document->document_id,
                'user_id'     => (int) $stop['user_id'],
                'position'    => $index + 1,
                'signs'       => !empty($stop['signs']),
                // The sender heading their own route signs as they submit
                'approved_at' => $isFiler ? now() : null,
            ]);
        }
        if (!empty($data['route'])) {
            $document->update(['route_based' => true]);
        }

        // A sender who listed themselves signs by submitting it
        $this->signatureService->stampIfDue($document, $actor, $ipAddress);

        // The sender's instructions travel with the document to its first recipient
        RoutingSlip::create([
            'document_id'          => $document->document_id,
            'tracking_number'      => $trackingNumber,
            'from_user_id'         => $actor->id,
            'from_department_id'   => $slipFromDepartmentId,
            'to_user_id'           => $currentHolderId,
            'target_department_id' => $data['forward_to'],
            'sender_name'          => $actor->name,
            'action'               => 'forward',
            'instruction'          => trim(($data['instruction'] ?? '') . $deliveryNote) ?: null,
            'status'               => 'pending',
            'date_received'        => now(),
        ]);

        $destDept = Department::find($data['forward_to']);
        $supporting = count($data['attachments'] ?? []);
        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Submit',
            description: ($isInternal
                ? "Document submitted and registered automatically with Tracking No. {$trackingNumber}, sent to "
                    . ($targetUser ? "{$targetUser->name} (" . ($destDept?->department_name ?? 'destination') . ')' : ($destDept?->department_name ?? 'destination'))
                : 'Document submitted and routed to ' . ($destDept?->department_name ?? 'destination'))
                . ($supporting ? " with {$supporting} supporting file" . ($supporting === 1 ? '' : 's') : ''),
            actor: $actor,
            ipAddress: $ipAddress
        );
        // An ordinance / resolution sent straight to the Mayor: the 10 days start now (LGC Sec. 54)
        $this->mayoral->markReceived($document, $firstOfficial, $actor);

        \App\Services\NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $currentHolderId,
            targetDeptId: $currentHolderDeptId,
            targetRole: $targetUser?->role?->role_name,
            sender: $actor
        );

        if ($document->route_based) {
            $this->route->sync($document);
        }

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
        if ($document->route_based && in_array($action, self::MANUAL_ROUTING_ACTIONS, true)) {
            throw ValidationException::withMessages([
                'route' => 'This document follows the route set when it was filed. Use Approve to send it to the next person.',
            ]);
        }
        if ($action === 'approveRoute' && !$document->route_based) {
            throw ValidationException::withMessages(['route' => 'This document has no set route; forward it from the document page.']);
        }
        $this->ensureSignaturesAllow($document, $action, $actor);

        // An Officer-in-Charge acts with the designation as reference in every entry the action writes
        $result = $this->oic->withActingContext($document, $actor, fn () => in_array($action, self::APPROVING_ACTIONS, true)
            // The signature and the move succeed or fail together
            ? DB::transaction(function () use ($document, $action, $params, $actor, $ipAddress) {
                $this->signatureService->stampIfDue($document, $actor, $ipAddress);

                return $this->performWorkflowAction($document, $action, $params, $actor, $ipAddress);
            })
            : $this->performWorkflowAction($document, $action, $params, $actor, $ipAddress));

        // The progress bar of a routed document is rebuilt from its route and history after every action
        if ($result->route_based) {
            $this->route->sync($result);
        }

        return $result;
    }

    protected function performWorkflowAction(Document $document, string $action, array $params, User $actor, ?string $ipAddress): Document
    {
        return match ($action) {
            'receive'                   => $this->workflowService->accept($document, $actor, $ipAddress),
            'accept'                    => $this->workflowService->accept($document, $actor, $ipAddress),
            'review'                    => $this->workflowService->review($document, $actor, $ipAddress),
            'endorse'                   => $this->workflowService->endorse($document, $params, $actor, $ipAddress),
            'escalate'                  => $this->workflowService->escalate($document, $params['justification'] ?? '', $actor, $ipAddress),
            'link'                      => $this->workflowService->link($document, $params['tracking_number'] ?? '', $actor, $ipAddress),
            'approveAndRouteToReceiving'=> $this->workflowService->approveAndRouteToReceiving($document, $actor, $ipAddress),
            'approveRoute'              => $this->workflowService->approveOnRoute($document, $actor, $ipAddress),
            'releaseToApplicant'        => $this->workflowService->releaseToApplicant($document, $actor, $ipAddress),
            'archive'                   => $this->workflowService->archive($document, $actor, $ipAddress),
            'return'                    => $this->workflowService->returnDocument($document, $params['reason'] ?? '', $actor, $ipAddress),
            'forward'                   => $this->workflowService->forward($document, $params, $actor, $ipAddress),
            'veto'                      => $this->workflowService->veto($document, $params['reasons'] ?? '', $actor, $ipAddress),
            'resubmit'                  => $this->workflowService->resubmit(
                $document, $params['files'] ?? [], $params['note'] ?? null, $actor, $ipAddress, $params['main_file'] ?? null, $params['ocr_text'] ?? null
            ),
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

        if (!$document->isHeldBy($actor)) {
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
        // Deemed approved by law: it is released as it is, without the signatures still missing (RA 11032 Sec. 10)
        if ($document->isDeemedApproved()) {
            return;
        }
        // An Officer-in-Charge approves (and signs) in the absent official's place
        $actingAs = $this->workflowService->actingAs($document, $actor);
        // On a route only the last approval sends it out, and the route order has already collected the signatures
        $finalApproval = $action === 'approveAndRouteToReceiving'
            || ($action === 'approveRoute' && !$this->route->nextAfter($document, $actingAs));
        if (!$document->requires_signature || (!$finalApproval && $action !== 'releaseToApplicant')) {
            return;
        }

        $pending = $document->signatories()->whereNull('signed_at')->with('user')->get()
            ->reject(fn ($s) => $finalApproval && in_array((int) $s->user_id, [(int) $actor->id, (int) $actingAs->id], true));

        if ($pending->isNotEmpty()) {
            throw ValidationException::withMessages([
                'signature' => 'Still waiting for the signature of ' . $pending->map(fn ($s) => $s->user?->name ?? 'a signatory')->join(', ', ' and ')
                    . '. Route the document to them so they can approve it first.',
            ]);
        }

        // A copy built while signatures were still being collected is not the final one
        if ($action === 'releaseToApplicant' && !$document->hasFinalSignedCopy()) {
            throw ValidationException::withMessages([
                'signature' => 'All signatures are stamped, but the final signed copy is not attached yet. Open the document once more to attach it, then release it.',
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
        $path = $file->store('attachments', Document::FILE_DISK);

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

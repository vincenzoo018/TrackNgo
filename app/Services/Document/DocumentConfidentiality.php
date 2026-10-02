<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\User;

/**
 * Confidential documents may only be opened by the sender, the people the document is routed to and its
 * signatories. Everyone else — the Receiving Clerk in particular, who registers the document and monitors
 * its route — sees metadata only: reference / tracking number, sender, recipient, dates and status.
 *
 * Bound per request (see DomainServiceProvider) so the access cache never outlives the request.
 */
class DocumentConfidentiality
{
    public const HIDDEN_TITLE = 'Confidential Document';
    public const HIDDEN_REMARKS = 'Confidential — remarks are visible to the sender and recipients only.';

    /** Audit actions whose description can quote the document's contents */
    private const CONTENT_ACTIONS = ['comment', 'anchored comment', 'attachment', 'resubmitted', 'endorse', 'forward', 'return'];

    /** @var array<string, bool> "documentId:userId" => can view */
    private array $access = [];

    /** @var array<int, Document|null> confidential documents looked up by id (audit trail rows) */
    private array $documents = [];

    public static function isConfidential(Document $document): bool
    {
        return strtolower((string) $document->classification) === 'confidential';
    }

    public function canViewContents(Document $document, ?User $user): bool
    {
        if (!self::isConfidential($document)) {
            return true;
        }
        if (!$user) {
            return false;
        }

        return $this->access[$document->document_id . ':' . $user->id] ??= $this->resolveAccess($document, $user);
    }

    /** Same check for records that only carry a document id (audit trail rows). */
    public function canViewContentsById(?int $documentId, ?User $user): bool
    {
        if (!$documentId) {
            return true;
        }
        if (!array_key_exists($documentId, $this->documents)) {
            $document = Document::find($documentId);
            $this->documents[$documentId] = $document && self::isConfidential($document) ? $document : null;
        }

        return $this->documents[$documentId] === null || $this->canViewContents($this->documents[$documentId], $user);
    }

    private function resolveAccess(Document $document, User $user): bool
    {
        $userId = (int) $user->id;

        if ((int) $document->submitted_by === $userId) {
            return true;
        }
        // The clerk registers and monitors the route but never opens a confidential document
        if ($user->hasRole('Receiving Clerk')) {
            return false;
        }
        if ((int) $document->current_holder_id === $userId || (int) $document->destination_user_id === $userId) {
            return true;
        }
        // An office holding the document without a named person may open what it has to act on
        if (!$document->current_holder_id && $document->current_holder_department_id
            && (int) $document->current_holder_department_id === (int) $user->department_id) {
            return true;
        }

        $onRoute = $document->relationLoaded('routingSlips')
            ? $document->routingSlips->contains(fn ($slip) => (int) $slip->to_user_id === $userId || (int) $slip->from_user_id === $userId)
            : $document->routingSlips()->where(fn ($q) => $q->where('to_user_id', $userId)->orWhere('from_user_id', $userId))->exists();

        return $onRoute || $document->signatories()->where('user_id', $userId)->exists();
    }

    /**
     * Strip the contents from a serialized document, keeping the metadata the clerk needs for the record.
     */
    public function redact(array $data): array
    {
        $data['title'] = self::HIDDEN_TITLE;
        foreach (['ocr_text', 'attachment_path', 'signed_file_path', 'urgency_justification', 'return_reason'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = null;
            }
        }
        foreach (['attachments', 'comments', 'audit_trails'] as $relation) {
            if (array_key_exists($relation, $data)) {
                $data[$relation] = [];
            }
        }
        if (isset($data['routing_slips']) && is_array($data['routing_slips'])) {
            $data['routing_slips'] = array_map(
                fn ($slip) => is_array($slip) && !empty($slip['instruction']) ? array_merge($slip, ['instruction' => self::HIDDEN_REMARKS]) : $slip,
                $data['routing_slips']
            );
        }
        // Who signed and when stays visible (route monitoring); the signature images do not
        if (isset($data['signatures']) && is_array($data['signatures'])) {
            $data['signatures'] = array_map(fn ($sig) => is_array($sig) ? array_merge($sig, ['signature_image' => null]) : $sig, $data['signatures']);
        }
        if (isset($data['signatories']) && is_array($data['signatories'])) {
            $data['signatories'] = array_map(function ($row) {
                if (is_array($row) && isset($row['signature']) && is_array($row['signature'])) {
                    $row['signature']['signature_image'] = null;
                }
                return $row;
            }, $data['signatories']);
        }

        return $data;
    }

    /**
     * Audit descriptions of comments, attachments and routing remarks quote the document; replace them
     * with a content-free line for viewers who cannot open it.
     */
    public function redactAuditDescription(string $action, string $description): string
    {
        $action = strtolower(trim($action));
        if (!in_array($action, self::CONTENT_ACTIONS, true)) {
            return $description;
        }

        return match ($action) {
            'comment', 'anchored comment' => 'A comment was added (confidential).',
            'attachment'                  => 'A supporting file was uploaded (confidential).',
            'resubmitted'                 => 'Correction submitted and sent back (confidential).',
            'return'                      => 'Document returned for revision (reason is confidential).',
            // "Document endorsed to X: remarks" → keep the destination, drop the remarks
            default                       => preg_replace('/^(Document (?:endorsed|forwarded) to [^:]+):.*$/s', '$1.', $description) ?? $description,
        };
    }
}

<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\User;

/**
 * Who may open a document (its file, text, applicant, remarks):
 *  - every document: the people involved in it — its filer, the holder (and the holding office while unassigned),
 *    the owning office, the people / offices on its routing slips and route, its signatories, the official an OIC
 *    holds it for;
 *  - normal documents also: the Receiving Clerk (registers and monitors them), the Admin and CART (monitoring);
 *  - confidential documents: the involved people only — never the Receiving Clerk.
 * Everyone else sees a summary only: reference / tracking number, office, dates and status, titled
 * "Restricted Document" (or "Confidential Document").
 *
 * Bound per request (see DomainServiceProvider) so the access cache never outlives the request.
 */
class DocumentConfidentiality
{
    public const HIDDEN_TITLE = 'Confidential Document';
    public const RESTRICTED_TITLE = 'Restricted Document';
    public const HIDDEN_REMARKS = 'Confidential — remarks are visible to the sender and recipients only.';

    /** Roles that monitor every normal document */
    private const MONITORING_ROLES = ['Receiving Clerk', 'Admin', 'CART'];

    /** Audit actions whose description can quote the document's contents */
    private const CONTENT_ACTIONS = [
        'comment', 'anchored comment', 'attachment', 'resubmitted', 'endorse', 'forward', 'return', 'metadata updated', 'revision created',
    ];

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
        if (!$user) {
            return false;
        }

        return $this->access[$document->document_id . ':' . $user->id] ??= $this->resolveAccess($document, $user);
    }

    /** Title shown to people who cannot open the document */
    public static function hiddenTitle(Document $document): string
    {
        return self::isConfidential($document) ? self::HIDDEN_TITLE : self::RESTRICTED_TITLE;
    }

    /** Same check for records that only carry a document id (audit trail rows). */
    public function canViewContentsById(?int $documentId, ?User $user): bool
    {
        if (!$documentId) {
            return true;
        }
        if (!array_key_exists($documentId, $this->documents)) {
            $this->documents[$documentId] = Document::find($documentId);
        }

        return $this->documents[$documentId] === null || $this->canViewContents($this->documents[$documentId], $user);
    }

    private function resolveAccess(Document $document, User $user): bool
    {
        $userId = (int) $user->id;
        $confidential = self::isConfidential($document);

        if ((int) $document->submitted_by === $userId) {
            return true;
        }
        if (in_array($user->role?->role_name, self::MONITORING_ROLES, true)) {
            // The clerk registers and monitors the route but never opens a confidential document
            return !$confidential || (!$user->hasRole('Receiving Clerk') && $this->isInvolved($document, $user, false));
        }

        return $this->isInvolved($document, $user, !$confidential);
    }

    /**
     * The person is part of the document's processing. Offices count too for normal documents (the owning office and
     * offices on the slips); a confidential document is opened only by the people themselves and an office holding it
     * without a named person.
     */
    private function isInvolved(Document $document, User $user, bool $officesCount): bool
    {
        $userId = (int) $user->id;
        $deptId = (int) $user->department_id;

        if (in_array($userId, [(int) $document->current_holder_id, (int) $document->destination_user_id, (int) $document->held_for_user_id], true)) {
            return true;
        }
        // An office holding the document without a named person may open what it has to act on
        if ($deptId && !$document->current_holder_id && (int) $document->current_holder_department_id === $deptId) {
            return true;
        }
        if ($officesCount && $deptId && in_array($deptId, [(int) $document->department_id, (int) $document->current_holder_department_id, (int) $document->destination_department_id], true)) {
            return true;
        }

        $slips = $document->relationLoaded('routingSlips') ? $document->routingSlips : $document->routingSlips()->get(['to_user_id', 'from_user_id', 'acting_for_user_id', 'target_department_id', 'from_department_id']);
        $onSlips = $slips->contains(fn ($slip) => in_array($userId, [(int) $slip->to_user_id, (int) $slip->from_user_id, (int) $slip->acting_for_user_id], true)
            || ($officesCount && $deptId && in_array($deptId, [(int) $slip->target_department_id, (int) $slip->from_department_id], true)));

        return $onSlips
            || $document->signatories()->where('user_id', $userId)->exists()
            // Everyone on a route chosen at filing (reviewers as well as signers)
            || $document->routeStops()->where('user_id', $userId)->exists();
    }

    /**
     * Strip the contents from a serialized document, keeping the metadata needed for the record: reference /
     * tracking number, office, dates, status and who holds it.
     */
    public function redact(array $data): array
    {
        $data['title'] = strtolower((string) ($data['classification'] ?? '')) === 'confidential' ? self::HIDDEN_TITLE : self::RESTRICTED_TITLE;
        foreach (['ocr_text', 'attachment_path', 'signed_file_path', 'urgency_justification', 'return_reason', 'revision_info', 'contact_number', 'client'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = null;
            }
        }
        // External documents are "from" the applicant: their name is not shown either
        if (empty($data['is_internal']) && array_key_exists('sender', $data)) {
            $data['sender'] = 'Applicant';
        }
        foreach (['attachments', 'comments', 'audit_trails', 'revisions'] as $relation) {
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
            'metadata updated'            => 'Document details were updated (confidential).',
            'revision created'            => 'A new version of the document file was uploaded (confidential).',
            // "Document endorsed to X: remarks" → keep the destination, drop the remarks
            default                       => preg_replace('/^(Document (?:endorsed|forwarded) to [^:]+):.*$/s', '$1.', $description) ?? $description,
        };
    }
}

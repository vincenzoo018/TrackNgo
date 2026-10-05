<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Editing a document's details (metadata). Only the fields below can change; the tracking / reference numbers,
 * filing date and filer, signatures, routing history and the trail are never touched. Every change is written
 * to the audit trail with its old and new value.
 */
class DocumentMetadataService
{
    /** What the signatories approved: locked once the current version is signed (DocumentPolicy::editContentDetails) */
    public const CONTENT_FIELDS = [
        'title'              => 'Title',
        'type_id'            => 'Document Type',
        'client.first_name'  => 'First Name',
        'client.middle_name' => 'Middle Name',
        'client.last_name'   => 'Last Name',
        'client.suffix'      => 'Suffix',
        'client.organization' => 'Organization / Company',
        'client.purpose'     => 'Purpose',
    ];

    /** Editable until the document is completed, so the applicant can still be reached */
    public const CONTACT_FIELDS = [
        'client.contact_number' => 'Contact Number',
        'client.email'          => 'Email Address',
    ];

    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    /**
     * @param  array  $input  validated input (UpdateDocumentMetadataRequest)
     * @return array<string, array{label: string, old: ?string, new: ?string}> the fields that changed
     */
    public function update(Document $document, array $input, User $actor, ?string $ipAddress = null): array
    {
        $client = $document->client;
        $changes = [];
        foreach (self::CONTENT_FIELDS + self::CONTACT_FIELDS as $field => $label) {
            // Applicant fields exist only on external documents
            if (!Arr::has($input, $field) || (str_starts_with($field, 'client.') && !$client)) {
                continue;
            }
            $old = $this->normalize(str_starts_with($field, 'client.') ? $client->{substr($field, 7)} : $document->{$field});
            $new = $this->normalize(Arr::get($input, $field));
            if ($old !== $new) {
                $changes[$field] = ['label' => $label, 'old' => $old, 'new' => $new];
            }
        }

        if ($changes === []) {
            throw ValidationException::withMessages(['metadata' => 'Nothing was changed.']);
        }

        $contentChanged = array_intersect_key($changes, self::CONTENT_FIELDS) !== [];
        $content = Gate::forUser($actor)->inspect('editContentDetails', $document);
        if ($contentChanged && $content->denied()) {
            throw new AuthorizationException($content->message());
        }

        DB::transaction(function () use ($document, $client, $changes, $actor, $ipAddress) {
            $documentFields = [];
            $clientFields = [];
            foreach ($changes as $field => $change) {
                if (str_starts_with($field, 'client.')) {
                    $clientFields[substr($field, 7)] = $change['new'];
                } else {
                    $documentFields[$field] = $change['new'];
                }
            }

            if ($clientFields) {
                $client->update($clientFields);
                // The document keeps a copy of the applicant's name and number (lists, SMS)
                $documentFields['sender'] = mb_substr($client->refresh()->full_name, 0, 100);
                $documentFields['contact_number'] = $client->contact_number;
            }
            if ($documentFields) {
                $document->update($documentFields);
            }

            $this->auditTrailService->logDocumentAction(
                document: $document,
                action: 'Metadata Updated',
                description: "Details updated by {$actor->name}: " . implode('; ', array_map(
                    fn (array $change, string $field) => "{$change['label']}: " . $this->display($field, $change['old']) . ' → ' . $this->display($field, $change['new']),
                    $changes,
                    array_keys($changes)
                )) . (isset($changes['type_id']) ? '. The ARTA processing period follows the new document type.' : '.'),
                actor: $actor,
                ipAddress: $ipAddress
            );
        });

        return $changes;
    }

    private function normalize(mixed $value): ?string
    {
        $value = $value === null ? null : trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function display(string $field, ?string $value): string
    {
        if ($value === null) {
            return '(blank)';
        }
        if ($field === 'type_id') {
            return DocumentType::find($value)?->type_name ?? "Type #{$value}";
        }

        return '"' . mb_strimwidth($value, 0, 80, '…') . '"';
    }
}

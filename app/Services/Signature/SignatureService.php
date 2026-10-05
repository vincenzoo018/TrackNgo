<?php

namespace App\Services\Signature;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\SignatureServiceInterface;
use App\Models\DigitalSignature;
use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SignatureService implements SignatureServiceInterface
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    /**
     * Signatures are never drawn on the spot: the image HR registered for the account is stamped,
     * snapshotted with the document so later profile changes do not alter a signed record.
     */
    public function stampIfDue(Document $document, User $actor, ?string $ipAddress = null): ?DigitalSignature
    {
        if (!$document->requires_signature) {
            return null;
        }

        $signatory = $document->signatories()->where('user_id', $actor->id)->whereNull('signed_at')->first();
        if (!$signatory) {
            return null;
        }

        if (empty($actor->signature)) {
            throw ValidationException::withMessages([
                'signature' => 'Your account has no registered signature, so it cannot be stamped on this document. Ask HR to add your signature, then try again.',
            ]);
        }

        $signedAt = now();
        $fileHash = $document->attachment_path && Storage::disk('public')->exists($document->attachment_path)
            ? hash_file('sha256', Storage::disk('public')->path($document->attachment_path))
            : '';
        // Binds who signed, which file, when and with which image; any later change breaks the hash
        $hash = hash('sha256', implode('|', [
            $document->document_id, $document->reference_number, $actor->id, $fileHash, $signedAt->toIso8601String(), hash('sha256', $actor->signature),
        ]));

        // The signature belongs to the version of the file that is current now (a later version is signed again)
        $revision = $document->currentRevision()->first();

        return DB::transaction(function () use ($document, $signatory, $actor, $signedAt, $hash, $ipAddress, $revision) {
            $signature = DigitalSignature::create([
                'document_id'       => $document->document_id,
                'revision_id'       => $revision?->revision_id,
                'signed_by_user_id' => $actor->id,
                'signature_image'   => $actor->signature,
                'signature_hash'    => $hash,
                'action_type'       => 'approved',
                'ip_address'        => $ipAddress ?: (request()->ip() ?: '127.0.0.1'),
                'signed_at'         => $signedAt,
            ]);

            $signatory->update(['signature_id' => $signature->signature_id, 'signed_at' => $signedAt]);

            $total = $document->signatories()->count();
            $signed = $document->signatories()->whereNotNull('signed_at')->count();
            $role = $actor->role?->role_name;

            $this->auditTrailService->logDocumentAction(
                document: $document,
                action: 'Digital Signature Stamped',
                description: "Registered signature of {$actor->name}" . ($role ? " ({$role})" : '')
                    . ' stamped on the document' . ($revision && $revision->version_number > 1 ? " (Version {$revision->version_number})" : '')
                    . " — signature {$signed} of {$total}. SHA-256 " . substr($hash, 0, 16) . '…',
                actor: $actor,
                ipAddress: $ipAddress
            );

            if ($signed === $total) {
                $this->auditTrailService->logDocumentAction(
                    document: $document,
                    action: 'All Signatures Complete',
                    description: "All {$total} required signatures have been stamped. The final signed copy is being generated.",
                    actor: $actor,
                    ipAddress: $ipAddress
                );
            }

            return $signature;
        });
    }

    public function storeSignedCopy(int $documentId, UploadedFile $file, User $actor, ?string $ipAddress = null, ?int $signatureCount = null, ?int $version = null): Document
    {
        $document = Document::findOrFail($documentId);

        if (!$document->requires_signature) {
            throw ValidationException::withMessages(['file' => 'This document does not require signatures.']);
        }
        $total = $document->signatories()->count();
        $signed = $document->signatories()->whereNotNull('signed_at')->count();
        if ($signed === 0) {
            throw ValidationException::withMessages(['file' => 'Nobody has signed this document yet.']);
        }
        $signatureCount ??= $signed;
        if ($signatureCount < 1 || $signatureCount > $signed) {
            throw ValidationException::withMessages(['file' => 'The signed copy does not match the signatures on record. Reload the page and try again.']);
        }
        if (!$document->contentsVisibleTo($actor)) {
            throw ValidationException::withMessages(['file' => 'Only people who can open this document can generate its signed copy.']);
        }

        $path = $file->store('documents/signed', 'public');
        $fileHash = hash_file('sha256', Storage::disk('public')->path($path));
        $final = $signatureCount >= $total;

        try {
            // The copy carrying the most signatures is kept: several open browsers may build the same copy at
            // the same moment, and an older copy never replaces a newer one
            $replaced = DB::transaction(function () use ($document, $path, $fileHash, $actor, $ipAddress, $signatureCount, $total, $final, $version) {
                $locked = Document::whereKey($document->document_id)->lockForUpdate()->first();
                // Checked under the same lock a new version takes: the copy must be built from the current
                // version and carry only signatures made on it (a new version clears them)
                // (a page that does not say which version it stamped can only have had Version 1)
                if (($version ?? 1) !== $locked->currentVersionNumber()) {
                    throw ValidationException::withMessages(['file' => 'A newer version of this document was uploaded. Reload the page to stamp the signatures on it.']);
                }
                if ($signatureCount > $locked->signatories()->whereNotNull('signed_at')->count()) {
                    throw ValidationException::withMessages(['file' => 'The signed copy does not match the signatures on record. Reload the page and try again.']);
                }
                if ($locked->signed_file_path && Storage::disk('public')->exists($locked->signed_file_path)
                    && $locked->signed_copy_signatures >= $signatureCount) {
                    return false;
                }

                $previous = $locked->signed_file_path;
                $locked->update(['signed_file_path' => $path, 'signed_copy_signatures' => $signatureCount]);

                $this->auditTrailService->logDocumentAction(
                    document: $locked,
                    action: $final ? 'Final Signed Copy Generated' : 'Signed Copy Updated',
                    description: ($final
                        ? "Final copy with all {$total} signatures stamped was attached to the document."
                        : "Copy with {$signatureCount} of {$total} signatures stamped was attached to the document.")
                        . ' SHA-256 ' . substr($fileHash, 0, 16) . '…',
                    actor: $actor,
                    ipAddress: $ipAddress
                );

                return ['previous' => $previous];
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }

        if ($replaced === false) {
            Storage::disk('public')->delete($path);
        } elseif ($replaced['previous'] && $replaced['previous'] !== $path) {
            // The newer copy carries every earlier signature too
            Storage::disk('public')->delete($replaced['previous']);
        }

        return $document->refresh();
    }
}

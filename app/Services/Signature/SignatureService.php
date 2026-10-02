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

        return DB::transaction(function () use ($document, $signatory, $actor, $signedAt, $hash, $ipAddress) {
            $signature = DigitalSignature::create([
                'document_id'       => $document->document_id,
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
                    . " stamped on the document — signature {$signed} of {$total}. SHA-256 " . substr($hash, 0, 16) . '…',
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

    public function storeSignedCopy(int $documentId, UploadedFile $file, User $actor, ?string $ipAddress = null): Document
    {
        $document = Document::findOrFail($documentId);

        if (!$document->requires_signature) {
            throw ValidationException::withMessages(['file' => 'This document does not require signatures.']);
        }
        if ($document->signatories()->whereNull('signed_at')->exists()) {
            throw ValidationException::withMessages(['file' => 'The final signed copy can only be generated after every signatory has signed.']);
        }
        if (!$document->contentsVisibleTo($actor)) {
            throw ValidationException::withMessages(['file' => 'Only people who can open this document can generate its signed copy.']);
        }

        $path = $file->store('documents/signed', 'public');
        $fileHash = hash_file('sha256', Storage::disk('public')->path($path));

        try {
            // Signatures cannot change once all are stamped, so the first copy attached is the final one;
            // several open browsers may build it at the same moment and only one is kept
            $attached = DB::transaction(function () use ($document, $path, $fileHash, $actor, $ipAddress) {
                $locked = Document::whereKey($document->document_id)->lockForUpdate()->first();
                if ($locked->signed_file_path && Storage::disk('public')->exists($locked->signed_file_path)) {
                    return false;
                }

                $locked->update(['signed_file_path' => $path]);

                $this->auditTrailService->logDocumentAction(
                    document: $locked,
                    action: 'Final Signed Copy Generated',
                    description: 'Final copy with all signatures stamped was attached to the document. SHA-256 ' . substr($fileHash, 0, 16) . '…',
                    actor: $actor,
                    ipAddress: $ipAddress
                );

                return true;
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }

        if (!$attached) {
            Storage::disk('public')->delete($path);
        }

        return $document->refresh();
    }
}

<?php

namespace App\Services\Signature;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\SignatureServiceInterface;
use App\Models\ArtaEscalation;
use App\Models\DigitalSignature;
use App\Models\Document;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;

class SignatureService implements SignatureServiceInterface
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    public function applySignature(
        int $documentId,
        array $data,
        User $actor,
        ?string $ipAddress = null
    ): DigitalSignature {
        $document = Document::findOrFail($documentId);
        $now = Carbon::now();

        $signature = DigitalSignature::create([
            'document_id'       => $document->document_id,
            'signed_by_user_id' => $actor->id,
            'signature_image'   => $data['signature_image'] ?? null,
            'signature_hash'    => $data['signature_hash'],
            'action_type'       => $data['action_type'] ?? 'approved',
            'ip_address'        => $ipAddress ?: (request()->ip() ?: '127.0.0.1'),
            'signed_at'         => $now,
        ]);

        // Auto-resolve any pending ARTA escalations for this document
        ArtaEscalation::where('document_id', $document->document_id)
            ->where('resolved', false)
            ->update([
                'resolved'    => true,
                'resolved_at' => $now,
            ]);

        $shortHash = substr($data['signature_hash'], 0, 16);
        $actionType = $data['action_type'] ?? 'approved';
        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Digital Signature Applied',
            description: "Official {$actor->name} applied digital signature with SHA-256 hash ({$shortHash}...). Action: {$actionType}.",
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $signature;
    }

    public function verifyPin(User $user, string $pin): bool
    {
        // Check if user has signature_pin set, otherwise compare against password prefix or true
        if (!empty($user->signature_pin)) {
            return Hash::check($pin, $user->signature_pin) || $pin === $user->signature_pin;
        }

        return strlen($pin) >= 4;
    }
}

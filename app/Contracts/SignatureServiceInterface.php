<?php

namespace App\Contracts;

use App\Models\DigitalSignature;
use App\Models\User;

interface SignatureServiceInterface
{
    /**
     * Apply digital signature to a document with SHA-256 hash attestation and auto-resolve escalations.
     */
    public function applySignature(
        int $documentId,
        array $data,
        User $actor,
        ?string $ipAddress = null
    ): DigitalSignature;

    /**
     * Verify user PIN for digital signature authorization.
     */
    public function verifyPin(User $user, string $pin): bool;
}

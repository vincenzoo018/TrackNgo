<?php

namespace App\Contracts;

use App\Models\DigitalSignature;
use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;

interface SignatureServiceInterface
{
    /**
     * Stamp the actor's HR-registered signature if they are a signatory who has not signed yet
     * (called when they forward / approve the document). Returns null when nothing was due.
     */
    public function stampIfDue(Document $document, User $actor, ?string $ipAddress = null): ?DigitalSignature;

    /**
     * Store the final copy with every signature stamped on it (built in the browser once all have signed).
     */
    public function storeSignedCopy(int $documentId, UploadedFile $file, User $actor, ?string $ipAddress = null): Document;
}

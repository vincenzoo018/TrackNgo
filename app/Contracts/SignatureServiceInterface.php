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
     * Store the copy with the signatures stamped so far (built in the browser after each signature); a copy
     * carrying more signatures replaces the previous one. $signatureCount defaults to the signatures recorded;
     * $version is the version of the file it was built from (it must still be the current one).
     */
    public function storeSignedCopy(int $documentId, UploadedFile $file, User $actor, ?string $ipAddress = null, ?int $signatureCount = null, ?int $version = null): Document;
}

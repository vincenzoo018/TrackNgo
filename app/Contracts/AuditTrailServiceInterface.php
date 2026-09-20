<?php

namespace App\Contracts;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\User;

interface AuditTrailServiceInterface
{
    /**
     * Log a document-specific workflow action (Action Trail).
     */
    public function logDocumentAction(
        Document|int $document,
        string $action,
        string $description,
        ?User $actor = null,
        ?string $ipAddress = null
    ): AuditTrail;

    /**
     * Log an administrative, user management, or security override action.
     */
    public function logUserAction(
        string $action,
        string $description,
        ?User $actor = null,
        ?string $ipAddress = null,
        string $category = 'system'
    ): AuditTrail;

    /**
     * Build the audit trail view payload for the given user.
     */
    public function getAuditTrailPayload(User $user): array;
}

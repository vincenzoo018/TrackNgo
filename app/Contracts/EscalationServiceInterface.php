<?php

namespace App\Contracts;

use App\Models\User;

interface EscalationServiceInterface
{
    /**
     * Build the complete CART escalation payload for the given user.
     */
    public function getEscalationPayload(User $user, array $filters = []): array;

    /**
     * Resolve an escalation for a document.
     */
    public function resolveEscalation(int $documentId, array $data, User $actor, ?string $ipAddress = null): void;
}

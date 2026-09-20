<?php

namespace App\Contracts;

use App\Models\User;

interface UserServiceInterface
{
    /**
     * Get data payload for user listing.
     */
    public function getUserIndexPayload(User $actor): array;

    /**
     * Get data payload for user creation form.
     */
    public function getUserCreatePayload(): array;

    /**
     * Create a new user account with audit logging.
     */
    public function createUser(array $data, User $actor, ?string $ipAddress = null): User;

    /**
     * Update an existing user account with role-guarding and audit logging.
     */
    public function updateUser(int $userId, array $data, User $actor, ?string $ipAddress = null): User;

    /**
     * Override role and/or department permissions with audit logging.
     */
    public function overrideRole(int $userId, array $data, User $actor, ?string $ipAddress = null): User;

    /**
     * Delete a user account (Admin only) with audit logging.
     */
    public function deleteUser(int $userId, User $actor, ?string $ipAddress = null): void;
}

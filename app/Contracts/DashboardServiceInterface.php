<?php

namespace App\Contracts;

use App\Models\User;

interface DashboardServiceInterface
{
    /**
     * Build the dashboard data payload for the given user.
     */
    public function getDashboardPayload(User $user, array $filters = []): array;
}

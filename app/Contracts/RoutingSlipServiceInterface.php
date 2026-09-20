<?php

namespace App\Contracts;

use App\Models\User;

interface RoutingSlipServiceInterface
{
    /**
     * Build the complete routing slips payload for the given user,
     * including tabular data, timeline groups, metrics, and role metadata.
     *
     * @param User $user
     * @return array
     */
    public function getRoutingSlipsPayload(User $user): array;
}

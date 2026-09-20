<?php

namespace App\Contracts;

use App\Models\User;

interface ReportServiceInterface
{
    /**
     * Build the reports and compliance analytics payload for the given user.
     */
    public function getReportsPayload(User $user, array $filters = []): array;
}

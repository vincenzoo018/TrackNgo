<?php

namespace App\Contracts;

use App\Models\User;
use Illuminate\Support\Collection;

interface NotificationStrategyInterface
{
    /**
     * Retrieve active documents relevant to the given user for notification evaluation.
     */
    public function getActiveDocuments(User $user): Collection;
}

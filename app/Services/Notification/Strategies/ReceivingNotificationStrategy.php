<?php

namespace App\Services\Notification\Strategies;

use App\Contracts\NotificationStrategyInterface;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReceivingNotificationStrategy implements NotificationStrategyInterface
{
    public function getActiveDocuments(User $user): Collection
    {
        return Document::with(['type', 'department', 'currentHolderDepartment', 'submitter'])
            ->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'approved', 'archived'])
            ->where(function ($q) use ($user) {
                if ($user->department_id) {
                    $q->where('department_id', $user->department_id)
                      ->orWhere('current_holder_department_id', $user->department_id);
                }
                $q->orWhere('status', 'pending_registration')
                  ->orWhere('status', 'Received')
                  ->orWhere('status', 'Ongoing');
            })
            ->get();
    }
}

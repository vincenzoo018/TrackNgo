<?php

namespace App\Services\Notification\Strategies;

use App\Contracts\NotificationStrategyInterface;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class HrNotificationStrategy implements NotificationStrategyInterface
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
                $q->orWhereHas('type', function ($tq) {
                    $tq->where('type_name', 'like', '%Leave%')
                       ->orWhere('type_name', 'like', '%Personnel%')
                       ->orWhere('type_name', 'like', '%Employment%')
                       ->orWhere('type_name', 'like', '%HR%');
                });
            })
            ->get();
    }
}

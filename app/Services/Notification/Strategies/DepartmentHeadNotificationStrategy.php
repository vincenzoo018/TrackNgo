<?php

namespace App\Services\Notification\Strategies;

use App\Contracts\NotificationStrategyInterface;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DepartmentHeadNotificationStrategy implements NotificationStrategyInterface
{
    public function getActiveDocuments(User $user): Collection
    {
        $query = Document::with(['type', 'department', 'currentHolderDepartment', 'submitter'])
            ->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'archived'])
            ->where(function ($q) use ($user) {
                $q->where('current_holder_id', $user->id)
                  ->orWhere('submitted_by', $user->id);
                if ($user->department_id) {
                    $q->orWhere('department_id', $user->department_id)
                      ->orWhere('current_holder_department_id', $user->department_id);
                }
            });

        return $query->get();
    }
}

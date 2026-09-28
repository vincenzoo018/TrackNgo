<?php

namespace App\Services\Notification\Strategies;

use App\Contracts\NotificationStrategyInterface;
use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MayorNotificationStrategy implements NotificationStrategyInterface
{
    public function getActiveDocuments(User $user): Collection
    {
        return Document::with(['type', 'department', 'currentHolderDepartment', 'submitter'])
            ->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'archived'])
            ->where(function ($q) use ($user) {
                $q->where('current_holder_id', $user->id)
                  ->orWhere('submitted_by', $user->id)
                  ->orWhereIn('current_step_index', [4, 5, 6])
                  ->orWhereHas('currentHolderDepartment', function ($dq) {
                      $dq->where('department_name', 'like', '%Mayor%');
                  })
                  ->orWhere('is_escalated', true);
            })
            ->get();
    }
}

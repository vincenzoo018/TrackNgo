<?php

namespace App\Services\Audit;

use App\Models\AuditTrail;
use App\Models\User;
use Illuminate\Support\Collection;

class AuditTrailRepository
{
    /**
     * Get system trail logs scoped to the user's role.
     */
    public function getSystemLogs(User $user, bool $isFullAccess, int $limit = 200): Collection
    {
        $query = AuditTrail::with(['user.role', 'user.department'])
            ->where('category', 'system');

        if (!$isFullAccess) {
            $query->where('user_id', $user->id);
        }

        return $query->orderBy('timestamp', 'desc')->take($limit)->get();
    }

    /**
     * Get action trail logs scoped to the user's role.
     */
    public function getActionLogs(User $user, bool $isFullAccess, int $limit = 300): Collection
    {
        $query = AuditTrail::with(['user.role', 'user.department', 'document.department'])
            ->where('category', 'action');

        if (!$isFullAccess) {
            $query->where(function ($q) use ($user) {
                // User's own workflow actions
                $q->where('user_id', $user->id)
                    // OR related document events
                    ->orWhereHas('document', function ($docQuery) use ($user) {
                        $docQuery->where('submitted_by', $user->id);
                        if ($user->department_id) {
                            $docQuery->orWhere('department_id', $user->department_id)
                                     ->orWhere('current_holder_department_id', $user->department_id)
                                     ->orWhereHas('routingSlips', function ($rQuery) use ($user) {
                                         $rQuery->where('target_department_id', $user->department_id)
                                                ->orWhere('from_department_id', $user->department_id);
                                     });
                        }
                    });
            });
        }

        return $query->orderBy('timestamp', 'desc')->take($limit)->get();
    }
}

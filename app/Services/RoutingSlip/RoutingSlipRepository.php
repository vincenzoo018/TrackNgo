<?php

namespace App\Services\RoutingSlip;

use App\Models\RoutingSlip;
use App\Models\User;
use Illuminate\Support\Collection;

class RoutingSlipRepository
{
    /**
     * Query routing slips scoped to the authorized user's role and departmental access.
     *
     * @param User $user
     * @return Collection<RoutingSlip>
     */
    public function getSlipsForUser(User $user): Collection
    {
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        $query = RoutingSlip::with([
            'document.department',
            'document.type',
            'document.submitter.role',
            'fromUser.role',
            'fromUser.department',
            'toUser.role',
            'toUser.department',
            'fromDepartment',
            'targetDepartment',
            'receiver',
        ]);

        if (!$isFullAccess) {
            $query->where(function ($q) use ($user) {
                // User is directly involved as sender or recipient
                $q->where('from_user_id', $user->id)
                  ->orWhere('to_user_id', $user->id);

                // Department involvement (origin or destination)
                if ($user->department_id) {
                    $q->orWhere('from_department_id', $user->department_id)
                      ->orWhere('target_department_id', $user->department_id);
                }

                // Relevant to user's documents (submitted or held)
                $q->orWhereHas('document', function ($docQuery) use ($user) {
                    $docQuery->where('submitted_by', $user->id)
                             ->orWhere('current_holder_id', $user->id);

                    if ($user->department_id) {
                        $docQuery->orWhere('department_id', $user->department_id)
                                 ->orWhere('current_holder_department_id', $user->department_id);
                    }
                });
            });
        }

        return $query->orderBy('slip_id', 'desc')->get();
    }
}

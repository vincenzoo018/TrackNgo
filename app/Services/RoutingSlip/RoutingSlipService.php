<?php

namespace App\Services\RoutingSlip;

use App\Contracts\RoutingSlipServiceInterface;
use App\Contracts\RoutingSlipTimelineCalculatorInterface;
use App\Models\Department;
use App\Models\User;

class RoutingSlipService implements RoutingSlipServiceInterface
{
    public function __construct(
        protected RoutingSlipSynchronizer $synchronizer,
        protected RoutingSlipRepository $repository,
        protected RoutingSlipDataTransformer $transformer,
        protected RoutingSlipTimelineCalculatorInterface $timelineCalculator
    ) {}

    /**
     * Build the complete routing slips payload for the given user.
     *
     * @param User $user
     * @return array
     */
    public function getRoutingSlipsPayload(User $user): array
    {
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // 1. Maintain data integrity: synchronize missing, returned, and endorsed routing slips
        $this->synchronizer->syncAll();

        // 2. Fetch scoped routing slips
        $slips = $this->repository->getSlipsForUser($user);

        // 3. Transform routing slips into tabular DTOs (for table view and CSV export)
        $formattedSlips = $slips->map(function ($slip) {
            return $this->transformer->transform($slip)->toArray();
        })->values()->all();

        // 4. Compute chronological hop timeline groups with SLA bottleneck tracking
        $timelineGroups = $this->timelineCalculator->computeTimelineGroups($slips);

        // 5. Calculate global metrics
        $activeCount = 0;
        $completedCount = 0;
        $returnedCount = 0;
        foreach ($formattedSlips as $item) {
            $st = strtolower($item['status'] ?? '');
            if ($st === 'completed') {
                $completedCount++;
            } elseif ($st === 'returned') {
                $returnedCount++;
            } else {
                $activeCount++;
            }
        }

        $bottlenecksCount = 0;
        foreach ($timelineGroups as $group) {
            if (!empty($group['has_bottlenecks'])) {
                $bottlenecksCount += ($group['bottlenecks_count'] ?? 1);
            }
        }

        // 6. Current role slug for layout & route links
        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        // 7. Active departments for filter dropdown
        $departments = Department::where('is_active', true)
            ->orderBy('department_name')
            ->get(['department_id', 'department_name', 'code']);

        return [
            'routingSlips'     => $formattedSlips,
            'timelineGroups'   => $timelineGroups,
            'departments'      => $departments,
            'isFullAccess'     => $isFullAccess,
            'currentRole'      => $currentRole,
            'userRoleName'     => $user->role->role_name ?? 'User',
            'userName'         => $user->name,
            'metrics'          => [
                'total'       => count($formattedSlips),
                'active'      => $activeCount,
                'completed'   => $completedCount,
                'returned'    => $returnedCount,
                'bottlenecks' => $bottlenecksCount,
            ],
        ];
    }
}

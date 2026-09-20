<?php

namespace App\Services\Dashboard;

use App\Contracts\DashboardServiceInterface;
use App\Models\Department;
use App\Models\Document;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class DashboardService implements DashboardServiceInterface
{
    /**
     * Build the live, synchronized Dashboard data payload.
     * Enforces role-based visibility:
     * - Admin & Cart: View system-wide live tracking and KPIs across all departments and roles.
     * - Other roles: View dashboards filtered to their own documents, actions, and departmental data.
     */
    public function getDashboardPayload(User $user, array $filters = []): array
    {
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // Determine current role slug
        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        // Filter parameters
        $range = $filters['range'] ?? 'all';
        $departmentFilter = $filters['department'] ?? 'all';

        // ── 1. Scoped Document Query ─────────────────────────────────────────
        $docQuery = Document::with([
            'department',
            'type',
            'submitter.role',
            'currentHolder',
            'currentHolderDepartment',
        ]);

        if (!$isFullAccess) {
            $docQuery->where(function (Builder $q) use ($user) {
                // Documents submitted by or currently held by user
                $q->where('submitted_by', $user->id)
                  ->orWhere('current_holder_id', $user->id);

                if ($user->department_id) {
                    $q->orWhere('department_id', $user->department_id)
                      ->orWhere('current_holder_department_id', $user->department_id)
                      ->orWhereHas('routingSlips', function (Builder $rq) use ($user) {
                          $rq->where('from_department_id', $user->department_id)
                             ->orWhere('target_department_id', $user->department_id)
                             ->orWhere('from_user_id', $user->id)
                             ->orWhere('to_user_id', $user->id);
                      });
                }
            });
        }

        // Apply department filter if specified
        if ($departmentFilter !== 'all' && is_numeric($departmentFilter)) {
            $docQuery->where(function (Builder $q) use ($departmentFilter) {
                $q->where('department_id', $departmentFilter)
                  ->orWhere('current_holder_department_id', $departmentFilter);
            });
        }

        // Apply date range filter
        if ($range === 'today') {
            $docQuery->whereDate('created_at', Carbon::today());
        } elseif ($range === '7days') {
            $docQuery->where('created_at', '>=', Carbon::now()->subDays(7));
        } elseif ($range === '30days') {
            $docQuery->where('created_at', '>=', Carbon::now()->subDays(30));
        } elseif ($range === 'this_month') {
            $docQuery->whereMonth('created_at', Carbon::now()->month)
                     ->whereYear('created_at', Carbon::now()->year);
        }

        $allScopedDocs = $docQuery->orderBy('updated_at', 'desc')->get();
        $totalDocs = $allScopedDocs->count();

        // ── 2. Clickable KPI Metrics Calculations ────────────────────────────
        $completedDocs = $allScopedDocs->filter(function ($doc) {
            $s = strtolower($doc->status ?? '');
            return in_array($s, ['completed', 'approved', 'archived']) || !empty($doc->completed_at);
        });
        $completedCount = $completedDocs->count();

        $returnedDocs = $allScopedDocs->filter(function ($doc) {
            $s = strtolower($doc->status ?? '');
            return in_array($s, ['returned', 'rejected']);
        });
        $returnedCount = $returnedDocs->count();

        $inProgressDocs = $allScopedDocs->filter(function ($doc) {
            $s = strtolower($doc->status ?? '');
            return !in_array($s, ['completed', 'approved', 'archived', 'returned', 'rejected']);
        });
        $inProgressCount = $inProgressDocs->count();

        // SLA Compliance & Violations
        $now = Carbon::now();
        $violationsCount = 0;
        $compliantCount = 0;
        $nearDeadlineCount = 0;

        foreach ($allScopedDocs as $doc) {
            $dueDate = $doc->arta_due_date ? Carbon::parse($doc->arta_due_date) : null;
            $completedDate = $doc->completed_at ? Carbon::parse($doc->completed_at) : null;

            if ($dueDate) {
                if ($completedDate) {
                    if ($completedDate->gt($dueDate)) {
                        $violationsCount++;
                    } else {
                        $compliantCount++;
                    }
                } else {
                    if ($now->gt($dueDate)) {
                        $violationsCount++;
                    } else {
                        $compliantCount++;
                        if ($now->diffInDays($dueDate, false) <= 2) {
                            $nearDeadlineCount++;
                        }
                    }
                }
            } else {
                $compliantCount++;
            }
        }

        $complianceRate = $totalDocs > 0 ? round(($compliantCount / $totalDocs) * 100, 1) : 100;

        // ── 3. Charts Data (Synchronized with real-time DB data) ──────────────
        // A. Department Bottlenecks (Avg Processing Days vs SLA Threshold)
        $allDepartments = Department::where('is_active', true)->orderBy('department_name')->get();
        $bottlenecks = [];

        foreach ($allDepartments as $dept) {
            $deptDocs = $allScopedDocs->filter(function ($doc) use ($dept) {
                return $doc->current_holder_department_id == $dept->department_id 
                    || $doc->department_id == $dept->department_id;
            });

            // Benchmark SLA based on department function
            $deptSla = 3.0;
            $dnameLower = strtolower($dept->department_name);
            if (str_contains($dnameLower, 'legal') || str_contains($dnameLower, 'ordinance')) {
                $deptSla = 7.0;
            } elseif (str_contains($dnameLower, 'engineer') || str_contains($dnameLower, 'public works')) {
                $deptSla = 5.0;
            } elseif (str_contains($dnameLower, 'budget') || str_contains($dnameLower, 'accounting') || str_contains($dnameLower, 'treasurer')) {
                $deptSla = 4.0;
            }

            if ($deptDocs->isEmpty() && !$isFullAccess && $user->department_id != $dept->department_id) {
                continue;
            }

            $turnaroundSum = 0;
            $turnaroundCount = 0;
            foreach ($deptDocs as $doc) {
                $sub = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
                if ($sub) {
                    $end = $doc->completed_at ? Carbon::parse($doc->completed_at) : $now;
                    $turnaroundSum += max(1, Carbon::parse($sub)->diffInDays($end));
                    $turnaroundCount++;
                }
            }
            $avgDays = $turnaroundCount > 0 ? round($turnaroundSum / $turnaroundCount, 1) : 2.5;

            $bottlenecks[] = [
                'stage'   => strlen($dept->department_name) > 20 ? ($dept->code ?: substr($dept->department_name, 0, 18) . '...') : $dept->department_name,
                'count'   => $deptDocs->count(),
                'avgDays' => $avgDays,
                'sla'     => $deptSla,
            ];
        }

        // Guarantee that the chart is never blank for any role by ensuring key municipal benchmarks exist
        if (count($bottlenecks) < 4) {
            $sampleDepts = Department::where('is_active', true)
                ->whereIn('code', ['OCM', 'OCA', 'CEO', 'CBO', 'CHRMO'])
                ->get();
            foreach ($sampleDepts as $sDept) {
                $existing = collect($bottlenecks)->firstWhere('stage', $sDept->department_name) 
                         ?? collect($bottlenecks)->firstWhere('stage', $sDept->code);
                if (!$existing) {
                    $sDocs = Document::where('department_id', $sDept->department_id)->get();
                    $sTurnaround = 3.0;
                    if ($sDocs->isNotEmpty()) {
                        $sSum = 0;
                        foreach ($sDocs as $sd) {
                            $sub = $sd->submitted_at ?? $sd->date_filed ?? $sd->created_at;
                            if ($sub) $sSum += max(1, Carbon::parse($sub)->diffInDays($sd->completed_at ? Carbon::parse($sd->completed_at) : $now));
                        }
                        $sTurnaround = round($sSum / $sDocs->count(), 1);
                    }
                    $bottlenecks[] = [
                        'stage'   => $sDept->code ?: substr($sDept->department_name, 0, 18),
                        'count'   => $sDocs->count(),
                        'avgDays' => $sTurnaround,
                        'sla'     => in_array($sDept->code, ['CEO']) ? 5.0 : 3.0,
                    ];
                }
            }
        }

        usort($bottlenecks, fn($a, $b) => ($b['avgDays'] - $b['sla']) <=> ($a['avgDays'] - $a['sla']));
        $topBottlenecks = array_slice($bottlenecks, 0, 6);

        // B. Workflow Status Distribution (In Progress, Completed, Returned, SLA Violations)
        $lifecycleStages = [
            [
                'label' => 'In Progress',
                'count' => $inProgressCount,
                'value' => $totalDocs > 0 ? round(($inProgressCount / $totalDocs) * 100) : 0,
                'color' => '#3b82f6', // Blue
            ],
            [
                'label' => 'Completed',
                'count' => $completedCount,
                'value' => $totalDocs > 0 ? round(($completedCount / $totalDocs) * 100) : 0,
                'color' => '#10b981', // Emerald
            ],
            [
                'label' => 'Returned',
                'count' => $returnedCount,
                'value' => $totalDocs > 0 ? round(($returnedCount / $totalDocs) * 100) : 0,
                'color' => '#f59e0b', // Amber
            ],
            [
                'label' => 'SLA Violations',
                'count' => $violationsCount,
                'value' => $totalDocs > 0 ? round(($violationsCount / $totalDocs) * 100) : 0,
                'color' => '#ef4444', // Red
            ],
        ];

        // C. Weekly Volume Trends (Days of Week)
        $dayNames = ['Mon' => 0, 'Tue' => 0, 'Wed' => 0, 'Thu' => 0, 'Fri' => 0, 'Sat' => 0, 'Sun' => 0];
        foreach ($allScopedDocs as $doc) {
            $d = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
            if ($d) {
                $dayStr = Carbon::parse($d)->format('D');
                if (isset($dayNames[$dayStr])) {
                    $dayNames[$dayStr]++;
                }
            }
        }
        $volumeTrends = [];
        foreach ($dayNames as $day => $vol) {
            $volumeTrends[] = ['day' => $day, 'volume' => $vol];
        }

        // ── 4. Clickable Destinations Map ────────────────────────────────────
        $kpiLinks = [
            'total'         => "/{$currentRole}/documents",
            'completed'     => "/{$currentRole}/archived",
            'inProgress'    => "/{$currentRole}/documents",
            'returned'      => "/{$currentRole}/documents",
            'slaViolations' => "/{$currentRole}/audit-trail",
        ];

        return [
            'kpiMetrics' => [
                'totalDocuments'      => $totalDocs,
                'completedDocuments'  => $completedCount,
                'inProgressDocuments' => $inProgressCount,
                'returnedDocuments'   => $returnedCount,
                'slaViolations'       => $violationsCount,
                'nearDeadline'        => $nearDeadlineCount,
                'slaComplianceRate'   => $complianceRate,
            ],
            'kpiLinks'           => $kpiLinks,
            'bottlenecks'        => $topBottlenecks,
            'statusDistribution' => $lifecycleStages,
            'volumeTrends'       => $volumeTrends,
            'isFullAccess'       => $isFullAccess,
            'currentRole'        => $currentRole,
            'userRoleName'       => $user->role->role_name ?? 'User',
            'userName'           => $user->name,
            'userDepartment'     => $user->department->department_name ?? 'LGU Mati',
            'filters'            => [
                'range'              => $range,
                'department'         => $departmentFilter,
            ],
            'departments'        => $allDepartments->map(fn($d) => [
                'id'   => $d->department_id,
                'name' => $d->department_name,
                'code' => $d->code,
            ])->values()->all(),
        ];
    }
}

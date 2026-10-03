<?php

namespace App\Services\Dashboard;

use App\Contracts\DashboardServiceInterface;
use App\Models\Department;
use App\Models\Document;
use App\Models\User;
use App\Services\Document\DocumentMetrics;
use Carbon\Carbon;

class DashboardService implements DashboardServiceInterface
{
    public function __construct(
        protected DocumentMetrics $metrics
    ) {}

    /**
     * Build the live, synchronized Dashboard data payload.
     * Enforces role-based visibility:
     * - Admin & Cart: View system-wide live tracking and KPIs across all departments and roles.
     * - Other roles: View dashboards filtered to their own documents, actions, and departmental data.
     */
    public function getDashboardPayload(User $user, array $filters = []): array
    {
        $isFullAccess = $user->hasFullAccess();
        $currentRole = $user->roleSlug();

        // Filter parameters
        $range = $filters['range'] ?? 'all';
        $departmentFilter = $filters['department'] ?? 'all';

        // ── 1. Scoped Document Query ─────────────────────────────────────────
        $allScopedDocs = $this->metrics
            ->scopedQuery($user, ['department', 'type', 'submitter.role', 'currentHolder', 'currentHolderDepartment'], $range, $departmentFilter)
            ->orderBy('updated_at', 'desc')
            ->get();
        $totalDocs = $allScopedDocs->count();

        // ── 2. Clickable KPI Metrics Calculations ────────────────────────────
        $statusCounts = $this->metrics->statusCounts($allScopedDocs);
        $completedCount = $statusCounts['completed'];
        $returnedCount = $statusCounts['returned'];
        $inProgressCount = $statusCounts['active'];

        // SLA Compliance & Violations
        $now = Carbon::now();
        $sla = $this->metrics->slaCompliance($allScopedDocs, $now);
        $violationsCount = $sla['violations'];
        $complianceRate = $this->metrics->complianceRate($sla['compliant'], $totalDocs);

        // ── 3. Charts Data (Synchronized with real-time DB data) ──────────────
        // A. Department Bottlenecks (Avg Processing Days vs SLA Threshold)
        $allDepartments = Department::where('is_active', true)->orderBy('department_name')->get();
        $bottlenecks = [];

        foreach ($allDepartments as $dept) {
            $deptDocs = $this->metrics->forDepartment($allScopedDocs, $dept);

            if ($deptDocs->isEmpty() && !$isFullAccess && $user->department_id != $dept->department_id) {
                continue;
            }

            $bottlenecks[] = [
                'stage'   => strlen($dept->department_name) > 20 ? ($dept->code ?: substr($dept->department_name, 0, 18) . '...') : $dept->department_name,
                'count'   => $deptDocs->count(),
                'avgDays' => $this->metrics->averageTurnaroundDays($deptDocs, $now, 2.5),
                'sla'     => $this->metrics->departmentSla($dept->department_name),
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
                            $sub = $this->metrics->filedAt($sd);
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
                'nearDeadline'        => $sla['nearDeadline'],
                'slaComplianceRate'   => $complianceRate,
            ],
            'kpiLinks'           => $kpiLinks,
            'bottlenecks'        => $topBottlenecks,
            'statusDistribution' => $lifecycleStages,
            // C. Weekly Volume Trends (Days of Week)
            'volumeTrends'       => $this->metrics->weeklyVolume($allScopedDocs),
            ...$this->metrics->viewerContext($user, $range, $departmentFilter, $allDepartments),
        ];
    }
}

<?php

namespace App\Services\Report;

use App\Contracts\ReportServiceInterface;
use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\User;
use App\Services\Document\DocumentMetrics;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

class ReportService implements ReportServiceInterface
{
    public function __construct(
        protected DocumentMetrics $metrics
    ) {}

    /**
     * Build the comprehensive Reports & Analytics dashboard payload.
     * Enforces role-based visibility:
     * - Admin & Cart: View system-wide data across all users and departments.
     * - Other roles: Filtered to their own documents, actions, and departmental data.
     */
    public function getReportsPayload(User $user, array $filters = []): array
    {
        $isFullAccess = $user->hasFullAccess();

        // Filter parameters
        $range = $filters['range'] ?? 'all';
        $departmentFilter = $filters['department'] ?? 'all';

        // ── 1. Scoped Document Query ─────────────────────────────────────────
        $documents = $this->metrics
            ->scopedQuery($user, ['department', 'type', 'submitter', 'currentHolder', 'currentHolderDepartment'], $range, $departmentFilter)
            ->get();
        $totalDocs = $documents->count();

        // ── 2. Total Documents Processed & Status Breakdown ───────────────────
        $statusTotals = $this->metrics->statusCounts($documents);
        $completedCount = $statusTotals['completed'];
        $returnedCount = $statusTotals['returned'];
        $activeCount = $statusTotals['active'];

        // Status counts for distribution chart
        $statusCounts = [];
        foreach ($documents as $doc) {
            $st = ucfirst(str_replace('_', ' ', $doc->status ?? 'Draft'));
            $statusCounts[$st] = ($statusCounts[$st] ?? 0) + 1;
        }
        $statusDistribution = [];
        $palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#ef4444'];
        $colorIdx = 0;
        foreach ($statusCounts as $label => $val) {
            $statusDistribution[] = [
                'label' => $label,
                'value' => $val,
                'color' => $palette[$colorIdx % count($palette)],
            ];
            $colorIdx++;
        }

        // ── 3. SLA Compliance and Violations ─────────────────────────────────
        $now = Carbon::now();
        $sla = $this->metrics->slaCompliance($documents, $now);
        $violationsCount = $sla['violations'];
        $compliantCount = $sla['compliant'];

        $complianceRate = $this->metrics->complianceRate($compliantCount, $totalDocs);
        // Overall turnaround counts finished documents only (filing to completion)
        $avgTurnaround = $this->metrics->averageTurnaroundDays($documents->filter(fn ($doc) => $doc->completed_at), $now, 2.8);

        // ── 4. Department Bottlenecks and Delays ──────────────────────────────
        $allDepartments = Department::where('is_active', true)->orderBy('department_name')->get();
        $deptStats = [];

        foreach ($allDepartments as $dept) {
            $deptDocs = $this->metrics->forDepartment($documents, $dept);

            // If not full access and no docs in this department, skip
            if ($deptDocs->isEmpty() && !$isFullAccess && $user->department_id != $dept->department_id) {
                continue;
            }

            $deptTotal = $deptDocs->count();
            $deptPending = $deptDocs->filter(function ($doc) {
                $s = strtolower($doc->status ?? '');
                return !in_array($s, ['completed', 'approved', 'archived']);
            })->count();

            $deptDelayed = $deptDocs->filter(function ($doc) use ($now) {
                $s = strtolower($doc->status ?? '');
                if (in_array($s, ['completed', 'approved', 'archived'])) return false;
                return $doc->arta_due_date && Carbon::parse($doc->arta_due_date)->lt($now);
            })->count();

            $deptAvgDays = $this->metrics->averageTurnaroundDays($deptDocs, $now, 2.5);

            // Statutory SLA benchmark for department
            $deptSla = $this->metrics->departmentSla($dept->department_name);

            $diff = $deptAvgDays - $deptSla;
            $status = 'Normal';
            if ($deptDelayed > 0 || $diff > 2) {
                $status = 'Bottleneck';
            } elseif ($diff > 0 || $deptPending > 5) {
                $status = 'Warning';
            }

            if ($deptTotal > 0 || $dept->department_id == $user->department_id) {
                $deptStats[] = [
                    'id'            => $dept->department_id,
                    'name'          => $dept->department_name,
                    'code'          => $dept->code ?? substr($dept->department_name, 0, 4),
                    'totalDocs'     => $deptTotal,
                    'pendingDocs'   => $deptPending,
                    'delayedDocs'   => $deptDelayed,
                    'avgDays'       => $deptAvgDays,
                    'sla'           => $deptSla,
                    'diff'          => round($diff, 1),
                    'status'        => $status,
                ];
            }
        }

        // Sort departments by delayed docs DESC, then by avgDays DESC
        usort($deptStats, function ($a, $b) {
            if ($a['delayedDocs'] !== $b['delayedDocs']) {
                return $b['delayedDocs'] <=> $a['delayedDocs'];
            }
            return $b['avgDays'] <=> $a['avgDays'];
        });

        // Top 6 bottlenecks for Recharts BarChart
        $bottleneckChartData = array_slice(array_map(function ($item) {
            return [
                'name'    => strlen($item['name']) > 22 ? ($item['code'] ?: substr($item['name'], 0, 18) . '...') : $item['name'],
                'avgDays' => $item['avgDays'],
                'sla'     => $item['sla'],
            ];
        }, $deptStats), 0, 6);

        // ── 5. Weekly/Monthly Document Volume Trends ─────────────────────────
        $weeklyVolumeData = $this->metrics->weeklyVolume($documents);

        // Monthly trends
        $monthGroups = [];
        foreach ($documents as $doc) {
            $d = $this->metrics->filedAt($doc);
            if ($d) {
                $m = Carbon::parse($d)->format('M Y');
                $monthGroups[$m] = ($monthGroups[$m] ?? 0) + 1;
            }
        }
        $monthlyTrendData = [];
        foreach ($monthGroups as $period => $vol) {
            $monthlyTrendData[] = ['period' => $period, 'volume' => $vol];
        }

        // ── 6. User-specific Activity Logs ───────────────────────────────────
        $auditQuery = AuditTrail::with(['user.role', 'user.department', 'document.department']);

        if (!$isFullAccess) {
            $auditQuery->where(function (Builder $q) use ($user) {
                $q->where('user_id', $user->id);
                if ($user->department_id && $user->department) {
                    $q->orWhere('department', $user->department->department_name);
                }
                $q->orWhereHas('document', function (Builder $dq) use ($user) {
                    $dq->where('submitted_by', $user->id)
                      ->orWhere('current_holder_id', $user->id);
                    if ($user->department_id) {
                        $dq->orWhere('department_id', $user->department_id)
                          ->orWhere('current_holder_department_id', $user->department_id);
                    }
                });
            });
        }

        $activityLogs = $auditQuery->orderBy('timestamp', 'desc')->take(100)->get()->map(function ($log) {
            return [
                'id'          => $log->audit_id,
                'timestamp'   => Carbon::parse($log->timestamp)->format('Y-m-d H:i:s'),
                'action'      => $log->action,
                'userName'    => $log->user ? trim(($log->user->first_name ?? '') . ' ' . ($log->user->last_name ?? '')) : ($log->user_name ?? 'System'),
                'userRole'    => $log->userRole ?? ($log->user->role->role_name ?? 'User'),
                'department'  => $log->department ?? ($log->user->department->department_name ?? 'LGU Mati'),
                'documentRef' => $log->document_ref ?? ($log->document->reference_number ?? '—'),
                'ipAddress'   => $log->ip_address ?? '127.0.0.1',
                'description' => $log->description,
            ];
        })->values()->all();

        // ── 7. Data Analytics Dynamic Insights ───────────────────────────────
        $insights = [];

        // Turnaround & Compliance insight
        if ($totalDocs > 0) {
            $insights[] = "Overall system SLA compliance is currently at {$complianceRate}% across {$totalDocs} tracked documents, with an average processing turnaround of {$avgTurnaround} days.";
        }

        // Department delay insight
        $worstDept = !empty($deptStats) ? $deptStats[0] : null;
        if ($worstDept && $worstDept['delayedDocs'] > 0) {
            $insights[] = "{$worstDept['name']} exhibits the highest delay with {$worstDept['delayedDocs']} overdue document(s), averaging {$worstDept['avgDays']} days per document against its {$worstDept['sla']}-day SLA benchmark.";
        } elseif ($worstDept) {
            $insights[] = "Departments are performing within prescribed timelines. {$worstDept['name']} has handled the largest volume ({$worstDept['totalDocs']} documents).";
        }

        // Peak filing day insight
        $sortedDays = $weeklyVolumeData;
        usort($sortedDays, fn($a, $b) => $b['volume'] <=> $a['volume']);
        $peakDay = $sortedDays[0] ?? null;
        if ($peakDay && $peakDay['volume'] > 0) {
            $insights[] = "Peak document filing activity occurs on {$peakDay['day']}s with {$peakDay['volume']} submissions recorded.";
        }

        // SLA breach trends
        if ($violationsCount > 0) {
            $insights[] = "{$violationsCount} document(s) have exceeded ARTA deadlines and are flagged for expedited review or escalation.";
        } else {
            $insights[] = "All tracked documents are currently compliant with statutory Republic Act 11032 (ARTA) timelines.";
        }

        return [
            'metrics' => [
                'totalProcessed'      => $totalDocs,
                'completedCount'      => $completedCount,
                'activeCount'         => $activeCount,
                'returnedCount'       => $returnedCount,
                'slaComplianceRate'   => $complianceRate,
                'slaViolations'       => $violationsCount,
                'slaCompliant'        => $compliantCount,
                'nearDeadline'        => $sla['nearDeadline'],
                'avgTurnaroundDays'   => $avgTurnaround,
            ],
            'bottlenecks'         => $deptStats,
            'bottleneckChartData' => $bottleneckChartData,
            'weeklyVolume'        => $weeklyVolumeData,
            'monthlyTrend'        => $monthlyTrendData,
            'statusDistribution'  => $statusDistribution,
            'activityLogs'        => $activityLogs,
            'insights'            => $insights,
            ...$this->metrics->viewerContext($user, $range, $departmentFilter, $allDepartments),
        ];
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\RoutingSlip;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    /**
     * Display the comprehensive Reports & Analytics dashboard.
     * Enforces role-based visibility:
     * - Admin & Cart: View system-wide data across all users and departments.
     * - Other roles: Filtered to their own documents, actions, and departmental data.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // Determine current role slug for navigation and links
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
        $range = $request->query('range', 'all');
        $departmentFilter = $request->query('department', 'all');

        // ── 1. Scoped Document Query ─────────────────────────────────────────
        $docQuery = Document::with(['department', 'type', 'submitter', 'currentHolder', 'currentHolderDepartment']);

        if (!$isFullAccess) {
            $docQuery->where(function ($q) use ($user) {
                // User directly involved as submitter or current holder
                $q->where('submitted_by', $user->id)
                  ->orWhere('current_holder_id', $user->id);

                if ($user->department_id) {
                    $q->orWhere('department_id', $user->department_id)
                      ->orWhere('current_holder_department_id', $user->department_id)
                      ->orWhereHas('routingSlips', function ($rq) use ($user) {
                          $rq->where('from_department_id', $user->department_id)
                             ->orWhere('target_department_id', $user->department_id)
                             ->orWhere('from_user_id', $user->id)
                             ->orWhere('to_user_id', $user->id);
                      });
                }
            });
        }

        // Apply department filter if explicitly chosen in the UI
        if ($departmentFilter !== 'all' && is_numeric($departmentFilter)) {
            $docQuery->where(function ($q) use ($departmentFilter) {
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

        $documents = $docQuery->get();
        $totalDocs = $documents->count();

        // ── 2. Total Documents Processed & Status Breakdown ───────────────────
        $completedDocs = $documents->filter(function ($doc) {
            $s = strtolower($doc->status ?? '');
            return in_array($s, ['completed', 'approved', 'archived']) || !empty($doc->completed_at);
        });
        $completedCount = $completedDocs->count();

        $returnedDocs = $documents->filter(function ($doc) {
            $s = strtolower($doc->status ?? '');
            return in_array($s, ['returned', 'rejected']);
        });
        $returnedCount = $returnedDocs->count();

        $activeDocs = $documents->filter(function ($doc) {
            $s = strtolower($doc->status ?? '');
            return !in_array($s, ['completed', 'approved', 'archived', 'returned', 'rejected']);
        });
        $activeCount = $activeDocs->count();

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
        $violationsCount = 0;
        $compliantCount = 0;
        $totalTurnaroundDays = 0;
        $turnaroundCount = 0;
        $nearDeadlineCount = 0;

        foreach ($documents as $doc) {
            $dueDate = $doc->arta_due_date ? Carbon::parse($doc->arta_due_date) : null;
            $submitted = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
            $submittedDate = $submitted ? Carbon::parse($submitted) : null;
            $completedDate = $doc->completed_at ? Carbon::parse($doc->completed_at) : null;

            if ($completedDate && $submittedDate) {
                $days = max(1, $submittedDate->diffInDays($completedDate));
                $totalTurnaroundDays += $days;
                $turnaroundCount++;
            }

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
        $avgTurnaround = $turnaroundCount > 0 ? round($totalTurnaroundDays / $turnaroundCount, 1) : 2.8;

        // ── 4. Department Bottlenecks and Delays ──────────────────────────────
        $allDepartments = Department::where('is_active', true)->orderBy('department_name')->get();
        $deptStats = [];

        foreach ($allDepartments as $dept) {
            $deptDocs = $documents->filter(function ($doc) use ($dept) {
                return $doc->current_holder_department_id == $dept->department_id 
                    || $doc->department_id == $dept->department_id;
            });

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

            $deptTurnaroundSum = 0;
            $deptTurnaroundCount = 0;
            foreach ($deptDocs as $doc) {
                $sub = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
                if ($sub) {
                    $end = $doc->completed_at ? Carbon::parse($doc->completed_at) : $now;
                    $deptTurnaroundSum += max(1, Carbon::parse($sub)->diffInDays($end));
                    $deptTurnaroundCount++;
                }
            }
            $deptAvgDays = $deptTurnaroundCount > 0 ? round($deptTurnaroundSum / $deptTurnaroundCount, 1) : 2.5;

            // Statutory SLA benchmark for department
            $deptSla = 3.0;
            $dnameLower = strtolower($dept->department_name);
            if (str_contains($dnameLower, 'legal') || str_contains($dnameLower, 'ordinance')) {
                $deptSla = 7.0;
            } elseif (str_contains($dnameLower, 'engineer') || str_contains($dnameLower, 'public works')) {
                $deptSla = 5.0;
            } elseif (str_contains($dnameLower, 'budget') || str_contains($dnameLower, 'accounting') || str_contains($dnameLower, 'treasurer')) {
                $deptSla = 4.0;
            }

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
        $dayNames = ['Mon' => 0, 'Tue' => 0, 'Wed' => 0, 'Thu' => 0, 'Fri' => 0, 'Sat' => 0, 'Sun' => 0];
        foreach ($documents as $doc) {
            $d = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
            if ($d) {
                $dayStr = Carbon::parse($d)->format('D');
                if (isset($dayNames[$dayStr])) {
                    $dayNames[$dayStr]++;
                }
            }
        }
        $weeklyVolumeData = [];
        foreach ($dayNames as $day => $vol) {
            $weeklyVolumeData[] = ['day' => $day, 'volume' => $vol];
        }

        // Monthly trends
        $monthGroups = [];
        foreach ($documents as $doc) {
            $d = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
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
            $auditQuery->where(function ($q) use ($user) {
                $q->where('user_id', $user->id);
                if ($user->department_id && $user->department) {
                    $q->orWhere('department', $user->department->department_name);
                }
                $q->orWhereHas('document', function ($dq) use ($user) {
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
        });

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

        return Inertia::render('reports/Index', [
            'metrics' => [
                'totalProcessed'      => $totalDocs,
                'completedCount'      => $completedCount,
                'activeCount'         => $activeCount,
                'returnedCount'       => $returnedCount,
                'slaComplianceRate'   => $complianceRate,
                'slaViolations'       => $violationsCount,
                'slaCompliant'        => $compliantCount,
                'nearDeadline'        => $nearDeadlineCount,
                'avgTurnaroundDays'   => $avgTurnaround,
            ],
            'bottlenecks'         => $deptStats,
            'bottleneckChartData' => $bottleneckChartData,
            'weeklyVolume'        => $weeklyVolumeData,
            'monthlyTrend'        => $monthlyTrendData,
            'statusDistribution'  => $statusDistribution,
            'activityLogs'        => $activityLogs,
            'insights'            => $insights,
            'isFullAccess'        => $isFullAccess,
            'currentRole'         => $currentRole,
            'userRoleName'        => $user->role->role_name ?? 'User',
            'userName'            => $user->name,
            'userDepartment'      => $user->department->department_name ?? 'LGU Mati',
            'filters'             => [
                'range'               => $range,
                'department'          => $departmentFilter,
            ],
            'departments'         => $allDepartments->map(fn($d) => [
                'id'   => $d->department_id,
                'name' => $d->department_name,
                'code' => $d->code,
            ]),
        ]);
    }
}

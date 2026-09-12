<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CartEscalationController extends Controller
{
    /**
     * Display the consolidated ARTA Escalated Docs module.
     * Mandated under ARTA Memorandum Circular No. 2020-07.
     * Enforces role-based visibility:
     * - Admin and CART: View all escalations across all departments.
     * - Other roles: View only escalations relevant to their documents/department.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        $severityFilter = $request->query('severity', 'all');
        $deptFilter = $request->query('department', 'all');
        $typeFilter = $request->query('type', 'all');
        $rangeFilter = $request->query('range', 'all');
        $searchQuery = trim($request->query('search', ''));

        // Query documents with eager loading
        $docQuery = Document::with([
            'department',
            'type',
            'submitter.role',
            'currentHolder.role',
            'currentHolderDepartment',
        ]);

        // Role-based visibility scoping
        if (!$isFullAccess) {
            $docQuery->where(function ($q) use ($user) {
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

        // Apply department filter
        if ($deptFilter !== 'all' && is_numeric($deptFilter)) {
            $docQuery->where(function ($q) use ($deptFilter) {
                $q->where('department_id', $deptFilter)
                  ->orWhere('current_holder_department_id', $deptFilter);
            });
        }

        // Apply document type filter
        if ($typeFilter !== 'all' && is_numeric($typeFilter)) {
            $docQuery->where('type_id', $typeFilter);
        }

        // Apply date range filter
        if ($rangeFilter === 'today') {
            $docQuery->whereDate('created_at', Carbon::today());
        } elseif ($rangeFilter === '7days') {
            $docQuery->where('created_at', '>=', Carbon::now()->subDays(7));
        } elseif ($rangeFilter === '30days') {
            $docQuery->where('created_at', '>=', Carbon::now()->subDays(30));
        } elseif ($rangeFilter === 'this_month') {
            $docQuery->whereMonth('created_at', Carbon::now()->month)
                     ->whereYear('created_at', Carbon::now()->year);
        }

        $allDocs = $docQuery->orderBy('created_at', 'desc')->get();
        $now = Carbon::now();

        // ── Map Complete Escalation Metadata & Severity ──────────────────────
        $allEscalations = [];
        $overdueCount = 0;
        $criticalCount = 0;
        $warningCount = 0;
        $resolvedCount = 0;

        foreach ($allDocs as $doc) {
            $statusLower = strtolower($doc->status ?? '');
            $isResolved = in_array($statusLower, ['completed', 'approved', 'archived']) || !empty($doc->completed_at);
            
            // Calculate SLA threshold (statutory default: 3 days for simple, or type-based)
            $slaThreshold = (int) ($doc->type->arta_processing_days ?? 3);
            if ($slaThreshold <= 0) {
                $slaThreshold = 3;
            }

            // Calculate days elapsed (rounded integer)
            $startDate = $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
            $startCarbon = $startDate ? Carbon::parse($startDate) : $now;
            $endCarbon = $doc->completed_at ? Carbon::parse($doc->completed_at) : $now;
            $daysElapsed = max(1, (int) round($startCarbon->diffInDays($endCarbon)));

            // Determine ARTA Due Date
            $dueDateCarbon = $doc->arta_due_date 
                ? Carbon::parse($doc->arta_due_date) 
                : (clone $startCarbon)->addDays($slaThreshold);

            // Determine Severity Level: Warning, Critical, Overdue, Resolved
            if ($isResolved) {
                $severity = 'Resolved';
                $resolvedCount++;
            } else {
                if ($now->gt($dueDateCarbon) || $daysElapsed > $slaThreshold) {
                    // Critical: exceeding double threshold or more than 5 days past SLA
                    if ($daysElapsed >= ($slaThreshold * 2) || $now->diffInDays($dueDateCarbon, false) <= -5) {
                        $severity = 'Critical';
                        $criticalCount++;
                    } else {
                        $severity = 'Overdue';
                    }
                    $overdueCount++;
                } else {
                    $daysRemaining = $now->diffInDays($dueDateCarbon, false);
                    if ($daysRemaining <= 2) {
                        $severity = 'Warning';
                        $warningCount++;
                    } else {
                        $severity = 'Warning';
                        $warningCount++;
                    }
                }
            }

            // Originating department
            $originatingDeptName = $doc->department->department_name ?? 'LGU Mati';
            $originatingDeptCode = $doc->department->code ?? 'LGU';

            // Current holder and office
            $currentHolderOffice = $doc->currentHolderDepartment->department_name 
                ?? $doc->department->department_name 
                ?? 'Originating Office';
            $currentHolderOfficeCode = $doc->currentHolderDepartment->code 
                ?? $doc->department->code 
                ?? 'LGU';

            $currentHolderUser = $doc->currentHolder 
                ? $doc->currentHolder->name 
                : ($doc->submitter ? $doc->submitter->name : 'Department Staff');
            $currentHolderRole = $doc->currentHolder 
                ? ($doc->currentHolder->role->role_name ?? 'Holder')
                : ($doc->submitter ? ($doc->submitter->role->role_name ?? 'Submitter') : 'Staff');

            // Notified user
            $notifiedName = $currentHolderUser;
            $notifiedRole = $currentHolderRole;

            $escalatedAt = $dueDateCarbon->format('M d, Y h:i A');

            $allEscalations[] = [
                'id'                          => $doc->document_id,
                'tracking_number'             => $doc->tracking_number ?: $doc->reference_number,
                'reference_number'            => $doc->reference_number,
                'title'                       => $doc->title,
                'department_id'               => $doc->department_id,
                'originating_department'      => $originatingDeptName,
                'originating_department_code' => $originatingDeptCode,
                'current_holder_office'       => $currentHolderOffice,
                'current_holder_office_code'  => $currentHolderOfficeCode,
                'current_holder_user'         => $currentHolderUser,
                'current_holder_role'         => $currentHolderRole,
                'type_id'                     => $doc->type_id,
                'type_name'                   => $doc->type->type_name ?? 'General Document',
                'severity'                    => $severity,
                'days_elapsed'                => $daysElapsed,
                'sla_threshold'               => $slaThreshold,
                'variance'                    => $daysElapsed - $slaThreshold,
                'notified_user'               => $notifiedName,
                'notified_role'               => $notifiedRole,
                'escalated_at'                => $escalatedAt,
                'status'                      => $doc->status,
                'resolved'                    => $isResolved,
                'resolved_at'                 => $doc->completed_at ? Carbon::parse($doc->completed_at)->format('M d, Y h:i A') : null,
            ];
        }

        $totalEscalationsCount = count($allEscalations);

        // ── Apply Severity & Search Filtering to Table Records ───────────────
        $filteredRecords = $allEscalations;

        if ($severityFilter !== 'all') {
            $sFilter = strtolower($severityFilter);
            $filteredRecords = array_values(array_filter($filteredRecords, function ($item) use ($sFilter) {
                if ($sFilter === 'overdue') {
                    return in_array(strtolower($item['severity']), ['overdue', 'critical']);
                }
                return strtolower($item['severity']) === $sFilter;
            }));
        }

        if ($searchQuery !== '') {
            $qLower = strtolower($searchQuery);
            $filteredRecords = array_values(array_filter($filteredRecords, function ($item) use ($qLower) {
                return str_contains(strtolower($item['tracking_number']), $qLower)
                    || str_contains(strtolower($item['reference_number']), $qLower)
                    || str_contains(strtolower($item['title']), $qLower)
                    || str_contains(strtolower($item['originating_department']), $qLower)
                    || str_contains(strtolower($item['originating_department_code']), $qLower)
                    || str_contains(strtolower($item['current_holder_office']), $qLower)
                    || str_contains(strtolower($item['current_holder_user']), $qLower)
                    || str_contains(strtolower($item['notified_user']), $qLower);
            }));
        }

        $allDepartments = Department::where('is_active', true)->orderBy('department_name')->get();

        return Inertia::render('cart/escalations/Index', [
            'escalations' => $filteredRecords,
            'kpis' => [
                'total'    => $totalEscalationsCount,
                'overdue'  => $overdueCount,
                'warnings' => $warningCount,
                'resolved' => $resolvedCount,
            ],
            'departments'   => $allDepartments->map(fn($d) => [
                'id'   => $d->department_id,
                'name' => $d->department_name,
                'code' => $d->code,
            ]),
            'documentTypes' => DocumentType::where('is_active', true)->orderBy('type_name')->get()->map(fn($t) => [
                'id'   => $t->type_id,
                'name' => $t->type_name,
                'days' => $t->arta_processing_days,
            ]),
            'filters' => [
                'severity'   => $severityFilter,
                'department' => $deptFilter,
                'type'       => $typeFilter,
                'range'      => $rangeFilter,
                'search'     => $searchQuery,
            ],
            'isFullAccess'   => $isFullAccess,
            'userRoleName'   => $user->role->role_name ?? 'User',
            'userDepartment' => $user->department->department_name ?? 'LGU Mati',
        ]);
    }

    /**
     * Resolve an ARTA Escalation.
     * Records official CART action in the audit trail.
     */
    public function resolve(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        $user = auth()->user();

        // Update document status
        $document->is_escalated = false;
        $document->status = 'completed';
        $document->completed_at = Carbon::now();
        $document->save();

        // Log to Audit Trail
        AuditTrail::create([
            'document_id'  => $document->document_id,
            'category'     => 'action',
            'user_id'      => $user->id,
            'user_role'    => $user->role->role_name ?? 'CART',
            'department'   => $user->department->department_name ?? 'CART Office',
            'document_ref' => $document->reference_number,
            'action'       => 'ARTA Escalation Resolved',
            'description'  => $request->input('remarks', 'CART resolved the ARTA SLA escalation pursuant to RA 11032 / MC No. 2020-07.'),
            'ip_address'   => $request->ip(),
            'timestamp'    => Carbon::now(),
        ]);

        return redirect()->back()->with('success', "ARTA Escalation for {$document->reference_number} resolved successfully.");
    }
}

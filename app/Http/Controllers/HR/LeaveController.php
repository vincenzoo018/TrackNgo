<?php

namespace App\Http\Controllers\HR;

use App\Contracts\AuditTrailServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Oic\OicService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * HR → Leave Management: HR records an employee's leave, approves or rejects it. Approving the leave of the Mayor or
 * a Department Head can designate the Officer-in-Charge for the same dates (LGC Sec. 46), so their documents do not
 * stall while they are away. Working days skip weekends and the Holiday Calendar.
 */
class LeaveController extends Controller
{
    public function __construct(
        protected WorkingDayCalendar $calendar,
        protected OicService $oic,
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    public function index(): Response
    {
        // HR does not manage Admin accounts
        $people = User::with(['role', 'department'])->where('is_active', true)
            ->whereDoesntHave('role', fn ($q) => $q->where('role_name', 'Admin'))
            ->orderBy('last_name')->orderBy('first_name')->get();

        return Inertia::render('hr/leave/Index', [
            'leaves'     => LeaveRequest::with(['employee.role', 'employee.department', 'reviewer', 'designation.officer'])
                ->orderByDesc('start_date')->orderByDesc('id')->get()
                ->map(fn (LeaveRequest $leave) => [
                    'id'             => $leave->id,
                    'user_id'        => $leave->user_id,
                    'employee'       => $leave->employee?->name,
                    'role'           => $leave->employee?->role?->role_name,
                    'department'     => $leave->employee?->department?->department_name,
                    'leave_type'     => $leave->leave_type,
                    'start_date'     => $leave->start_date->toDateString(),
                    'end_date'       => $leave->end_date->toDateString(),
                    'working_days'   => $leave->working_days,
                    'reason'         => $leave->reason,
                    'status'         => $leave->status,
                    'reviewed_by'    => $leave->reviewer?->name,
                    'reviewed_at'    => $leave->reviewed_at?->toIso8601String(),
                    'review_remarks' => $leave->review_remarks,
                    'oic'            => $leave->designation ? [
                        'officer' => $leave->designation->officer?->name,
                        'order'   => $leave->designation->designation_order_number,
                        'status'  => $leave->designation->status(),
                    ] : null,
                ]),
            'employees'  => $people->map(fn (User $u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'role'       => $u->role?->role_name,
                'department' => $u->department?->department_name,
                // The Mayor and Department Heads may get an Officer-in-Charge while on leave
                'needs_oic'  => in_array($u->role?->role_name, OicService::COVERABLE_ROLES, true),
            ])->values(),
            'officers'   => $people->reject(fn (User $u) => in_array($u->role?->role_name, ['CART', 'Receiving Clerk'], true))
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'role' => $u->role?->role_name, 'department' => $u->department?->department_name, 'has_signature' => !empty($u->signature)])
                ->values(),
            'leaveTypes' => LeaveRequest::TYPES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id'    => ['required', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'leave_type' => ['required', Rule::in(LeaveRequest::TYPES)],
            'start_date' => 'required|date_format:Y-m-d',
            'end_date'   => 'required|date_format:Y-m-d|after_or_equal:start_date',
            'reason'     => 'nullable|string|max:500',
        ], [
            'end_date.after_or_equal' => 'The last day of leave cannot be before the first day.',
        ]);

        $employee = User::with('role')->findOrFail($data['user_id']);
        if ($employee->hasRole('Admin')) {
            throw ValidationException::withMessages(['user_id' => 'HR does not manage Administrator accounts.']);
        }
        $days = $this->calendar->workingDaysIn($data['start_date'], $data['end_date']);
        if ($days === 0) {
            throw ValidationException::withMessages(['end_date' => 'The selected dates fall on weekends or holidays only.']);
        }
        $overlap = LeaveRequest::where('user_id', $employee->id)
            ->whereIn('status', [LeaveRequest::PENDING, LeaveRequest::APPROVED])
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['start_date' => "{$employee->name} already has a leave on some of these days."]);
        }

        $leave = LeaveRequest::create($data + [
            'working_days' => $days,
            'status'       => LeaveRequest::PENDING,
            'created_by'   => $request->user()->id,
        ]);

        $this->auditTrail->logUserAction('Leave Recorded', "{$data['leave_type']} of {$employee->name} recorded for " . $this->period($leave) . " ({$days} working day(s)).", $request->user(), $request->ip());

        return redirect()->back()->with('success', "Leave of {$employee->name} recorded ({$days} working day(s)). Approve it to make it official.");
    }

    public function approve(Request $request, int $id): RedirectResponse
    {
        $leave = LeaveRequest::with('employee.role')->findOrFail($id);
        $this->ensureStatus($leave, [LeaveRequest::PENDING]);
        $data = $request->validate([
            'review_remarks'           => 'nullable|string|max:500',
            'designated_user_id'       => 'nullable|integer|exists:users,id',
            'designation_order_number' => 'nullable|required_with:designated_user_id|string|max:60',
        ], [
            'designation_order_number.required_with' => 'Enter the number of the written designation order for the Officer-in-Charge.',
        ]);

        $designation = null;
        if (!empty($data['designated_user_id'])) {
            if (!in_array($leave->employee?->role?->role_name, OicService::COVERABLE_ROLES, true)) {
                throw ValidationException::withMessages(['designated_user_id' => 'Only the Mayor or a Department Head is covered by an Officer-in-Charge.']);
            }
            // The OIC designation is validated and saved first: if it is refused, the leave stays pending
            $designation = $this->oic->create([
                'designating_user_id'      => $leave->user_id,
                'designated_user_id'       => $data['designated_user_id'],
                'start_date'               => $leave->start_date->toDateString(),
                'end_date'                 => $leave->end_date->toDateString(),
                'designation_order_number' => $data['designation_order_number'],
                'remarks'                  => "On {$leave->leave_type} (" . $this->period($leave) . ').',
            ], $request->user(), $request->ip());
        }

        $leave->update([
            'status'             => LeaveRequest::APPROVED,
            'reviewed_by'        => $request->user()->id,
            'reviewed_at'        => now(),
            'review_remarks'     => $data['review_remarks'] ?? null,
            'oic_designation_id' => $designation?->id,
        ]);

        $this->auditTrail->logUserAction('Leave Approved', "{$leave->leave_type} of {$leave->employee?->name} (" . $this->period($leave) . ') approved'
            . ($designation ? " with {$designation->officer?->name} as {$designation->title()} (Designation Order No. {$designation->designation_order_number})" : '') . '.', $request->user(), $request->ip());

        return redirect()->back()->with('success', "Leave of {$leave->employee?->name} approved" . ($designation ? ' and the Officer-in-Charge designated.' : '.'));
    }

    public function reject(Request $request, int $id): RedirectResponse
    {
        $leave = LeaveRequest::with('employee')->findOrFail($id);
        $this->ensureStatus($leave, [LeaveRequest::PENDING]);
        $data = $request->validate(['review_remarks' => 'required|string|min:3|max:500'], [
            'review_remarks.required' => 'Give the reason for rejecting the leave.',
        ]);

        $leave->update([
            'status'         => LeaveRequest::REJECTED,
            'reviewed_by'    => $request->user()->id,
            'reviewed_at'    => now(),
            'review_remarks' => $data['review_remarks'],
        ]);
        $this->auditTrail->logUserAction('Leave Rejected', "{$leave->leave_type} of {$leave->employee?->name} (" . $this->period($leave) . ") rejected: {$data['review_remarks']}", $request->user(), $request->ip());

        return redirect()->back()->with('success', "Leave of {$leave->employee?->name} rejected.");
    }

    /** A pending or approved leave is withdrawn; an Officer-in-Charge designated for it ends as well */
    public function cancel(Request $request, int $id): RedirectResponse
    {
        $leave = LeaveRequest::with(['employee', 'designation'])->findOrFail($id);
        $this->ensureStatus($leave, [LeaveRequest::PENDING, LeaveRequest::APPROVED]);

        DB::transaction(function () use ($leave, $request) {
            $leave->update(['status' => LeaveRequest::CANCELLED, 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
            if ($leave->designation && !$leave->designation->ended_at) {
                $this->oic->end($leave->designation, $request->user(), $request->ip());
            }
        });
        $this->auditTrail->logUserAction('Leave Cancelled', "{$leave->leave_type} of {$leave->employee?->name} (" . $this->period($leave) . ') cancelled.', $request->user(), $request->ip());

        return redirect()->back()->with('success', "Leave of {$leave->employee?->name} cancelled.");
    }

    private function ensureStatus(LeaveRequest $leave, array $allowed): void
    {
        if (!in_array($leave->status, $allowed, true)) {
            throw ValidationException::withMessages(['status' => "This leave is already {$leave->status}."]);
        }
    }

    private function period(LeaveRequest $leave): string
    {
        $start = Carbon::parse($leave->start_date);
        $end = Carbon::parse($leave->end_date);

        return $start->isSameDay($end) ? $start->format('M d, Y') : $start->format('M d') . ' – ' . $end->format('M d, Y');
    }
}

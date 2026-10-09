<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OicDesignation;
use App\Models\User;
use App\Services\Oic\OicService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin → User Accounts → OIC Designations (LGC Sec. 46): record the written designation of an Officer-in-Charge /
 * Acting Mayor for an absent Mayor or Department Head, and end it early when the official is back.
 */
class OicDesignationController extends Controller
{
    public function __construct(
        protected OicService $oic
    ) {}

    public function index(): Response
    {
        $people = User::with(['role', 'department'])->where('is_active', true)->orderBy('last_name')->orderBy('first_name')->get();
        $person = fn (User $u) => [
            'id'            => $u->id,
            'name'          => $u->name,
            'role'          => $u->role?->role_name,
            'department'    => $u->department?->department_name,
            'has_signature' => !empty($u->signature),
        ];

        return Inertia::render('admin/oic/Index', [
            'designations' => OicDesignation::with(['official.role', 'officer.role', 'department', 'creator'])
                ->orderByDesc('start_date')->orderByDesc('id')->get()
                ->map(fn (OicDesignation $d) => [
                    'id'                       => $d->id,
                    'official'                 => $d->official?->name,
                    'official_role'            => $d->official?->role?->role_name,
                    'officer'                  => $d->officer?->name,
                    'officer_role'             => $d->officer?->role?->role_name,
                    'title'                    => $d->title(),
                    'department'               => $d->department?->department_name,
                    'start_date'               => $d->start_date->toDateString(),
                    'end_date'                 => $d->end_date->toDateString(),
                    'designation_order_number' => $d->designation_order_number,
                    'remarks'                  => $d->remarks,
                    'status'                   => $d->status(),
                    'ended_at'                 => $d->ended_at?->toIso8601String(),
                    'created_by'               => $d->creator?->name,
                ]),
            // The absent official: the Mayor or a Department Head
            'officials'    => $people->filter(fn (User $u) => in_array($u->role?->role_name, OicService::COVERABLE_ROLES, true))->map($person)->values(),
            // Who may act for them: any active official who can sign (not CART / Receiving Clerk)
            'officers'     => $people->reject(fn (User $u) => in_array($u->role?->role_name, ['CART', 'Receiving Clerk'], true))->map($person)->values(),
            'today'        => $this->oic->today(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'designating_user_id'      => 'required|integer|exists:users,id',
            'designated_user_id'       => 'required|integer|exists:users,id|different:designating_user_id',
            'start_date'               => 'required|date_format:Y-m-d',
            'end_date'                 => 'required|date_format:Y-m-d|after_or_equal:start_date',
            'designation_order_number' => 'required|string|max:60',
            'remarks'                  => 'nullable|string|max:500',
        ], [
            'designated_user_id.different' => 'The Officer-in-Charge must be a different person.',
            'end_date.after_or_equal'      => 'The end date cannot be before the start date.',
            'designation_order_number.required' => 'Enter the number of the written designation order (e.g. "12, s. 2026").',
        ]);

        $designation = $this->oic->create($data, $request->user(), $request->ip());
        $designation->load(['officer', 'official']);

        return redirect()->back()->with('success', "{$designation->officer->name} is designated {$designation->title()} for {$designation->official->name} ("
            . OicService::period($designation) . '). Documents for them go to the OIC during this period.');
    }

    public function end(Request $request, int $id): RedirectResponse
    {
        $designation = OicDesignation::with(['official', 'officer'])->findOrFail($id);
        $this->oic->end($designation, $request->user(), $request->ip());

        return redirect()->back()->with('success', "Designation ended. Documents waiting for {$designation->official?->name} were given back to them.");
    }
}

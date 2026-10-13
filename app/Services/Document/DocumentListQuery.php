<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Cart\ArtaClock;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The documents each role's "My Documents" list shows (/admin, /receiving, /department-head, /mayor, /hr). The
 * dashboard counts its Overdue card from the same query, so the card and the list's Overdue tab always agree.
 */
class DocumentListQuery
{
    public const RELATIONS = ['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'];

    public function __construct(
        protected WorkingDayCalendar $calendar
    ) {}

    /** The list of the user's role, or null for a role without one (CART) */
    public function forUser(User $user): ?Builder
    {
        return match ($user->roleSlug('')) {
            'admin'           => $this->admin(),
            'receiving'       => $this->receiving($user),
            'department-head' => $this->departmentHead($user),
            'mayor'           => $this->mayor($user),
            'hr'              => $this->hr($user),
            default           => null,
        };
    }

    public function admin(): Builder
    {
        // Finished documents are included too: the list's "Archived" tab shows them
        return Document::with(['submitter', 'department', 'type'])->orderBy('reference_number', 'asc');
    }

    public function receiving(User $user): Builder
    {
        return $this->whereInvolved(
            Document::with(self::RELATIONS)->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'archived', Document::STATUS_VETOED]),
            $user,
            ownDepartment: false,
            alsoVisible: fn (Builder $query) => $query->orWhere('status', 'pending_registration')
                ->orWhere('status', 'approved')
                // Deemed approved by law: waiting at the counter for release
                ->orWhere('status', Document::STATUS_DEEMED_APPROVED)
                // Internal documents are registered automatically; the clerk monitors their status and location
                // ("Internal" tab; confidential ones show the record only)
                ->orWhere('is_internal', true),
        );
    }

    public function departmentHead(User $user): Builder
    {
        return $this->whereInvolved(
            Document::with(self::RELATIONS)
                // Powers the "Sent" tab: documents this Dept Head filed or forwarded that are now with someone else
                ->withExists(['routingSlips as forwarded_by_me' => fn ($q) => $q->where('from_user_id', $user->id)])
                // Finished documents stay in the list ("Completed" tab) for the people who handled them
                ->whereRaw("LOWER(status) <> 'archived'"),
            $user,
            ownDepartment: true,
        );
    }

    public function mayor(User $user): Builder
    {
        return $this->whereInvolved(
            // Finished documents stay in the list ("Approved" tab) for the people who handled them
            Document::with(self::RELATIONS)->whereRaw("LOWER(status) <> 'archived'"),
            $user,
            ownDepartment: false,
            // Every fixed-flow document at the Mayor's stage, while it is still being processed
            // (route-based documents reach the Mayor only when the Mayor is on their route)
            alsoVisible: fn (Builder $query) => $query->orWhere(fn ($stage) => $stage->whereIn('current_step_index', [4, 5, 6])
                ->where('route_based', false)
                ->whereRaw("LOWER(status) NOT IN ('completed', 'approved', 'deemed_approved', 'vetoed')")),
        );
    }

    public function hr(User $user): Builder
    {
        return $this->whereInvolved(
            // Finished documents stay in the list ("Completed" tab) for the people who handled them
            Document::with(self::RELATIONS)->whereRaw("LOWER(status) <> 'archived'"),
            $user,
            ownDepartment: true,
        );
    }

    /**
     * Still open and past its ARTA due date (the day after the due date in office time); the same rule as the
     * list's Overdue tab (getArtaDaysLeft < 0 in resources/js/lib/arta.ts).
     */
    public function overdue(Builder $documents): Builder
    {
        return $documents
            ->whereNotNull('arta_due_date')
            ->whereDate('arta_due_date', '<', $this->calendar->day(now())->toDateString())
            ->whereRaw('LOWER(status) NOT IN (' . ArtaClock::placeholders() . ')', ArtaClock::CLOSED_STATUSES);
    }

    /**
     * Documents the user holds or filed, those $alsoVisible adds, those held by (and with $ownDepartment, owned by)
     * their department or routed through it, and any routed to them personally.
     */
    private function whereInvolved(Builder $documents, User $user, bool $ownDepartment, ?Closure $alsoVisible = null): Builder
    {
        return $documents
            ->where(function ($query) use ($user, $ownDepartment, $alsoVisible) {
                $query->where('current_holder_id', $user->id)
                      ->orWhere('submitted_by', $user->id);
                if ($alsoVisible) {
                    $alsoVisible($query);
                }
                if ($user->department_id) {
                    $query->orWhere('current_holder_department_id', $user->department_id);
                    if ($ownDepartment) {
                        $query->orWhere('department_id', $user->department_id);
                    }
                    $query->orWhereHas('routingSlips', function ($q) use ($user) {
                        $q->where('target_department_id', $user->department_id)
                          ->orWhere('from_department_id', $user->department_id)
                          ->orWhere('to_user_id', $user->id);
                    });
                }
                $query->orWhereHas('routingSlips', function ($q) use ($user) {
                    $q->where('to_user_id', $user->id);
                });
                // On the route chosen at filing, including stops the document has not reached yet
                $query->orWhereHas('routeStops', fn ($q) => $q->where('user_id', $user->id));
            })
            ->orderBy('reference_number', 'asc');
    }
}

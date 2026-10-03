<?php

namespace App\Services\Document;

use App\Models\Department;
use App\Models\Document;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Document KPIs shared by the Dashboard and Reports & Analytics pages, so both compute
 * the same status counts, ARTA SLA compliance, turnaround and volume figures.
 */
class DocumentMetrics
{
    private const FINISHED_STATUSES = ['completed', 'approved', 'archived'];

    private const SENT_BACK_STATUSES = ['returned', 'rejected'];

    /**
     * Documents the user may see (Admin & CART: all; others: involving them), narrowed by the
     * page's department filter and date range ('today', '7days', '30days', 'this_month' or 'all').
     */
    public function scopedQuery(User $user, array $with, string $range, mixed $departmentFilter): Builder
    {
        $docQuery = Document::with($with);

        if (!$user->hasFullAccess()) {
            $docQuery->involving($user);
        }

        if ($departmentFilter !== 'all' && is_numeric($departmentFilter)) {
            $docQuery->where(function (Builder $q) use ($departmentFilter) {
                $q->where('department_id', $departmentFilter)
                  ->orWhere('current_holder_department_id', $departmentFilter);
            });
        }

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

        return $docQuery;
    }

    /** @return array{completed: int, returned: int, active: int} */
    public function statusCounts(Collection $documents): array
    {
        $completed = $documents->filter(function ($doc) {
            return in_array($this->status($doc), self::FINISHED_STATUSES) || !empty($doc->completed_at);
        })->count();

        $returned = $documents->filter(fn ($doc) => in_array($this->status($doc), self::SENT_BACK_STATUSES))->count();

        $active = $documents->filter(function ($doc) {
            return !in_array($this->status($doc), [...self::FINISHED_STATUSES, ...self::SENT_BACK_STATUSES]);
        })->count();

        return ['completed' => $completed, 'returned' => $returned, 'active' => $active];
    }

    /**
     * ARTA deadline standing: finished after (or still open past) the due date is a violation; open
     * documents due within 2 days are near the deadline; documents without a due date count as compliant.
     *
     * @return array{violations: int, compliant: int, nearDeadline: int}
     */
    public function slaCompliance(Collection $documents, Carbon $now): array
    {
        $violations = 0;
        $compliant = 0;
        $nearDeadline = 0;

        foreach ($documents as $doc) {
            $dueDate = $doc->arta_due_date ? Carbon::parse($doc->arta_due_date) : null;
            $completedDate = $doc->completed_at ? Carbon::parse($doc->completed_at) : null;

            if (!$dueDate) {
                $compliant++;
            } elseif ($completedDate) {
                $completedDate->gt($dueDate) ? $violations++ : $compliant++;
            } elseif ($now->gt($dueDate)) {
                $violations++;
            } else {
                $compliant++;
                if ($now->diffInDays($dueDate, false) <= 2) {
                    $nearDeadline++;
                }
            }
        }

        return ['violations' => $violations, 'compliant' => $compliant, 'nearDeadline' => $nearDeadline];
    }

    public function complianceRate(int $compliant, int $total): float|int
    {
        return $total > 0 ? round(($compliant / $total) * 100, 1) : 100;
    }

    /** Documents owned by or currently held by the department. */
    public function forDepartment(Collection $documents, Department $dept): Collection
    {
        return $documents->filter(function ($doc) use ($dept) {
            return $doc->current_holder_department_id == $dept->department_id
                || $doc->department_id == $dept->department_id;
        });
    }

    /** Statutory SLA benchmark (in days) based on the department's function. */
    public function departmentSla(string $departmentName): float
    {
        $dnameLower = strtolower($departmentName);
        if (str_contains($dnameLower, 'legal') || str_contains($dnameLower, 'ordinance')) {
            return 7.0;
        }
        if (str_contains($dnameLower, 'engineer') || str_contains($dnameLower, 'public works')) {
            return 5.0;
        }
        if (str_contains($dnameLower, 'budget') || str_contains($dnameLower, 'accounting') || str_contains($dnameLower, 'treasurer')) {
            return 4.0;
        }

        return 3.0;
    }

    /** Average days from filing to completion (or to now while still open); $fallback when nothing was filed. */
    public function averageTurnaroundDays(Collection $documents, Carbon $now, float $fallback): float
    {
        $sum = 0;
        $count = 0;
        foreach ($documents as $doc) {
            $sub = $this->filedAt($doc);
            if ($sub) {
                $end = $doc->completed_at ? Carbon::parse($doc->completed_at) : $now;
                $sum += max(1, Carbon::parse($sub)->diffInDays($end));
                $count++;
            }
        }

        return $count > 0 ? round($sum / $count, 1) : $fallback;
    }

    /** @return list<array{day: string, volume: int}> Documents filed per day of the week, Monday first. */
    public function weeklyVolume(Collection $documents): array
    {
        $dayNames = ['Mon' => 0, 'Tue' => 0, 'Wed' => 0, 'Thu' => 0, 'Fri' => 0, 'Sat' => 0, 'Sun' => 0];
        foreach ($documents as $doc) {
            $d = $this->filedAt($doc);
            if ($d) {
                $dayStr = Carbon::parse($d)->format('D');
                if (isset($dayNames[$dayStr])) {
                    $dayNames[$dayStr]++;
                }
            }
        }

        $volume = [];
        foreach ($dayNames as $day => $vol) {
            $volume[] = ['day' => $day, 'volume' => $vol];
        }

        return $volume;
    }

    /** Who is viewing and which filters are applied, closing both the Dashboard and Reports payloads. */
    public function viewerContext(User $user, string $range, mixed $departmentFilter, Collection $departments): array
    {
        return [
            'isFullAccess'   => $user->hasFullAccess(),
            'currentRole'    => $user->roleSlug(),
            'userRoleName'   => $user->role->role_name ?? 'User',
            'userName'       => $user->name,
            'userDepartment' => $user->department->department_name ?? 'LGU Mati',
            'filters'        => [
                'range'      => $range,
                'department' => $departmentFilter,
            ],
            'departments'    => $departments->map(fn ($d) => [
                'id'   => $d->department_id,
                'name' => $d->department_name,
                'code' => $d->code,
            ])->values()->all(),
        ];
    }

    public function filedAt(Document $doc): mixed
    {
        return $doc->submitted_at ?? $doc->date_filed ?? $doc->created_at;
    }

    private function status(Document $doc): string
    {
        return strtolower($doc->status ?? '');
    }
}

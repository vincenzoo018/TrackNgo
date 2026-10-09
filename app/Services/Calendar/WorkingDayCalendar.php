<?php

namespace App\Services\Calendar;

use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Holiday;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * The one place deadlines are computed. RA 11032 counts working days: Saturdays, Sundays and every date in the
 * Holiday Calendar (regular holidays, special non-working days, work suspensions) are skipped. Legislative types
 * (ordinances / resolutions, LGC Sec. 54) count calendar days.
 *
 * Days are counted after the start day, in office time: a document filed on Monday with 3 working days is due on
 * Thursday; one filed on a Saturday or a holiday starts counting on the next working day.
 *
 * Bound per request (DomainServiceProvider) so the holiday list is read once and never outlives a change to it.
 */
class WorkingDayCalendar
{
    /** @var array<string, string>|null 'Y-m-d' => holiday name */
    private ?array $holidays = null;

    public function timezone(): string
    {
        return config('arta.timezone', 'Asia/Manila');
    }

    /** A fresh mutable copy at the start of the office day */
    public function day(mixed $value): Carbon
    {
        $date = $value instanceof \DateTimeInterface ? Carbon::instance($value) : Carbon::parse($value);

        return $date->copy()->setTimezone($this->timezone())->startOfDay();
    }

    public function holidayName(mixed $day): ?string
    {
        return $this->holidays()[$this->day($day)->toDateString()] ?? null;
    }

    public function isWorkingDay(mixed $day): bool
    {
        $day = $this->day($day);

        return !$day->isWeekend() && $this->holidayName($day) === null;
    }

    /** Whether $type counts working days (everything except legislative types, unless the ARTA switch is off) */
    public function countsWorkingDays(?DocumentType $type): bool
    {
        return !$type?->countsCalendarDays() && (bool) config('arta.count_working_days', true);
    }

    /** $days working days after $from */
    public function addWorkingDays(mixed $from, int $days): Carbon
    {
        $day = $this->day($from);
        for ($added = 0; $added < $days;) {
            $day->addDay();
            if ($this->isWorkingDay($day)) {
                $added++;
            }
        }

        return $day;
    }

    /** $days days after $from, counted the way $type counts them */
    public function addDays(mixed $from, int $days, ?DocumentType $type = null): Carbon
    {
        return $this->countsWorkingDays($type) ? $this->addWorkingDays($from, $days) : $this->day($from)->addDays($days);
    }

    /** Due date of a document of $type received on $start ($days overrides the type's processing period) */
    public function dueDate(mixed $start, ?DocumentType $type, ?int $days = null): Carbon
    {
        return $this->addDays($start, $days ?? $this->processingDays($type), $type);
    }

    /** The document's due day (start of the office day): the stored deadline, or its type's period from filing */
    public function deadlineFor(Document $document): Carbon
    {
        return $document->arta_due_date
            ? $this->day($document->arta_due_date)
            : $this->dueDate($document->date_filed ?? $document->created_at ?? now(), $document->type);
    }

    /** The office may act until the end of the due day; the document is overdue after this moment */
    public function deadlineEndsAt(Document $document): Carbon
    {
        return $this->deadlineFor($document)->endOfDay();
    }

    public function processingDays(?DocumentType $type): int
    {
        return (int) ($type?->arta_processing_days ?: config('arta.default_processing_days', 3));
    }

    /** Days after $from up to and including $to, counted the way $type counts them; negative when $to is earlier */
    public function daysBetween(mixed $from, mixed $to, ?DocumentType $type = null): int
    {
        $a = $this->day($from);
        $b = $this->day($to);

        if (!$this->countsWorkingDays($type)) {
            return (int) round($a->diffInDays($b, false));
        }

        $sign = $b->lt($a) ? -1 : 1;
        [$start, $end] = $sign < 0 ? [$b, $a] : [$a, $b];
        $days = 0;
        for ($day = $start->copy()->addDay(); $day->lte($end); $day->addDay()) {
            if ($this->isWorkingDay($day)) {
                $days++;
            }
        }

        return $sign * $days;
    }

    /** Working days from $from to $to, both included (leave applications) */
    public function workingDaysIn(mixed $from, mixed $to): int
    {
        $days = 0;
        for ($day = $this->day($from), $end = $this->day($to); $day->lte($end); $day->addDay()) {
            $days += $this->isWorkingDay($day) ? 1 : 0;
        }

        return $days;
    }

    /**
     * Non-working days after $from up to and including $to, with the reason each is skipped (ARTA Timeline).
     *
     * @return list<array{date: string, reason: string, kind: string}>
     */
    public function nonWorkingDaysBetween(mixed $from, mixed $to): array
    {
        $days = [];
        for ($day = $this->day($from)->addDay(), $end = $this->day($to); $day->lte($end); $day->addDay()) {
            if ($name = $this->holidayName($day)) {
                $days[] = ['date' => $day->toDateString(), 'reason' => $name, 'kind' => 'holiday'];
            } elseif ($day->isWeekend()) {
                $days[] = ['date' => $day->toDateString(), 'reason' => $day->isSaturday() ? 'Saturday' : 'Sunday', 'kind' => 'weekend'];
            }
        }

        return $days;
    }

    /** Forget the cached holiday list (after the Holiday Calendar is edited) */
    public function flush(): void
    {
        $this->holidays = null;
    }

    /** @return array<string, string> */
    private function holidays(): array
    {
        return $this->holidays ??= Holiday::query()->orderBy('date')->get(['date', 'name'])
            ->mapWithKeys(fn (Holiday $holiday) => [$holiday->date->toDateString() => $holiday->name])
            ->all();
    }
}

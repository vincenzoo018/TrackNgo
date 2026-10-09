<?php

namespace App\Services\Cart;

use App\Models\ArtaEscalation;
use App\Models\Document;
use App\Services\Calendar\WorkingDayCalendar;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * ARTA processing time of one document — the Smart Escalation Algorithm (see config/arta.php):
 * WD = days elapsed since the document was assigned for processing, L = allowable processing period,
 * escalated when WD > L, OD = WD − L decides the severity (Warning / Critical / Overdue).
 *
 * Days are working days (weekends and the Holiday Calendar skipped, RA 11032) except for legislative types,
 * which count calendar days (LGC Sec. 54); see WorkingDayCalendar. L includes the one extension, if granted.
 */
class ArtaClock
{
    public const WITHIN_TIME = 'within_time';
    public const APPROACHING = 'approaching';
    public const DUE = 'due';
    public const OVERDUE = 'overdue';
    public const COMPLETED = 'completed';

    /**
     * The clock stops once a document reaches one of these: finished, vetoed, or deemed approved (the office's
     * time ran out; only the release is left)
     */
    public const CLOSED_STATUSES = ['completed', 'released', 'archived', Document::STATUS_VETOED, Document::STATUS_DEEMED_APPROVED];

    public function __construct(
        protected WorkingDayCalendar $calendar
    ) {}

    public static function isClosed(Document $document): bool
    {
        return in_array(strtolower((string) $document->status), self::CLOSED_STATUSES, true);
    }

    /** "?, ?, ?" for a whereRaw over CLOSED_STATUSES */
    public static function placeholders(): string
    {
        return implode(', ', array_fill(0, count(self::CLOSED_STATUSES), '?'));
    }

    /**
     * @return array{assigned_at: Carbon, allowed_days: int, elapsed_days: int, remaining_days: int,
     *               overdue_days: int, deadline: Carbon, status: string, severity: ?string, completed_late: bool,
     *               working_days: bool, deemed_approved: bool}
     */
    public function evaluate(Document $document, ?CarbonInterface $now = null): array
    {
        $type = $document->type;
        $now = $this->local($now ?? now());
        $assigned = $this->local($document->date_filed ?? $document->created_at ?? $now);
        $closed = self::isClosed($document);
        $end = match (true) {
            !$closed                       => $now,
            $document->deemed_approved_at !== null => $this->local($document->deemed_approved_at),
            default                        => $this->local($document->completed_at ?? $document->updated_at ?? $now),
        };

        // The deadline stored on the document (computed at filing, moved by an extension) is the source of truth;
        // documents without one use the document type's processing period
        $allowed = $document->arta_due_date
            ? max(0, $this->calendar->daysBetween($assigned, $document->arta_due_date, $type))
            : $this->calendar->processingDays($type);

        $elapsed = max(0, $this->calendar->daysBetween($assigned, $end, $type));
        $remaining = $allowed - $elapsed;
        $overdue = max(0, $elapsed - $allowed);

        $status = match (true) {
            $closed                                          => self::COMPLETED,
            $elapsed > $allowed                              => self::OVERDUE,
            $remaining === 0                                 => self::DUE,
            $remaining <= $this->approachingWindow($allowed) => self::APPROACHING,
            default                                          => self::WITHIN_TIME,
        };

        return [
            'assigned_at'     => $assigned,
            'allowed_days'    => $allowed,
            'elapsed_days'    => $elapsed,
            'remaining_days'  => $remaining,
            'overdue_days'    => $overdue,
            'deadline'        => $document->arta_due_date ? $this->calendar->day($document->arta_due_date) : $this->calendar->addDays($assigned, $allowed, $type),
            'status'          => $status,
            'severity'        => $closed ? null : self::severityFor($overdue),
            'completed_late'  => $closed && $overdue > 0,
            'working_days'    => $this->calendar->countsWorkingDays($type),
            'deemed_approved' => $document->deemed_approved_at !== null,
        ];
    }

    /** SL = Warning (1 ≤ OD ≤ 2), Critical (3 ≤ OD ≤ 5), Overdue (OD > 5); null while within the period */
    public static function severityFor(int $overdueDays): ?string
    {
        return match (true) {
            $overdueDays < 1                                              => null,
            $overdueDays <= config('arta.severity.warning_max_days', 2)  => ArtaEscalation::LEVEL_WARNING,
            $overdueDays <= config('arta.severity.critical_max_days', 5) => ArtaEscalation::LEVEL_CRITICAL,
            default                                                       => ArtaEscalation::LEVEL_OVERDUE,
        };
    }

    /** OD on the first day of a severity level (Warning 1, Critical 3, Overdue 6 with the default bands) */
    public static function firstOverdueDay(string $level): int
    {
        return match ($level) {
            ArtaEscalation::LEVEL_CRITICAL => (int) config('arta.severity.warning_max_days', 2) + 1,
            ArtaEscalation::LEVEL_OVERDUE  => (int) config('arta.severity.critical_max_days', 5) + 1,
            default                        => 1,
        };
    }

    /** The first day a document reached $level (counted the way its type counts days) */
    public function levelReachedOn(Document $document, Carbon $assigned, int $allowed, string $level): Carbon
    {
        return $this->calendar->addDays($assigned, $allowed + self::firstOverdueDay($level), $document->type);
    }

    private function approachingWindow(int $allowed): int
    {
        return max(1, (int) ceil($allowed * (float) config('arta.approaching_ratio', 0.2)));
    }

    /** A fresh mutable copy in office time (app dates are CarbonImmutable in UTC) */
    private function local(mixed $value): Carbon
    {
        $date = $value instanceof \DateTimeInterface ? Carbon::instance($value) : Carbon::parse($value);

        return $date->copy()->setTimezone($this->calendar->timezone());
    }
}

<?php

namespace App\Services\Cart;

use App\Models\ArtaEscalation;
use App\Models\Document;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * ARTA processing time of one document — the Smart Escalation Algorithm (see config/arta.php):
 * WD = days elapsed since the document was assigned for processing, L = allowable processing period,
 * escalated when WD > L, OD = WD − L decides the severity (Warning / Critical / Overdue).
 */
class ArtaClock
{
    public const WITHIN_TIME = 'within_time';
    public const APPROACHING = 'approaching';
    public const DUE = 'due';
    public const OVERDUE = 'overdue';
    public const COMPLETED = 'completed';

    /** The clock stops once a document reaches one of these */
    public const CLOSED_STATUSES = ['completed', 'released', 'archived'];

    public static function isClosed(Document $document): bool
    {
        return in_array(strtolower((string) $document->status), self::CLOSED_STATUSES, true);
    }

    /**
     * @return array{assigned_at: Carbon, allowed_days: int, elapsed_days: int, remaining_days: int,
     *               overdue_days: int, deadline: Carbon, status: string, severity: ?string, completed_late: bool}
     */
    public function evaluate(Document $document, ?CarbonInterface $now = null): array
    {
        $now = $this->local($now ?? now());
        $assigned = $this->local($document->date_filed ?? $document->created_at ?? $now);
        $closed = self::isClosed($document);
        $end = $closed ? $this->local($document->completed_at ?? $document->updated_at ?? $now) : $now;

        // A deadline set on the document itself overrides the document type's processing period
        $allowed = $document->arta_due_date
            ? max(0, $this->daysBetween($assigned, $this->local($document->arta_due_date)))
            : (int) ($document->type?->arta_processing_days ?: config('arta.default_processing_days', 3));

        $elapsed = max(0, $this->daysBetween($assigned, $end));
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
            'assigned_at'    => $assigned,
            'allowed_days'   => $allowed,
            'elapsed_days'   => $elapsed,
            'remaining_days' => $remaining,
            'overdue_days'   => $overdue,
            'deadline'       => $this->addDays($assigned, $allowed),
            'status'         => $status,
            'severity'       => $closed ? null : self::severityFor($overdue),
            'completed_late' => $closed && $overdue > 0,
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

    /** The first day a document assigned on $assigned with period $allowed reached $level */
    public function levelReachedOn(Carbon $assigned, int $allowed, string $level): Carbon
    {
        return $this->addDays($assigned, $allowed + self::firstOverdueDay($level));
    }

    /** Whole days from one date to another (weekdays only when configured); negative when $to is earlier */
    public function daysBetween(CarbonInterface $from, CarbonInterface $to): int
    {
        $a = $this->local($from)->startOfDay();
        $b = $this->local($to)->startOfDay();

        if (!config('arta.count_working_days')) {
            return (int) round($a->diffInDays($b, false));
        }

        $sign = $b->lt($a) ? -1 : 1;
        [$start, $end] = $sign < 0 ? [$b, $a] : [$a, $b];
        $days = 0;
        for ($day = $start->copy()->addDay(); $day->lte($end); $day->addDay()) {
            if (!$day->isWeekend()) {
                $days++;
            }
        }

        return $sign * $days;
    }

    public function addDays(CarbonInterface $from, int $days): Carbon
    {
        $start = $this->local($from)->startOfDay();

        return config('arta.count_working_days') ? $start->addWeekdays($days) : $start->addDays($days);
    }

    private function approachingWindow(int $allowed): int
    {
        return max(1, (int) ceil($allowed * (float) config('arta.approaching_ratio', 0.2)));
    }

    /** A fresh mutable copy in office time (app dates are CarbonImmutable in UTC) */
    private function local(mixed $value): Carbon
    {
        $date = $value instanceof \DateTimeInterface ? Carbon::instance($value) : Carbon::parse($value);

        return $date->setTimezone(config('arta.timezone', 'Asia/Manila'));
    }
}

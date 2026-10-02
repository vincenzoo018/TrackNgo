<?php

namespace App\Services\Cart;

use App\Models\ArtaEscalation;
use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\RoutingSlip;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Background ARTA monitor (Smart Escalation Algorithm). It evaluates every active document, records an
 * escalation event once per severity level, raises CART alerts once per level, closes escalations of
 * finished documents and writes each event to the audit trail. It never routes or changes the workflow.
 *
 * Runs every five minutes from the scheduler (arta:monitor) and, throttled, when CART pages load.
 */
class ArtaMonitor
{
    /** user_role of audit entries written by the monitor */
    public const ACTOR = 'ARTA Monitor';

    /** Audit entries that are not a handler acting on the document */
    public const NON_HANDLER_ROLES = ['CART', self::ACTOR, 'System / ARTA Monitor'];

    public function __construct(
        protected ArtaClock $clock
    ) {}

    public function syncIfDue(): void
    {
        if (Cache::add('cart:arta-monitor', true, (int) config('arta.sync_interval_seconds', 60))) {
            $this->run();
        }
    }

    /**
     * @return array{escalated: int, alerts: int, closed: int}
     */
    public function run(?CarbonInterface $now = null): array
    {
        $now = Carbon::instance($now ?? now());
        $stats = ['escalated' => 0, 'alerts' => 0, 'closed' => 0];

        $stats['closed'] = $this->closeFinished($now);

        $documents = Document::with(['type', 'department', 'currentHolder', 'currentHolderDepartment'])
            ->whereRaw('LOWER(status) NOT IN (?, ?, ?)', ArtaClock::CLOSED_STATUSES)
            ->get();
        if ($documents->isEmpty()) {
            return $stats;
        }

        $ids = $documents->pluck('document_id');
        $escalations = ArtaEscalation::whereIn('document_id', $ids)->get()->groupBy('document_id');
        $raised = \App\Models\SystemNotification::where('target_role', CartAlerts::ROLE)
            ->whereIn('document_id', $ids)
            ->whereIn('type', [CartAlerts::APPROACHING, CartAlerts::DUE, CartAlerts::INACTIVE])
            ->get(['document_id', 'type', 'created_at'])
            ->groupBy(fn ($alert) => $alert->document_id . ':' . $alert->type);
        $activity = $this->activityTimes($ids);

        foreach ($documents as $document) {
            $timing = $this->clock->evaluate($document, $now);
            $history = $escalations->get($document->document_id, collect());
            $hasActive = $history->contains('resolved', false);

            // E = 1: record each severity level once (a document first seen late starts at its current level)
            if ($timing['severity'] && !$history->contains('escalation_level', $timing['severity'])) {
                $this->escalate($document, $timing, $timing['severity'], $now);
                $stats['escalated']++;
                $hasActive = true;
            } elseif (!$timing['severity'] && in_array($timing['status'], [ArtaClock::APPROACHING, ArtaClock::DUE], true)) {
                $type = $timing['status'] === ArtaClock::DUE ? CartAlerts::DUE : CartAlerts::APPROACHING;
                if (!$raised->has($document->document_id . ':' . $type)) {
                    $this->raiseDeadlineAlert($document, $timing, $type);
                    $stats['alerts']++;
                }
            }

            // A handler escalated it to CART ("Escalate" action) and no escalation is open yet
            if ($document->is_escalated && !$hasActive) {
                $this->recordManualEscalation($document, $timing, $now);
                $stats['escalated']++;
                $hasActive = true;
            }

            $lastActivity = $activity[$document->document_id]['last_activity'] ?? $timing['assigned_at'];
            if (!$hasActive && $this->isInactive($lastActivity, $now)) {
                $alreadyRaised = $raised->get($document->document_id . ':' . CartAlerts::INACTIVE, collect())
                    ->contains(fn ($alert) => Carbon::parse($alert->created_at)->gte($lastActivity));
                if (!$alreadyRaised) {
                    $this->raiseInactivityAlert($document, $lastActivity, $now);
                    $stats['alerts']++;
                }
            }
        }

        return $stats;
    }

    /**
     * When each document reached its current handler and when a handler last acted on it.
     *
     * @return array<int, array{holder_since: Carbon, last_activity: Carbon}>
     */
    public function activityTimes(Collection $documentIds): array
    {
        if ($documentIds->isEmpty()) {
            return [];
        }

        $arrivals = RoutingSlip::whereIn('document_id', $documentIds)
            ->selectRaw('document_id, MAX(COALESCE(date_received, created_at)) as arrived_at')
            ->groupBy('document_id')
            ->pluck('arrived_at', 'document_id');

        $actions = AuditTrail::whereIn('document_id', $documentIds)
            ->whereNotNull('user_id')
            ->where(fn ($q) => $q->whereNull('user_role')->orWhereNotIn('user_role', self::NON_HANDLER_ROLES))
            ->selectRaw('document_id, MAX(timestamp) as acted_at')
            ->groupBy('document_id')
            ->pluck('acted_at', 'document_id');

        $times = [];
        foreach ($documentIds as $id) {
            $since = isset($arrivals[$id]) ? Carbon::parse($arrivals[$id]) : null;
            $acted = isset($actions[$id]) ? Carbon::parse($actions[$id]) : null;
            if ($since || $acted) {
                $times[$id] = [
                    'holder_since'  => $since ?? $acted,
                    'last_activity' => $since && $acted ? $since->max($acted) : ($since ?? $acted),
                ];
            }
        }

        return $times;
    }

    private function escalate(Document $document, array $timing, string $level, Carbon $now): void
    {
        $holder = $this->holderName($document);
        $allowed = $timing['allowed_days'];

        // The event is recorded as of the day the level was reached (OD = the level's first overdue day),
        // so a document first seen late gets the same record as one the monitor caught on time
        $overdue = min($timing['overdue_days'], ArtaClock::firstOverdueDay($level));
        $escalatedAt = Carbon::instance($this->clock->levelReachedOn($timing['assigned_at'], $allowed, $level)->min($now))
            ->setTimezone(config('app.timezone'));
        $reason = sprintf(
            'Exceeded the %d-day processing period by %d day%s (WD %d > L %d).',
            $allowed, $overdue, $overdue === 1 ? '' : 's', $allowed + $overdue, $allowed
        );

        ArtaEscalation::create([
            'document_id'          => $document->document_id,
            'arta_threshold'       => $allowed,
            'days_elapsed'         => $allowed + $overdue,
            'overdue_days'         => $overdue,
            'escalation_level'     => $level,
            'reason'               => $reason,
            'notified_user_id'     => $document->current_holder_id,
            'holder_department_id' => $document->current_holder_department_id,
            // The handler sees "Escalated" in their notifications once the document is flagged
            'notification_sent'    => true,
            'resolved'             => false,
            'escalated_at'         => $escalatedAt,
        ]);
        $this->flagEscalated($document, true);

        CartAlerts::raise($document, CartAlerts::ESCALATED, "Escalated ({$level}): " . CartAlerts::reference($document) . " — {$timing['overdue_days']} day(s) overdue with {$holder}");
        $this->log($document, 'ARTA Escalation', "Escalation level {$level} reached on " . $escalatedAt->copy()->setTimezone(config('arta.timezone'))->format('M d, Y')
            . ". {$reason} Now {$timing['overdue_days']} day(s) overdue. Responsible: {$holder}. CART and the responsible office were notified.");
    }

    /** Recorded from the handler's own "Escalate to CART" action, which is already in the audit trail */
    private function recordManualEscalation(Document $document, array $timing, Carbon $now): void
    {
        $request = AuditTrail::with('user')
            ->where('document_id', $document->document_id)
            ->whereRaw('LOWER(action) = ?', ['escalated'])
            ->orderByDesc('timestamp')
            ->first();
        $justification = $request ? trim((string) preg_replace('/^.*Justification:\s*/s', '', (string) $request->description)) : '';
        $by = $request?->user?->name;

        ArtaEscalation::create([
            'document_id'          => $document->document_id,
            'arta_threshold'       => $timing['allowed_days'],
            'days_elapsed'         => $timing['elapsed_days'],
            'overdue_days'         => $timing['overdue_days'],
            'escalation_level'     => ArtaEscalation::LEVEL_MANUAL,
            'reason'               => mb_substr(($by ? "Escalated to CART by {$by}" : 'Escalated to CART') . ($justification !== '' ? ": {$justification}" : '.'), 0, 255),
            'notified_user_id'     => $document->current_holder_id,
            'holder_department_id' => $document->current_holder_department_id,
            'notification_sent'    => true,
            'resolved'             => false,
            'escalated_at'         => $request?->timestamp ?? $now,
        ]);

        CartAlerts::raise($document, CartAlerts::ESCALATED, 'Escalated to CART' . ($by ? " by {$by}" : '') . ': ' . CartAlerts::reference($document));
    }

    private function raiseDeadlineAlert(Document $document, array $timing, string $type): void
    {
        $reference = CartAlerts::reference($document);
        $holder = $this->holderName($document);
        $title = $type === CartAlerts::DUE
            ? "Deadline reached today: {$reference} (with {$holder})"
            : "Approaching deadline: {$reference} — {$timing['remaining_days']} day(s) left with {$holder}";

        CartAlerts::raise($document, $type, $title);
    }

    private function raiseInactivityAlert(Document $document, Carbon $lastActivity, Carbon $now): void
    {
        $days = intdiv((int) $lastActivity->diffInHours($now), 24);
        $holder = $this->holderName($document);

        CartAlerts::raise($document, CartAlerts::INACTIVE, 'No action for ' . $days . ' day(s): ' . CartAlerts::reference($document) . " with {$holder}");
        $this->log($document, 'Inactivity Alert', "No recorded action for {$days} day(s) while with {$holder}. CART was alerted.");
    }

    /** Measured in elapsed hours: a document received late yesterday is not "2 days" idle this morning */
    private function isInactive(Carbon $lastActivity, Carbon $now): bool
    {
        return $lastActivity->diffInHours($now) >= 24 * (int) config('arta.inactivity_days', 2);
    }

    /** Escalations of documents that have since been completed are closed automatically */
    private function closeFinished(Carbon $now): int
    {
        $open = ArtaEscalation::active()
            ->whereHas('document', fn ($q) => $q->whereRaw('LOWER(status) IN (?, ?, ?)', ArtaClock::CLOSED_STATUSES))
            ->with('document')
            ->get()
            ->groupBy('document_id');

        foreach ($open as $escalations) {
            $document = $escalations->first()->document;
            ArtaEscalation::whereIn('escalation_id', $escalations->pluck('escalation_id'))->update([
                'resolved'         => true,
                'resolved_at'      => $document->completed_at ?? $now,
                'resolution_notes' => 'Closed automatically: the document was completed.',
            ]);
            $this->flagEscalated($document, false);
            $this->log($document, 'Escalation Closed', 'Open escalation closed automatically because the document was completed.');
        }

        return $open->count();
    }

    /** Deadline set on a document changed (e.g. by an administrator) */
    public function deadlineChanged(Document $document): void
    {
        $old = $document->getOriginal('arta_due_date');
        $new = $document->arta_due_date;
        $format = fn ($date) => $date ? Carbon::parse($date)->format('M d, Y') : 'the document type period';
        $actor = auth()->user();

        CartAlerts::raise($document, CartAlerts::DEADLINE_CHANGED, 'Deadline changed: ' . CartAlerts::reference($document) . ' now due ' . $format($new));
        $this->log($document, 'Deadline Changed', 'Processing deadline changed from ' . $format($old) . ' to ' . $format($new)
            . ($actor ? " by {$actor->name}." : '.'), $actor?->id, $actor?->role?->role_name);
    }

    /** Processing period of a document type changed (applies to every document of that type) */
    public function processingPeriodChanged(DocumentType $type): void
    {
        $actor = auth()->user();
        $old = (int) $type->getOriginal('arta_processing_days');
        $new = (int) $type->arta_processing_days;

        CartAlerts::raise(null, CartAlerts::DEADLINE_CHANGED, "Processing period changed: {$type->type_name} {$old} → {$new} days", '/cart/escalations');
        AuditTrail::create([
            'category'    => 'system',
            'user_id'     => $actor?->id,
            'user_role'   => $actor?->role?->role_name ?? self::ACTOR,
            'department'  => $actor?->department?->department_name,
            'action'      => 'Processing Period Changed',
            'description' => "ARTA processing period of {$type->type_name} changed from {$old} to {$new} days.",
            'ip_address'  => request()?->ip(),
            'timestamp'   => now(),
        ]);
    }

    private function flagEscalated(Document $document, bool $escalated): void
    {
        // Query-level update: the flag is monitoring state, not document activity (updated_at stays)
        Document::whereKey($document->document_id)->toBase()->update(['is_escalated' => $escalated]);
        $document->is_escalated = $escalated;
    }

    private function holderName(Document $document): string
    {
        return $document->currentHolder?->name
            ?? $document->currentHolderDepartment?->department_name
            ?? 'the current office';
    }

    private function log(Document $document, string $action, string $description, ?int $userId = null, ?string $role = null): void
    {
        AuditTrail::create([
            'category'     => 'action',
            'document_id'  => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id'      => $userId,
            'user_role'    => $role ?? self::ACTOR,
            'department'   => $document->currentHolderDepartment?->department_name,
            'action'       => $action,
            'description'  => $description,
            'ip_address'   => request()?->ip(),
            'timestamp'    => now(),
        ]);
    }
}

<?php

namespace App\Services\Cart;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\ArtaEscalation;
use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\RoutingSlip;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Document\DocumentConfidentiality;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Read model of the CART monitoring layer: where every document is, who holds it, how long it has been
 * there and where it stands against its ARTA processing period. CART only observes; the two actions here
 * (follow-up notice, resolving an escalation) never touch the document's workflow.
 */
class CartMonitoringService
{
    /** Waiting for the next handler to receive / accept it */
    private const PENDING_STATUSES = ['submitted', 'pending_registration', 'registered', 'sent', 'forwarded', 'endorsed'];

    private const EXTERNAL_STAGES = [
        1 => 'Registration', 2 => 'Department review', 3 => 'Department review', 4 => 'Forwarded to the Mayor',
        5 => "Mayor's review", 6 => "Mayor's review", 7 => 'Release',
    ];

    private const INTERNAL_STAGES = [
        1 => 'Registration', 2 => 'Delivered to recipient', 3 => 'Department review', 4 => 'Forwarded',
        5 => 'Final approval', 6 => 'Completed',
    ];

    private const HOP_ACTIONS = [
        'register' => 'Registered and routed', 'forward' => 'Forwarded', 'endorse' => 'Endorsed',
        'approve'  => 'Approved and sent', 'return' => 'Returned', 'resubmit' => 'Resubmitted',
    ];

    public function __construct(
        protected ArtaClock $clock,
        protected ArtaMonitor $monitor,
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    // ── Monitoring rows ────────────────────────────────────────────────────────────────────────────

    /** Every document (newest first) as a monitoring row; $scope narrows the query */
    public function rows(?callable $scope = null): Collection
    {
        $this->monitor->syncIfDue();

        $query = Document::with(['type', 'department', 'submitter', 'currentHolder.role', 'currentHolderDepartment']);
        if ($scope) {
            $scope($query);
        }

        return $this->rowsFor($query->orderByDesc('document_id')->get());
    }

    public function rowsFor(Collection $documents): Collection
    {
        $ids = $documents->pluck('document_id');
        if ($ids->isEmpty()) {
            return collect();
        }

        $escalations = ArtaEscalation::with('resolver')->whereIn('document_id', $ids)->orderBy('escalation_id')->get()->groupBy('document_id');
        $activity = $this->monitor->activityTimes($ids);
        $followUps = SystemNotification::where('type', CartAlerts::FOLLOW_UP)
            ->whereIn('document_id', $ids)
            ->selectRaw('document_id, MAX(created_at) as sent_at')
            ->groupBy('document_id')
            ->pluck('sent_at', 'document_id');
        $now = now();

        return $documents->map(fn (Document $document) => $this->row(
            $document,
            $escalations->get($document->document_id, collect()),
            $activity[$document->document_id] ?? null,
            $followUps[$document->document_id] ?? null,
            $now
        ))->values();
    }

    private function row(Document $document, Collection $escalations, ?array $activity, ?string $lastFollowUp, CarbonInterface $now): array
    {
        $timing = $this->clock->evaluate($document, $now);
        $closed = $timing['status'] === ArtaClock::COMPLETED;
        $active = $escalations->where('resolved', false)->sortByDesc('escalation_id')->first();
        $latest = $active ?? $escalations->sortByDesc('escalation_id')->first();
        $escalated = !$closed && ($active || $document->is_escalated);

        $holderSince = $activity['holder_since'] ?? $timing['assigned_at'];
        $lastActivity = $activity['last_activity'] ?? $holderSince;
        $followUpAt = $lastFollowUp ? Carbon::parse($lastFollowUp) : null;
        $hasHandler = $document->current_holder_id || $document->current_holder_department_id;
        $cooledDown = !$followUpAt || $followUpAt->lt(Carbon::instance($now)->subHours((int) config('arta.follow_up_cooldown_hours', 24)));

        return [
            'id'                    => $document->document_id,
            'tracking_number'       => CartAlerts::reference($document),
            'reference_number'      => $document->reference_number,
            'title'                 => $document->visibleTitle(),
            'is_confidential'       => DocumentConfidentiality::isConfidential($document),
            'document_type'         => $document->type?->type_name ?? 'General Document',
            'type_id'               => $document->type_id,
            'origin_department'     => $document->department?->department_name,
            'department_id'         => $document->department_id,
            'current_department'    => $document->currentHolderDepartment?->department_name,
            'current_department_id' => $document->current_holder_department_id,
            'current_handler'       => $document->currentHolder?->name,
            'current_handler_id'    => $document->current_holder_id,
            'current_handler_role'  => $document->currentHolder?->role?->role_name,
            'submitted_by'          => $document->submitter?->name ?? $document->sender,
            'is_internal'           => (bool) $document->is_internal,
            'status'                => $document->status,
            'status_label'          => self::statusLabel($document->status),
            'stage'                 => $this->stage($document, $closed),
            'is_closed'             => $closed,
            'is_pending'            => !$closed && in_array(strtolower((string) $document->status), self::PENDING_STATUSES, true),
            'date_received'         => $this->iso($document->date_filed ?? $document->created_at),
            'holder_since'          => $closed ? null : $this->iso($holderSince),
            'last_activity'         => $this->iso($lastActivity),
            // Full days actually elapsed (24-hour periods), like the inactivity alert
            'days_with_handler'     => $closed ? null : intdiv(max(0, (int) $holderSince->diffInHours($now)), 24),
            'idle_days'             => $closed ? null : intdiv(max(0, (int) $lastActivity->diffInHours($now)), 24),
            'allowed_days'          => $timing['allowed_days'],
            'elapsed_days'          => $timing['elapsed_days'],
            'remaining_days'        => $timing['remaining_days'],
            'overdue_days'          => $timing['overdue_days'],
            'deadline'              => $timing['deadline']->toDateString(),
            'arta_status'           => $timing['status'],
            'monitor_status'        => $closed ? ArtaClock::COMPLETED : ($escalated ? 'escalated' : $timing['status']),
            'severity'              => $timing['severity'],
            'completed_at'          => $this->iso($document->completed_at),
            'completed_late'        => $timing['completed_late'],
            'escalation'            => $latest ? $this->escalationData($latest) : null,
            'escalation_count'      => $escalations->count(),
            'last_follow_up_at'     => $this->iso($followUpAt),
            'can_follow_up'         => !$closed && $hasHandler && $cooledDown,
        ];
    }

    public function escalationData(ArtaEscalation $escalation): array
    {
        return [
            'id'           => $escalation->escalation_id,
            'level'        => $escalation->escalation_level,
            'status'       => $escalation->resolved ? 'resolved' : 'active',
            'escalated_at' => $this->iso($escalation->escalated_at),
            'reason'       => $escalation->reason,
            'allowed_days' => $escalation->arta_threshold,
            'elapsed_days' => $escalation->days_elapsed,
            'overdue_days' => $escalation->overdue_days,
            'resolved_at'  => $this->iso($escalation->resolved_at),
            'resolved_by'  => $escalation->resolver?->name ?? ($escalation->resolved ? 'System' : null),
            'notes'        => $escalation->resolution_notes,
        ];
    }

    /** Workflow stage in plain words, e.g. "Department review" (step 3 of 7) */
    private function stage(Document $document, bool $closed): array
    {
        $total = (int) ($document->total_steps ?: ($document->is_internal ? 6 : 7));
        $step = max(1, min((int) ($document->current_step_index ?: 1), $total));
        $status = strtolower((string) $document->status);
        $labels = $document->is_internal ? self::INTERNAL_STAGES : self::EXTERNAL_STAGES;

        $label = match (true) {
            $closed                  => 'Completed',
            $status === 'returned'   => 'Returned for correction',
            $status === 'approved'   => 'For release',
            default                  => $labels[$step] ?? 'In process',
        };

        return ['label' => $label, 'step' => $closed ? $total : $step, 'total' => $total];
    }

    /** Every stage label a document can show, in workflow order */
    public static function stageLabels(): array
    {
        return collect(self::EXTERNAL_STAGES)->merge(self::INTERNAL_STAGES)
            ->merge(['Returned for correction', 'For release', 'Completed'])
            ->unique()->values()->all();
    }

    public static function statusLabel(?string $status): string
    {
        $s = str_replace(['-', '_'], ' ', strtolower(trim((string) $status)));

        return match (true) {
            in_array($s, ['completed', 'complete', 'released'], true)             => 'Completed',
            in_array($s, ['archived', 'archive'], true)                            => 'Archived',
            $s === 'approved'                                                      => 'Approved',
            in_array($s, ['returned', 'rejected', 'return', 'reject'], true)      => 'Returned',
            in_array($s, ['submitted', 'pending registration'], true)              => 'For registration',
            in_array($s, ['sent', 'registered', 'forwarded', 'endorsed'], true)    => 'Awaiting receipt',
            in_array($s, ['accepted', 'received', 'dept accepted', 'mayor accepted'], true) => 'Received',
            default                                                                => 'In process',
        };
    }

    // ── Dashboard ──────────────────────────────────────────────────────────────────────────────────

    public function dashboard(): array
    {
        $rows = $this->rows();
        $active = $rows->where('is_closed', false);
        $byId = $rows->keyBy('id');

        $statusOrder = [ArtaClock::WITHIN_TIME, ArtaClock::APPROACHING, ArtaClock::DUE, ArtaClock::OVERDUE, 'escalated', ArtaClock::COMPLETED];
        $byStatus = collect($statusOrder)->map(fn ($status) => [
            'status' => $status,
            'count'  => $rows->where('monitor_status', $status)->count(),
        ])->values();

        $byDepartment = $active
            ->groupBy(fn ($row) => $row['current_department'] ?? 'Unassigned')
            ->map(fn (Collection $group, string $name) => [
                'department'  => $name,
                'active'      => $group->count(),
                'within_time' => $group->where('arta_status', ArtaClock::WITHIN_TIME)->count(),
                'near'        => $group->whereIn('arta_status', [ArtaClock::APPROACHING, ArtaClock::DUE])->count(),
                'overdue'     => $group->where('arta_status', ArtaClock::OVERDUE)->count(),
                'escalated'   => $group->where('monitor_status', 'escalated')->count(),
            ])
            // Most delayed first, then most near-deadline, then busiest
            ->sortByDesc(fn ($d) => ($d['overdue'] + $d['escalated']) * 1_000_000 + $d['near'] * 1_000 + $d['active'])
            ->values();

        $recentEscalations = ArtaEscalation::orderByDesc('escalated_at')->orderByDesc('escalation_id')->limit(6)->get()
            ->filter(fn ($e) => $byId->has($e->document_id))
            ->map(fn ($e) => ['escalation' => $this->escalationData($e), 'document' => $this->brief($byId[$e->document_id])])
            ->values();

        $nearDeadline = $active
            ->filter(fn ($row) => in_array($row['arta_status'], [ArtaClock::APPROACHING, ArtaClock::DUE], true))
            ->sortBy([['remaining_days', 'asc'], ['deadline', 'asc']])
            ->take(6)
            ->map(fn ($row) => $this->brief($row))
            ->values();

        return [
            'summary' => [
                'total'       => $rows->count(),
                'active'      => $active->count(),
                'pending'     => $active->where('is_pending', true)->count(),
                'in_process'  => $active->where('is_pending', false)->count(),
                'completed'   => $rows->where('is_closed', true)->count(),
                'within_time' => $active->where('arta_status', ArtaClock::WITHIN_TIME)->count(),
                'near'        => $active->whereIn('arta_status', [ArtaClock::APPROACHING, ArtaClock::DUE])->count(),
                'overdue'     => $active->where('arta_status', ArtaClock::OVERDUE)->count(),
                'escalated'   => $active->where('monitor_status', 'escalated')->count(),
            ],
            'byStatus'          => $byStatus,
            'byDepartment'      => $byDepartment,
            'recentEscalations' => $recentEscalations,
            'nearDeadline'      => $nearDeadline,
            'rules'             => $this->rules(),
        ];
    }

    /** The subset of a row the dashboard lists need */
    private function brief(array $row): array
    {
        return collect($row)->only([
            'id', 'tracking_number', 'title', 'document_type', 'current_handler', 'current_department',
            'remaining_days', 'overdue_days', 'deadline', 'arta_status', 'monitor_status', 'stage',
        ])->all();
    }

    /** Escalation rules in force, shown to CART so the statuses are explainable */
    public function rules(): array
    {
        return [
            'working_days'      => (bool) config('arta.count_working_days'),
            'warning_max_days'  => (int) config('arta.severity.warning_max_days', 2),
            'critical_max_days' => (int) config('arta.severity.critical_max_days', 5),
            'approaching_ratio' => (float) config('arta.approaching_ratio', 0.2),
            'inactivity_days'   => (int) config('arta.inactivity_days', 2),
            'follow_up_hours'   => (int) config('arta.follow_up_cooldown_hours', 24),
        ];
    }

    // ── Filter options ─────────────────────────────────────────────────────────────────────────────

    public function filterOptions(): array
    {
        return [
            'departments' => Department::where('is_active', true)->orderBy('department_name')->get(['department_id', 'department_name'])
                ->map(fn ($d) => ['id' => $d->department_id, 'name' => $d->department_name])->values(),
            'documentTypes' => DocumentType::where('is_active', true)->orderBy('type_name')->get(['type_id', 'type_name', 'arta_processing_days'])
                ->map(fn ($t) => ['id' => $t->type_id, 'name' => $t->type_name, 'days' => (int) $t->arta_processing_days])->values(),
        ];
    }

    // ── Document tracking ──────────────────────────────────────────────────────────────────────────

    public function document(int $documentId): array
    {
        $this->monitor->syncIfDue();

        $document = Document::with(['type', 'department', 'submitter.role', 'currentHolder.role', 'currentHolderDepartment', 'destinationDepartment', 'destinationUser'])
            ->findOrFail($documentId);
        $row = $this->rowsFor(collect([$document]))->first();

        $escalations = ArtaEscalation::with(['resolver', 'notifiedUser', 'holderDepartment'])
            ->where('document_id', $documentId)
            ->orderByDesc('escalated_at')
            ->get()
            ->map(fn ($e) => $this->escalationData($e) + [
                'responsible' => $e->notifiedUser?->name ?? $e->holderDepartment?->department_name,
            ])
            ->values();

        $activity = AuditTrail::with(['user.role', 'user.department', 'document'])
            ->where('document_id', $documentId)
            ->orderByDesc('timestamp')
            ->orderByDesc('audit_id')
            ->limit(100)
            ->get()
            ->map(fn ($log) => $this->auditTrail->formatLog($log))
            ->values();

        return [
            'document' => $row + [
                'classification' => DocumentConfidentiality::isConfidential($document) ? 'Confidential' : 'Normal',
                'addressed_to'   => $document->destinationUser?->name ?? $document->destinationDepartment?->department_name,
            ],
            'timeline'    => $this->timeline($document),
            'escalations' => $escalations,
            'activity'    => $activity,
            'rules'       => $this->rules(),
        ];
    }

    /**
     * Tracking timeline: filed → each handler it was routed to (with how long they held it) → completed.
     */
    public function timeline(Document $document): array
    {
        $document->loadMissing(['submitter.role', 'department']);
        $hops = $this->hops(collect([$document]))->get($document->document_id, collect());
        $closed = ArtaClock::isClosed($document);

        $stops = [[
            'kind'       => 'filed',
            'title'      => $document->is_internal ? 'Submitted' : 'Received and filed',
            'actor'      => $document->submitter?->name ?? $document->sender,
            'role'       => $document->submitter?->role?->role_name,
            'department' => $document->department?->department_name,
            'at'         => $this->iso($document->date_filed ?? $document->created_at),
            'duration'   => null,
            'is_current' => false,
        ]];

        foreach ($hops as $index => $hop) {
            $isCurrent = !$closed && $index === $hops->count() - 1;
            $stops[] = [
                'kind'       => 'hop',
                'title'      => $hop['action'] . ($hop['from'] ? " by {$hop['from']}" : ''),
                'actor'      => $hop['handler'] ?? $hop['department'] ?? 'Department pool',
                'role'       => $hop['role'],
                'department' => $hop['department'],
                'at'         => $hop['arrived_at'],
                'duration'   => $this->duration($hop['hours']),
                'is_current' => $isCurrent,
            ];
        }

        if ($closed) {
            $stops[] = [
                'kind'       => 'completed',
                'title'      => 'Completed',
                'actor'      => null,
                'role'       => null,
                'department' => null,
                'at'         => $this->iso($document->completed_at ?? $document->updated_at),
                'duration'   => null,
                'is_current' => false,
            ];
        }

        return $stops;
    }

    /**
     * Routing hops per document: who received it, when, and how long it stayed (until the next hop, the
     * document's completion, or now).
     *
     * @return Collection<int, Collection<int, array>>
     */
    public function hops(Collection $documents): Collection
    {
        $byId = $documents->keyBy('document_id');
        $now = now();

        return RoutingSlip::with(['fromUser', 'toUser.role', 'targetDepartment', 'toUser.department'])
            ->whereIn('document_id', $byId->keys())
            ->orderBy('slip_id')
            ->get()
            ->groupBy('document_id')
            ->map(function (Collection $slips, $documentId) use ($byId, $now) {
                $document = $byId[$documentId];
                $end = ArtaClock::isClosed($document) ? ($document->completed_at ?? $document->updated_at ?? $now) : $now;
                $slips = $slips->values();

                return $slips->map(function (RoutingSlip $slip, int $i) use ($slips, $end) {
                    $arrived = Carbon::parse($slip->date_received ?? $slip->created_at);
                    $next = $slips->get($i + 1);
                    $left = $next ? Carbon::parse($next->date_received ?? $next->created_at) : Carbon::parse($end);

                    return [
                        'step'          => $i + 1,
                        'action'        => self::HOP_ACTIONS[strtolower((string) $slip->action)] ?? 'Forwarded',
                        'from'          => $slip->fromUser?->name ?? $slip->sender_name,
                        'handler'       => $slip->toUser?->name,
                        'role'          => $slip->toUser?->role?->role_name,
                        'department'    => $slip->targetDepartment?->department_name ?? $slip->toUser?->department?->department_name,
                        'department_id' => $slip->target_department_id ?? $slip->toUser?->department_id,
                        'arrived_at'    => $this->iso($arrived),
                        'left_at'       => $next ? $this->iso($left) : null,
                        'hours'         => max(0, (int) round($arrived->diffInMinutes($left) / 60)),
                    ];
                })->values();
            });
    }

    // ── CART actions (monitoring only) ─────────────────────────────────────────────────────────────

    /** Marks the document's open escalation(s) resolved; the document itself is not touched */
    public function resolveEscalation(int $documentId, User $actor, string $notes): void
    {
        $document = Document::with('currentHolderDepartment')->findOrFail($documentId);
        $open = ArtaEscalation::active()->where('document_id', $documentId)->get();

        if ($open->isEmpty() && $document->is_escalated) {
            // Escalated by a handler moments ago and not recorded yet
            $this->monitor->run();
            $open = ArtaEscalation::active()->where('document_id', $documentId)->get();
        }
        if ($open->isEmpty()) {
            throw ValidationException::withMessages(['notes' => 'This document has no open escalation.']);
        }

        ArtaEscalation::whereIn('escalation_id', $open->pluck('escalation_id'))->update([
            'resolved'         => true,
            'resolved_at'      => now(),
            'resolved_by'      => $actor->id,
            'resolution_notes' => $notes,
        ]);
        Document::whereKey($documentId)->toBase()->update(['is_escalated' => false]);

        $levels = $open->pluck('escalation_level')->unique()->join(', ');
        $this->auditTrail->logDocumentAction(
            document: $document,
            action: 'Resolve Escalation',
            description: "Escalation ({$levels}) resolved by {$actor->name}. Notes: {$notes}",
            actor: $actor
        );
        CartAlerts::raise($document, CartAlerts::RESOLVED, 'Escalation resolved: ' . CartAlerts::reference($document) . " by {$actor->name}", read: true);
    }

    /** Notice to the current handler asking them to act; limited to one per handler per cooldown */
    public function sendFollowUp(int $documentId, User $actor, ?string $message = null): string
    {
        $document = Document::with(['type', 'currentHolder', 'currentHolderDepartment'])->findOrFail($documentId);
        if (ArtaClock::isClosed($document)) {
            throw ValidationException::withMessages(['message' => 'This document is already completed.']);
        }
        if (!$document->current_holder_id && !$document->current_holder_department_id) {
            throw ValidationException::withMessages(['message' => 'This document has no current handler to follow up.']);
        }

        $handler = $document->currentHolder?->name ?? $document->currentHolderDepartment?->department_name;
        $cooldown = (int) config('arta.follow_up_cooldown_hours', 24);
        $recent = SystemNotification::where('type', CartAlerts::FOLLOW_UP)
            ->where('document_id', $documentId)
            ->where(fn ($q) => $document->current_holder_id
                ? $q->where('user_id', $document->current_holder_id)
                : $q->whereNull('user_id')->where('target_department_id', $document->current_holder_department_id))
            ->where('created_at', '>=', now()->subHours($cooldown))
            ->latest()
            ->first();
        if ($recent) {
            throw ValidationException::withMessages([
                'message' => "A follow-up was already sent to {$handler} on " . Carbon::parse($recent->created_at)->setTimezone(config('arta.timezone'))->format('M d, h:i A')
                    . ". Only one follow-up per {$cooldown} hours is allowed.",
            ]);
        }

        $message = trim((string) $message) ?: $this->defaultFollowUpMessage($document);
        $reference = CartAlerts::reference($document);

        SystemNotification::create([
            'document_id'            => $document->document_id,
            'user_id'                => $document->current_holder_id,
            'target_role'            => null,
            'target_department_id'   => $document->current_holder_department_id,
            'type'                   => CartAlerts::FOLLOW_UP,
            'severity'               => 'warning',
            'title'                  => mb_substr("CART follow-up on {$reference}: {$message}", 0, 150),
            'reference_number'       => $reference,
            'document_type'          => $document->type?->type_name,
            'originating_department' => 'CART',
            'action_url'             => "/documents/{$document->document_id}",
            'is_read'                => false,
        ]);

        $this->auditTrail->logDocumentAction(
            document: $document,
            action: 'CART Follow-up',
            description: "Follow-up sent to {$handler}: {$message}",
            actor: $actor
        );

        return $handler;
    }

    public function defaultFollowUpMessage(Document $document): string
    {
        $timing = $this->clock->evaluate($document);

        return match ($timing['status']) {
            ArtaClock::OVERDUE     => "This document is {$timing['overdue_days']} day(s) past its {$timing['allowed_days']}-day processing period. Please act on it as soon as possible.",
            ArtaClock::DUE         => 'This document reaches its processing deadline today. Please complete your action today.',
            ArtaClock::APPROACHING => "{$timing['remaining_days']} day(s) remain before this document's processing deadline. Please act on it.",
            default                => 'Please update CART on the status of this document.',
        };
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────────────────────

    public function duration(?int $hours): ?string
    {
        if ($hours === null) {
            return null;
        }
        if ($hours < 1) {
            return 'under 1 hour';
        }
        if ($hours < 24) {
            return $hours . ' hr' . ($hours === 1 ? '' : 's');
        }
        $days = intdiv($hours, 24);
        $rest = $hours % 24;

        return $days . ' day' . ($days === 1 ? '' : 's') . ($rest ? " {$rest} hr" . ($rest === 1 ? '' : 's') : '');
    }

    public function iso(mixed $value): ?string
    {
        if (!$value) {
            return null;
        }

        return ($value instanceof \DateTimeInterface ? Carbon::instance($value) : Carbon::parse($value))->toIso8601String();
    }
}

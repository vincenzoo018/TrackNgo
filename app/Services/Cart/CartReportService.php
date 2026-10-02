<?php

namespace App\Services\Cart;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\ArtaEscalation;
use App\Models\Document;
use App\Models\ReportLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * CART monitoring and compliance reports. Every report is built from the same monitoring rows the CART
 * pages show, so the numbers always agree; exports are recorded in report_logs and the audit trail.
 */
class CartReportService
{
    public const TYPES = [
        'processing'      => ['label' => 'Document Processing', 'description' => 'Documents received in the period and how far each has gone.'],
        'delayed'         => ['label' => 'Delayed Documents', 'description' => 'Documents that went past their allowed processing period.'],
        'escalations'     => ['label' => 'Escalations', 'description' => 'Every escalation event, its level, and how it was resolved.'],
        'departments'     => ['label' => 'Department Processing', 'description' => 'Documents each department handled and how long it held them.'],
        'processing_time' => ['label' => 'Processing Time', 'description' => 'How long each workflow stage took, step by step.'],
        'compliance'      => ['label' => 'ARTA Compliance', 'description' => 'Each document against its ARTA processing period.'],
    ];

    public const STATUS_LABELS = [
        ArtaClock::WITHIN_TIME => 'Within time',
        ArtaClock::APPROACHING => 'Approaching deadline',
        ArtaClock::DUE         => 'Due today',
        ArtaClock::OVERDUE     => 'Overdue',
        'escalated'            => 'Escalated',
        ArtaClock::COMPLETED   => 'Completed',
    ];

    public function __construct(
        protected CartMonitoringService $monitoring,
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    public function filters(array $input): array
    {
        $date = fn ($value) => is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
        $id = fn ($value) => is_numeric($value) ? (int) $value : null;

        return [
            'report'     => array_key_exists($input['report'] ?? '', self::TYPES) ? $input['report'] : 'processing',
            'from'       => $date($input['from'] ?? null),
            'to'         => $date($input['to'] ?? null),
            'department' => $id($input['department'] ?? null),
            'type'       => $id($input['type'] ?? null),
            'status'     => array_key_exists($input['status'] ?? '', self::STATUS_LABELS) ? $input['status'] : null,
            'stage'      => is_string($input['stage'] ?? null) && $input['stage'] !== '' ? mb_substr($input['stage'], 0, 60) : null,
            'escalation' => in_array($input['escalation'] ?? null, ['active', 'resolved', 'none'], true) ? $input['escalation'] : null,
        ];
    }

    /**
     * @return array{columns: array, rows: array, summary: array}
     */
    public function build(array $filters): array
    {
        return match ($filters['report']) {
            'delayed'         => $this->delayed($filters),
            'escalations'     => $this->escalations($filters),
            'departments'     => $this->departments($filters),
            'processing_time' => $this->processingTime($filters),
            'compliance'      => $this->compliance($filters),
            default           => $this->processing($filters),
        };
    }

    /** Options of the "Processing stage" filter */
    public function stageOptions(): array
    {
        return CartMonitoringService::stageLabels();
    }

    // ── Reports ────────────────────────────────────────────────────────────────────────────────────

    private function processing(array $filters): array
    {
        $rows = $this->rows($filters);
        $completed = $rows->where('is_closed', true);
        $onTime = $completed->where('completed_late', false)->count();

        return [
            'columns' => [
                $this->col('tracking_number', 'Tracking #', 'link'),
                $this->col('title', 'Title'),
                $this->col('document_type', 'Type'),
                $this->col('origin_department', 'Department'),
                $this->col('date_received', 'Received', 'datetime'),
                $this->col('stage_label', 'Stage'),
                $this->col('completed_at', 'Completed', 'datetime'),
                $this->col('elapsed_days', 'Days taken', 'number'),
                $this->col('monitor_status', 'ARTA status', 'status'),
            ],
            'rows' => $rows->map(fn ($r) => $this->pick($r, ['title', 'document_type', 'origin_department', 'date_received', 'completed_at', 'elapsed_days', 'monitor_status'])
                + ['stage_label' => $r['stage']['label']])->values()->all(),
            'summary' => [
                ['label' => 'Documents', 'value' => $rows->count()],
                ['label' => 'Completed', 'value' => $completed->count()],
                ['label' => 'In process', 'value' => $rows->count() - $completed->count()],
                ['label' => 'Completed on time', 'value' => $completed->count() ? round($onTime / $completed->count() * 100) . '%' : '—'],
            ],
        ];
    }

    private function delayed(array $filters): array
    {
        $rows = $this->rows($filters)->filter(fn ($r) => $r['overdue_days'] > 0)->sortByDesc('overdue_days');
        $open = $rows->where('is_closed', false);

        return [
            'columns' => [
                $this->col('tracking_number', 'Tracking #', 'link'),
                $this->col('title', 'Title'),
                $this->col('document_type', 'Type'),
                $this->col('handler', 'With'),
                $this->col('date_received', 'Received', 'datetime'),
                $this->col('deadline', 'Deadline', 'date'),
                $this->col('overdue_days', 'Days overdue', 'number'),
                $this->col('state', 'State'),
                $this->col('escalation_level', 'Escalation', 'level'),
            ],
            'rows' => $rows->map(fn ($r) => $this->pick($r, ['title', 'document_type', 'date_received', 'deadline', 'overdue_days']) + [
                'handler'          => $r['is_closed'] ? '—' : $this->handler($r),
                'state'            => $r['is_closed'] ? 'Completed late' : 'Still open',
                'escalation_level' => $r['escalation']['level'] ?? null,
            ])->values()->all(),
            'summary' => [
                ['label' => 'Delayed documents', 'value' => $rows->count()],
                ['label' => 'Still open', 'value' => $open->count()],
                ['label' => 'Completed late', 'value' => $rows->count() - $open->count()],
                ['label' => 'Average days overdue', 'value' => $rows->count() ? round($rows->avg('overdue_days'), 1) : '—'],
            ],
        ];
    }

    private function escalations(array $filters): array
    {
        // The date range applies to when the escalation happened, not when the document was received
        $rows = $this->rows($filters, withDates: false)->keyBy('id');
        [$from, $to] = $this->range($filters);

        $escalations = ArtaEscalation::with(['resolver', 'notifiedUser', 'holderDepartment'])
            ->whereIn('document_id', $rows->keys())
            ->when($from, fn ($q) => $q->where('escalated_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('escalated_at', '<=', $to))
            ->orderByDesc('escalated_at')
            ->get();

        return [
            'columns' => [
                $this->col('tracking_number', 'Tracking #', 'link'),
                $this->col('document_type', 'Type'),
                $this->col('level', 'Level', 'level'),
                $this->col('escalated_at', 'Escalated', 'datetime'),
                $this->col('days', 'WD / L'),
                $this->col('overdue_days', 'Days overdue', 'number'),
                $this->col('responsible', 'Responsible'),
                $this->col('reason', 'Reason'),
                $this->col('state', 'Status'),
                $this->col('resolved_by', 'Resolved by'),
                $this->col('resolved_at', 'Resolved', 'datetime'),
                $this->col('notes', 'Notes'),
            ],
            'rows' => $escalations->map(fn (ArtaEscalation $e) => [
                'id'              => $e->document_id,
                'tracking_number' => $rows[$e->document_id]['tracking_number'],
                'document_type'   => $rows[$e->document_id]['document_type'],
                'level'           => $e->escalation_level,
                'escalated_at'    => $this->monitoring->iso($e->escalated_at),
                'days'            => "{$e->days_elapsed} / {$e->arta_threshold}",
                'overdue_days'    => (int) $e->overdue_days,
                'responsible'     => $e->notifiedUser?->name ?? $e->holderDepartment?->department_name ?? '—',
                'reason'          => $e->reason,
                'state'           => $e->resolved ? 'Resolved' : 'Active',
                'resolved_by'     => $e->resolver?->name ?? ($e->resolved ? 'System' : null),
                'resolved_at'     => $this->monitoring->iso($e->resolved_at),
                'notes'           => $e->resolution_notes,
            ])->values()->all(),
            'summary' => [
                ['label' => 'Escalations', 'value' => $escalations->count()],
                ['label' => 'Active', 'value' => $escalations->where('resolved', false)->count()],
                ['label' => 'Resolved', 'value' => $escalations->where('resolved', true)->count()],
                ['label' => 'Critical or Overdue', 'value' => $escalations->whereIn('escalation_level', [ArtaEscalation::LEVEL_CRITICAL, ArtaEscalation::LEVEL_OVERDUE])->count()],
            ],
        ];
    }

    private function departments(array $filters): array
    {
        $rows = $this->rows($filters);
        $hops = $this->hopsFor($rows)->flatten(1);
        $open = $rows->where('is_closed', false);

        $departments = $hops->groupBy(fn ($hop) => $hop['department'] ?? 'Unassigned')
            ->map(function (Collection $group, string $name) use ($open) {
                $holding = $open->where('current_department', $name);

                return [
                    'department'        => $name,
                    'documents'         => $group->pluck('document_id')->unique()->count(),
                    'currently_holding' => $holding->count(),
                    'currently_delayed' => $holding->where('arta_status', ArtaClock::OVERDUE)->count(),
                    'average_hold'      => $this->monitoring->duration((int) round($group->avg('hours'))),
                    'average_hours'     => (int) round($group->avg('hours')),
                    'longest_hold'      => $this->monitoring->duration((int) $group->max('hours')),
                ];
            })
            ->sortByDesc('average_hours')
            ->values();

        return [
            'columns' => [
                $this->col('department', 'Department'),
                $this->col('documents', 'Documents handled', 'number'),
                $this->col('currently_holding', 'Holding now', 'number'),
                $this->col('currently_delayed', 'Delayed now', 'number'),
                $this->col('average_hold', 'Average time held'),
                $this->col('average_hours', 'Average hours', 'number'),
                $this->col('longest_hold', 'Longest hold'),
            ],
            'rows' => $departments->all(),
            'summary' => [
                ['label' => 'Departments', 'value' => $departments->count()],
                ['label' => 'Documents', 'value' => $rows->count()],
                ['label' => 'Average time held', 'value' => $hops->isNotEmpty() ? $this->monitoring->duration((int) round($hops->avg('hours'))) : '—'],
                ['label' => 'Delayed now', 'value' => $departments->sum('currently_delayed')],
            ],
        ];
    }

    private function processingTime(array $filters): array
    {
        $rows = $this->rows($filters)->keyBy('id');
        $hops = $this->hopsFor($rows)->flatten(1)->values();

        return [
            'columns' => [
                $this->col('tracking_number', 'Tracking #', 'link'),
                $this->col('document_type', 'Type'),
                $this->col('step', 'Step', 'number'),
                $this->col('action', 'Action'),
                $this->col('handler', 'Handler'),
                $this->col('department', 'Department'),
                $this->col('arrived_at', 'Received', 'datetime'),
                $this->col('left_at', 'Passed on', 'datetime'),
                $this->col('time_held', 'Time held'),
                $this->col('hours', 'Hours', 'number'),
            ],
            'rows' => $hops->map(fn ($hop) => [
                'id'              => $hop['document_id'],
                'tracking_number' => $rows[$hop['document_id']]['tracking_number'],
                'document_type'   => $rows[$hop['document_id']]['document_type'],
                'step'            => $hop['step'],
                'action'          => $hop['action'],
                'handler'         => $hop['handler'] ?? '—',
                'department'      => $hop['department'] ?? '—',
                'arrived_at'      => $hop['arrived_at'],
                'left_at'         => $hop['left_at'],
                'time_held'       => $this->monitoring->duration($hop['hours']) . ($hop['left_at'] ? '' : ' (still held)'),
                'hours'           => $hop['hours'],
            ])->all(),
            'summary' => [
                ['label' => 'Documents', 'value' => $rows->count()],
                ['label' => 'Workflow steps', 'value' => $hops->count()],
                ['label' => 'Average per step', 'value' => $hops->isNotEmpty() ? $this->monitoring->duration((int) round($hops->avg('hours'))) : '—'],
                ['label' => 'Longest step', 'value' => $hops->isNotEmpty() ? $this->monitoring->duration((int) $hops->max('hours')) : '—'],
            ],
        ];
    }

    private function compliance(array $filters): array
    {
        $rows = $this->rows($filters);
        $compliant = $rows->filter(fn ($r) => $r['overdue_days'] === 0)->count();

        return [
            'columns' => [
                $this->col('tracking_number', 'Tracking #', 'link'),
                $this->col('title', 'Title'),
                $this->col('document_type', 'Type'),
                $this->col('handler', 'With'),
                $this->col('date_received', 'Received', 'datetime'),
                $this->col('allowed_days', 'Allowed (L)', 'number'),
                $this->col('elapsed_days', 'Elapsed (WD)', 'number'),
                $this->col('remaining_days', 'Remaining', 'remaining'),
                $this->col('monitor_status', 'ARTA status', 'status'),
                $this->col('escalation_level', 'Escalation', 'level'),
            ],
            'rows' => $rows->map(fn ($r) => $this->pick($r, ['title', 'document_type', 'date_received', 'allowed_days', 'elapsed_days', 'remaining_days', 'monitor_status']) + [
                'handler'          => $r['is_closed'] ? '—' : $this->handler($r),
                'escalation_level' => $r['escalation']['level'] ?? null,
            ])->values()->all(),
            'summary' => [
                ['label' => 'Documents', 'value' => $rows->count()],
                ['label' => 'Compliance rate', 'value' => $rows->count() ? round($compliant / $rows->count() * 100) . '%' : '—'],
                ['label' => 'Near deadline', 'value' => $rows->whereIn('monitor_status', [ArtaClock::APPROACHING, ArtaClock::DUE])->count()],
                ['label' => 'Overdue or escalated', 'value' => $rows->whereIn('monitor_status', [ArtaClock::OVERDUE, 'escalated'])->count()],
            ],
        ];
    }

    // ── Export ─────────────────────────────────────────────────────────────────────────────────────

    public function export(array $filters, User $actor, ?string $ip = null): StreamedResponse
    {
        $report = $this->build($filters);
        $label = self::TYPES[$filters['report']]['label'];
        $columns = array_values(array_filter($report['columns'], fn ($c) => $c['kind'] !== 'hidden'));

        ReportLog::create([
            'generated_by' => $actor->id,
            'report_type'  => "CART: {$label}",
            'date_from'    => $filters['from'] ?? collect($report['rows'])->pluck('date_received')->filter()->min() ?? now(),
            'date_to'      => $filters['to'] ?? now(),
            'generated_at' => now(),
        ]);
        $this->auditTrail->logUserAction(
            action: 'Report Exported',
            description: "CART exported the {$label} report (" . count($report['rows']) . ' rows).',
            actor: $actor,
            ipAddress: $ip
        );

        $filename = 'cart-' . str_replace('_', '-', $filters['report']) . '-report-' . now()->setTimezone(config('arta.timezone'))->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($report, $columns) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel keeps accents (e.g. "Niño")
            fputcsv($out, array_column($columns, 'label'));
            foreach ($report['rows'] as $row) {
                fputcsv($out, array_map(fn ($column) => $this->csvValue($row[$column['key']] ?? null, $column['kind']), $columns));
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function csvValue(mixed $value, string $kind): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return match ($kind) {
            'datetime'  => Carbon::parse($value)->setTimezone(config('arta.timezone'))->format('Y-m-d H:i'),
            'date'      => Carbon::parse($value)->format('Y-m-d'),
            'status'    => self::STATUS_LABELS[$value] ?? (string) $value,
            default     => (string) $value,
        };
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────────────────────

    /** Monitoring rows matching the report filters */
    private function rows(array $filters, bool $withDates = true): Collection
    {
        [$from, $to] = $withDates ? $this->range($filters) : [null, null];

        return $this->monitoring->rows(function (Builder $query) use ($filters, $from, $to) {
            $query->when($from, fn ($q) => $q->where('date_filed', '>=', $from))
                ->when($to, fn ($q) => $q->where('date_filed', '<=', $to))
                ->when($filters['type'], fn ($q) => $q->where('type_id', $filters['type']))
                ->when($filters['department'], fn ($q) => $q->where(fn ($d) => $d
                    ->where('department_id', $filters['department'])
                    ->orWhere('current_holder_department_id', $filters['department'])));
        })->filter(function (array $row) use ($filters) {
            $escalation = $row['escalation']['status'] ?? 'none';

            return (!$filters['status'] || $row['monitor_status'] === $filters['status'])
                && (!$filters['stage'] || $row['stage']['label'] === $filters['stage'])
                && (!$filters['escalation'] || $escalation === $filters['escalation']);
        })->values();
    }

    /** From / to dates (office time) as app-time bounds */
    private function range(array $filters): array
    {
        $tz = config('arta.timezone');
        $bound = fn (?string $date, bool $end) => $date
            ? ($end ? Carbon::parse($date, $tz)->endOfDay() : Carbon::parse($date, $tz)->startOfDay())->setTimezone(config('app.timezone'))
            : null;

        return [$bound($filters['from'], false), $bound($filters['to'], true)];
    }

    private function hopsFor(Collection $rows): Collection
    {
        $documents = Document::whereIn('document_id', $rows->pluck('id'))->get(['document_id', 'status', 'completed_at', 'updated_at']);

        return $this->monitoring->hops($documents)
            ->map(fn (Collection $hops, $documentId) => $hops->map(fn ($hop) => $hop + ['document_id' => (int) $documentId]));
    }

    private function handler(array $row): string
    {
        return $row['current_handler']
            ? $row['current_handler'] . ($row['current_department'] ? " ({$row['current_department']})" : '')
            : ($row['current_department'] ?? '—');
    }

    private function pick(array $row, array $keys): array
    {
        return ['id' => $row['id'], 'tracking_number' => $row['tracking_number']] + array_intersect_key($row, array_flip($keys));
    }

    private function col(string $key, string $label, string $kind = 'text'): array
    {
        return ['key' => $key, 'label' => $label, 'kind' => $kind];
    }
}

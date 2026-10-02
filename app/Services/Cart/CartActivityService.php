<?php

namespace App\Services\Cart;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\SystemNotification;
use App\Models\User;
use Carbon\Carbon;

/**
 * CART alerts inbox and the read-only document audit trail (paginated on the server: both only grow).
 */
class CartActivityService
{
    /** Audit actions written by escalation and monitoring, as opposed to the document workflow */
    public const MONITORING_ACTIONS = [
        'escalated', 'ARTA Escalation', 'Resolve Escalation', 'Escalation Closed', 'CART Follow-up',
        'Deadline Status Change', 'Inactivity Alert', 'Deadline Changed',
    ];

    private const PAGE_SIZES = [20, 50, 100];

    public function __construct(
        protected CartMonitoringService $monitoring,
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    public function alerts(array $input): array
    {
        $filters = [
            'type'   => array_key_exists($input['type'] ?? '', CartAlerts::LABELS) ? $input['type'] : null,
            'read'   => in_array($input['read'] ?? null, ['unread', 'read'], true) ? $input['read'] : null,
            'search' => trim((string) ($input['search'] ?? '')),
        ];

        $page = SystemNotification::where('target_role', CartAlerts::ROLE)
            ->when($filters['type'], fn ($q) => $q->where('type', $filters['type']))
            ->when($filters['read'] === 'unread', fn ($q) => $q->where('is_read', false))
            ->when($filters['read'] === 'read', fn ($q) => $q->where('is_read', true))
            ->when($filters['search'] !== '', fn ($q) => $q->where(fn ($s) => $s
                ->where('reference_number', 'like', "%{$filters['search']}%")
                ->orWhere('title', 'like', "%{$filters['search']}%")))
            ->orderBy('is_read')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($this->perPage($input))
            ->withQueryString();

        // Current handler and status are live, not what they were when the alert was raised
        $documents = Document::with(['type', 'department', 'submitter', 'currentHolder.role', 'currentHolderDepartment'])
            ->whereIn('document_id', collect($page->items())->pluck('document_id')->filter()->unique())
            ->get();
        $rows = $this->monitoring->rowsFor($documents)->keyBy('id');

        $unread = SystemNotification::where('target_role', CartAlerts::ROLE)->where('is_read', false)
            ->selectRaw('type, COUNT(*) as total')->groupBy('type')->pluck('total', 'type');

        return [
            'alerts' => collect($page->items())->map(function (SystemNotification $alert) use ($rows) {
                $row = $rows[$alert->document_id] ?? null;

                return [
                    'id'               => $alert->id,
                    'type'             => $alert->type,
                    'type_label'       => CartAlerts::LABELS[$alert->type] ?? 'Alert',
                    'title'            => $alert->title,
                    'document_id'      => $alert->document_id,
                    'tracking_number'  => $row['tracking_number'] ?? $alert->reference_number,
                    'document_type'    => $row['document_type'] ?? $alert->document_type,
                    'current_handler'  => $row['current_handler'] ?? null,
                    'department'       => $row['current_department'] ?? $alert->originating_department,
                    'monitor_status'   => $row['monitor_status'] ?? null,
                    'created_at'       => Carbon::parse($alert->created_at)->toIso8601String(),
                    'is_read'          => (bool) $alert->is_read,
                    'action_url'       => $alert->document_id ? "/cart/monitoring/{$alert->document_id}" : ($alert->action_url ?: null),
                ];
            })->values(),
            'pagination' => $this->pagination($page),
            'filters'    => $filters,
            'types'      => collect(CartAlerts::LABELS)->map(fn ($label, $type) => [
                'id' => $type, 'label' => $label, 'unread' => (int) ($unread[$type] ?? 0),
            ])->values(),
            'unreadTotal' => (int) $unread->sum(),
        ];
    }

    public function markRead(int $alertId): void
    {
        SystemNotification::where('target_role', CartAlerts::ROLE)->whereKey($alertId)->update(['is_read' => true]);
    }

    public function auditTrail(array $input): array
    {
        $date = fn ($value) => is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
        $filters = [
            'search'   => trim((string) ($input['search'] ?? '')),
            'kind'     => in_array($input['kind'] ?? null, ['workflow', 'monitoring'], true) ? $input['kind'] : null,
            'user'     => is_numeric($input['user'] ?? null) ? (int) $input['user'] : null,
            'from'     => $date($input['from'] ?? null),
            'to'       => $date($input['to'] ?? null),
            'document' => is_numeric($input['document'] ?? null) ? (int) $input['document'] : null,
        ];
        $tz = config('arta.timezone');

        $page = AuditTrail::with(['user.role', 'user.department', 'document'])
            ->where('category', 'action')
            ->whereNotNull('document_id')
            ->when($filters['document'], fn ($q) => $q->where('document_id', $filters['document']))
            ->when($filters['kind'] === 'monitoring', fn ($q) => $q->whereIn('action', self::MONITORING_ACTIONS))
            ->when($filters['kind'] === 'workflow', fn ($q) => $q->whereNotIn('action', self::MONITORING_ACTIONS))
            ->when($filters['user'], fn ($q) => $q->where('user_id', $filters['user']))
            ->when($filters['from'], fn ($q) => $q->where('timestamp', '>=', Carbon::parse($filters['from'], $tz)->startOfDay()->setTimezone(config('app.timezone'))))
            ->when($filters['to'], fn ($q) => $q->where('timestamp', '<=', Carbon::parse($filters['to'], $tz)->endOfDay()->setTimezone(config('app.timezone'))))
            ->when($filters['search'] !== '', fn ($q) => $q->where(fn ($s) => $s
                ->where('document_ref', 'like', "%{$filters['search']}%")
                ->orWhere('action', 'like', "%{$filters['search']}%")
                ->orWhere('description', 'like', "%{$filters['search']}%")
                ->orWhereHas('document', fn ($d) => $d->where('tracking_number', 'like', "%{$filters['search']}%"))))
            ->orderByDesc('timestamp')
            ->orderByDesc('audit_id')
            ->paginate($this->perPage($input))
            ->withQueryString();

        $document = $filters['document'] ? Document::find($filters['document']) : null;

        return [
            'entries' => collect($page->items())->map(fn (AuditTrail $log) => $this->auditTrail->formatLog($log) + [
                'kind'            => in_array($log->action, self::MONITORING_ACTIONS, true) ? 'monitoring' : 'workflow',
                'tracking_number' => $log->document ? CartAlerts::reference($log->document) : $log->document_ref,
            ])->values(),
            'pagination' => $this->pagination($page),
            'filters'    => $filters,
            'users'      => User::whereIn('id', AuditTrail::where('category', 'action')->whereNotNull('user_id')->distinct()->pluck('user_id'))
                ->orderBy('first_name')->get()->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values(),
            'documentFilter' => $document ? ['id' => $document->document_id, 'tracking_number' => CartAlerts::reference($document)] : null,
        ];
    }

    private function perPage(array $input): int
    {
        $size = (int) ($input['per_page'] ?? 20);

        return in_array($size, self::PAGE_SIZES, true) ? $size : 20;
    }

    private function pagination($page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'per_page'     => $page->perPage(),
            'total'        => $page->total(),
        ];
    }
}

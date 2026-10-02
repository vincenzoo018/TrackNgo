<?php

namespace App\Services\Cart;

use App\Models\ArtaEscalation;
use App\Models\Document;
use App\Models\SystemNotification;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * CART alerts are system notifications addressed to the CART role. Each alert fires once per document and
 * level (the ARTA monitor checks before raising one), so CART is not flooded by repeated reminders.
 */
class CartAlerts
{
    public const ROLE = 'CART';

    public const APPROACHING = 'arta_approaching';
    public const DUE = 'arta_due';
    public const ESCALATED = 'arta_escalated';
    public const INACTIVE = 'arta_inactive';
    public const RESOLVED = 'arta_resolved';
    public const DEADLINE_CHANGED = 'arta_deadline_changed';

    /** Sent by CART to the document's current handler (shows in the handler's bell, not CART's) */
    public const FOLLOW_UP = 'arta_follow_up';

    public const LABELS = [
        self::APPROACHING      => 'Approaching deadline',
        self::DUE              => 'Deadline reached',
        self::ESCALATED        => 'Escalated',
        self::INACTIVE         => 'Inactive too long',
        self::RESOLVED         => 'Escalation resolved',
        self::DEADLINE_CHANGED => 'Deadline changed',
    ];

    private const SEVERITY = [
        self::APPROACHING      => 'warning',
        self::DUE              => 'warning',
        self::ESCALATED        => 'escalated',
        self::INACTIVE         => 'warning',
        self::RESOLVED         => 'normal',
        self::DEADLINE_CHANGED => 'normal',
    ];

    private const ICONS = [
        self::APPROACHING      => '⏳',
        self::DUE              => '⚠',
        self::ESCALATED        => '⚡',
        self::INACTIVE         => '💤',
        self::RESOLVED         => '✔',
        self::DEADLINE_CHANGED => '📅',
    ];

    public static function raise(?Document $document, string $type, string $title, ?string $actionUrl = null, bool $read = false): SystemNotification
    {
        $document?->loadMissing(['type', 'currentHolderDepartment', 'department']);

        return SystemNotification::create([
            'document_id'            => $document?->document_id,
            'user_id'                => null,
            'target_role'            => self::ROLE,
            'target_department_id'   => null,
            'type'                   => $type,
            'severity'               => self::SEVERITY[$type] ?? 'normal',
            'title'                  => Str::limit($title, 147),
            'reference_number'       => $document ? self::reference($document) : null,
            'document_type'          => $document?->type?->type_name,
            'originating_department' => $document?->currentHolderDepartment?->department_name ?? $document?->department?->department_name,
            'action_url'             => $actionUrl ?? ($document ? "/cart/monitoring/{$document->document_id}" : '/cart/alerts'),
            // Informational alerts about CART's own action are recorded already read
            'is_read'                => $read,
        ]);
    }

    public static function reference(Document $document): string
    {
        $tracking = (string) $document->tracking_number;

        return $tracking !== '' && !str_starts_with($tracking, 'PENDING-') ? $tracking : (string) $document->reference_number;
    }

    /**
     * Notification bell payload for CART users: CART alerts instead of every document receipt in the system.
     */
    public static function bellPayload(): array
    {
        app(ArtaMonitor::class)->syncIfDue();

        $alerts = SystemNotification::where('target_role', self::ROLE)
            ->orderBy('is_read')
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

        $unread = SystemNotification::where('target_role', self::ROLE)
            ->where('is_read', false)
            ->selectRaw('severity, COUNT(*) as total')
            ->groupBy('severity')
            ->pluck('total', 'severity');

        $items = $alerts->map(fn (SystemNotification $alert) => [
            // "receipt-" ids are marked read by NotificationController::markAsRead
            'id'                     => 'receipt-' . $alert->id,
            'db_id'                  => $alert->id,
            'document_id'            => $alert->document_id,
            'type'                   => $alert->type,
            'severity'               => $alert->severity,
            'icon'                   => self::ICONS[$alert->type] ?? '🔔',
            'title'                  => $alert->title,
            'toast_message'          => $alert->title,
            'reference_number'       => $alert->reference_number,
            'document_type'          => $alert->document_type,
            'originating_department' => $alert->originating_department,
            'action_url'             => $alert->action_url ?: '/cart/alerts',
            'created_at'             => Carbon::parse($alert->created_at)->toISOString(),
            'is_read'                => (bool) $alert->is_read,
        ])->values()->all();

        return [
            'counts' => [
                'total'              => (int) $unread->sum(),
                'received'           => (int) ($unread['normal'] ?? 0),
                'warning'            => (int) ($unread['warning'] ?? 0),
                'overdue'            => (int) ($unread['overdue'] ?? 0),
                'escalated'          => (int) ($unread['escalated'] ?? 0),
                // Sidebar badge of "ARTA / Escalations": documents with an unresolved escalation
                'active_escalations' => ArtaEscalation::active()->distinct()->count('document_id'),
            ],
            'items' => $items,
        ];
    }

    public static function markAllRead(): void
    {
        SystemNotification::where('target_role', self::ROLE)->where('is_read', false)->update(['is_read' => true]);
    }
}

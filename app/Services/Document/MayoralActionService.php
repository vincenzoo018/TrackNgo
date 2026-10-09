<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\Document;
use App\Models\MayoralAction;
use App\Models\OicDesignation;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * LGC Sec. 54: an ordinance / resolution the Sanggunian passes goes to the City Mayor, who must sign or veto it
 * (stating the reasons) within 10 days of receipt; otherwise it is deemed approved as if signed. The 10 calendar
 * days start when the document reaches the Mayor, or the Acting Mayor while one is designated (LGC Sec. 46).
 */
class MayoralActionService
{
    public const PERIOD_DAYS = 10;

    public function __construct(
        protected WorkingDayCalendar $calendar,
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    /** Whether $official is the City Mayor (an Acting Mayor receives and acts in the Mayor's place) */
    public static function isMayor(?User $official): bool
    {
        return (bool) $official?->hasRole('Mayor');
    }

    /** The document reached the Mayor (or the Acting Mayor): the 10 calendar days start, once. */
    public function markReceived(Document $document, ?User $official, ?User $actor = null): void
    {
        $document->loadMissing('type');
        if (!self::isMayor($official) || !$document->requiresMayoralAction() || $document->mayor_received_at || $document->isClosed()) {
            return;
        }

        $receivedAt = now();
        $due = $this->calendar->addDays($receivedAt, self::PERIOD_DAYS, $document->type)->toDateString();
        // The Mayor's deadline is the document's deadline from now on (CART, lists and the public page read it);
        // saved quietly because it is the legal period starting, not someone changing a deadline
        $document->forceFill([
            'mayor_received_at'     => $receivedAt,
            'mayor_action_due_date' => $due,
            'arta_due_date'         => $due,
        ])->saveQuietly();

        $this->auditTrail->logDocumentAction(
            document: $document,
            action: 'Mayoral Period Started',
            description: 'Received by the Office of the Mayor. Under LGC Sec. 54 the Mayor must sign or veto it by '
                . Carbon::parse($due)->format('M d, Y') . ' (10 calendar days); otherwise it is deemed approved.',
            actor: $actor,
        );
    }

    /** The final mayoral action already recorded (signed, vetoed or deemed approved), if any */
    public function finalAction(Document $document): ?MayoralAction
    {
        return $document->mayoralActions()->latest('id')->first();
    }

    /** The Mayor (or Acting Mayor) approved the document on its route / at the Mayor's step: it is signed */
    public function recordSigned(Document $document, User $actor, ?User $official, ?OicDesignation $designation): void
    {
        $document->loadMissing('type');
        if (!$document->requiresMayoralAction() || !self::isMayor($official ?? $actor) || $this->finalAction($document)) {
            return;
        }

        MayoralAction::create([
            'document_id'        => $document->document_id,
            'action'             => MayoralAction::SIGNED,
            'action_date'        => now(),
            'remarks'            => $designation ? "Signed by {$actor->name}, {$designation->reference()}." : null,
            'acted_by'           => $actor->id,
            'oic_designation_id' => $designation?->id,
        ]);
    }

    public function recordVeto(Document $document, string $reasons, User $actor, ?OicDesignation $designation): MayoralAction
    {
        return MayoralAction::create([
            'document_id'        => $document->document_id,
            'action'             => MayoralAction::VETOED,
            'action_date'        => now(),
            'remarks'            => $reasons,
            'acted_by'           => $actor->id,
            'oic_designation_id' => $designation?->id,
        ]);
    }

    public function recordDeemedApproval(Document $document): MayoralAction
    {
        return MayoralAction::create([
            'document_id' => $document->document_id,
            'action'      => MayoralAction::DEEMED_APPROVED,
            'action_date' => now(),
            'remarks'     => 'No signature or veto within 10 days of receipt by the Office of the Mayor (LGC Sec. 54): deemed approved as if signed.',
        ]);
    }

    /**
     * What the document page shows for an ordinance / resolution: the countdown, or what the Mayor did.
     *
     * @return array{status: string, received_at: ?string, due_date: ?string, days_left: ?int, action: ?array}|null
     */
    public function present(Document $document): ?array
    {
        $document->loadMissing('type');
        if (!$document->requiresMayoralAction()) {
            return null;
        }

        $final = $this->finalAction($document);
        $final?->loadMissing(['actor', 'designation']);
        $daysLeft = $document->mayor_action_due_date
            ? (int) round($this->calendar->day(now())->diffInDays($this->calendar->day($document->mayor_action_due_date), false))
            : null;

        return [
            'status'      => $final?->action ?? ($document->mayor_received_at ? 'pending' : 'not_received'),
            'received_at' => $document->mayor_received_at?->toIso8601String(),
            'due_date'    => $document->mayor_action_due_date?->toDateString(),
            'days_left'   => $daysLeft,
            'action'      => $final ? [
                'action'      => $final->action,
                'date'        => $final->action_date?->toIso8601String(),
                'remarks'     => $final->remarks,
                'actor'       => $final->actor?->name,
                'designation' => $final->designation?->reference(),
            ] : null,
        ];
    }

    /** Ordinances / resolutions waiting for the Mayor's signature or veto (Mayor's dashboard), soonest first */
    public function pendingFor(User $viewer): Collection
    {
        return Document::with(['type', 'currentHolder', 'department'])
            ->whereNotNull('mayor_received_at')
            ->whereDoesntHave('mayoralActions')
            ->whereRaw('LOWER(status) NOT IN (' . implode(', ', array_fill(0, count(Document::CLOSED_STATUSES) + 1, '?')) . ')', [...Document::CLOSED_STATUSES, Document::STATUS_DEEMED_APPROVED])
            ->orderBy('mayor_action_due_date')
            ->get()
            ->filter(fn (Document $document) => $document->contentsVisibleTo($viewer) || $viewer->hasRole('Mayor'))
            ->map(fn (Document $document) => [
                'document_id'      => $document->document_id,
                'reference_number' => $document->reference_number,
                'tracking_number'  => $document->tracking_number,
                'title'            => $document->visibleTitle($viewer),
                'type'             => $document->type?->type_name,
                'received_at'      => $document->mayor_received_at?->toIso8601String(),
                'due_date'         => $document->mayor_action_due_date?->toDateString(),
                'days_left'        => (int) round($this->calendar->day(now())->diffInDays($this->calendar->day($document->mayor_action_due_date), false)),
                'holder'           => $document->currentHolder?->name,
            ])
            ->values();
    }
}

<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Cart\ArtaClock;
use App\Services\Oic\OicService;

/**
 * The deadline panel of a document page: the holiday-aware due date, the one extension (and whether this viewer may
 * grant it), a deemed approval, the Mayor's 10-day countdown for ordinances / resolutions, and the Officer-in-Charge
 * holding it for an absent official.
 */
class DocumentCompliancePresenter
{
    public function __construct(
        protected WorkingDayCalendar $calendar,
        protected ArtaClock $clock,
        protected ExtensionService $extensions,
        protected MayoralActionService $mayoral,
        protected OicService $oic
    ) {}

    public function present(Document $document, ?User $viewer): array
    {
        $document->loadMissing(['type', 'extension.extender', 'heldFor']);
        $timing = $this->clock->evaluate($document);
        $due = $this->calendar->deadlineFor($document);
        $extension = $document->extension;
        $acting = $document->held_for_user_id ? $this->oic->activeFor($document->held_for_user_id) : null;
        $viewerActingFor = $viewer ? $this->oic->actingFor($document, $viewer) : null;
        $mayoral = $this->mayoral->present($document);

        return [
            'deadline'   => [
                'due_date'      => $due->toDateString(),
                'working_days'  => $timing['working_days'],
                'allowed_days'  => $timing['allowed_days'],
                'remaining'     => $timing['remaining_days'],
                'overdue_days'  => $timing['overdue_days'],
                'status'        => $timing['status'],
                // Weekends and holidays between filing and the due date (why the date is later than it looks)
                'skipped'       => $timing['working_days'] ? collect($this->calendar->nonWorkingDaysBetween($timing['assigned_at'], $due))
                    ->where('kind', 'holiday')->values()->all() : [],
            ],
            'extension'  => $extension ? [
                'previous_due_date' => $extension->previous_due_date->toDateString(),
                'new_due_date'      => $extension->new_due_date->toDateString(),
                'extended_days'     => $extension->extended_days,
                'reason'            => $document->contentsVisibleTo($viewer) ? $extension->reason : null,
                'extended_by'       => $extension->extender?->name,
                'extended_at'       => $extension->extended_at->toIso8601String(),
                'notified_client'   => $extension->notified_client,
            ] : null,
            'can_extend' => $this->extensions->eligibility($document, $viewer),
            'deemed'     => $document->deemed_approved_at ? [
                'at'    => $document->deemed_approved_at->toIso8601String(),
                'basis' => $document->deemed_approval_basis,
            ] : null,
            'mayoral'    => $mayoral,
            'can_veto'   => $mayoral !== null && $mayoral['status'] === 'pending' && $viewer
                && $document->isHeldBy($viewer)
                && strtolower((string) $document->status) !== 'returned'
                && MayoralActionService::isMayor($viewerActingFor ?? $viewer),
            'acting'     => $acting ? [
                'officer'   => $document->currentHolder?->name,
                'official'  => $document->heldFor?->name,
                'title'     => $acting->title(),
                'order'     => $acting->designation_order_number,
                'reference' => $acting->reference(),
            ] : null,
            // The viewer holds it as Officer-in-Charge: their actions carry the designation
            'viewer_acting_for' => $viewerActingFor?->name,
        ];
    }
}

<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\Document;
use App\Models\DocumentExtension;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Sms\DocumentSmsNotifier;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * RA 11032 Sec. 9(b): the processing period of a client transaction may be extended ONCE, for the same number of
 * days, and only before it lapses, with a written notice to the client stating the reason and the new release date.
 */
class ExtensionService
{
    public function __construct(
        protected WorkingDayCalendar $calendar,
        protected AuditTrailServiceInterface $auditTrail,
        protected DocumentSmsNotifier $smsNotifier
    ) {}

    /**
     * Whether (and why not) $user may extend this document now.
     *
     * @return array{allowed: bool, reason: ?string, extension_days: int, new_due_date: ?string}
     */
    public function eligibility(Document $document, ?User $user): array
    {
        $document->loadMissing(['type', 'extension']);
        $days = $this->calendar->processingDays($document->type);
        $reason = match (true) {
            $document->extension !== null                 => 'The processing period was already extended once on ' . $document->extension->extended_at->setTimezone($this->calendar->timezone())->format('M d, Y')
                . '. RA 11032 allows only one extension.',
            (bool) $document->is_internal                 => 'Only client transactions (external documents) have an ARTA processing period to extend.',
            $document->requiresMayoralAction()            => 'The Mayor\'s 10-day period for ordinances and resolutions (LGC Sec. 54) cannot be extended.',
            $document->isDeemedApproved()                 => 'This document is already deemed approved.',
            $document->isClosed() || strtolower((string) $document->status) === 'approved'
                                                          => 'This document has already been acted on.',
            !$user || !$document->isHeldBy($user)         => 'Only the office currently processing the document can extend its period.',
            now()->gt($this->calendar->deadlineEndsAt($document)) => 'The processing period has already lapsed; an extension must be given before the deadline.',
            default                                       => null,
        };

        return [
            'allowed'        => $reason === null,
            'reason'         => $reason,
            'extension_days' => $days,
            'new_due_date'   => $reason === null ? $this->calendar->addDays($this->calendar->deadlineFor($document), $days, $document->type)->toDateString() : null,
        ];
    }

    public function grant(Document $document, string $reason, User $actor, ?string $ip = null): DocumentExtension
    {
        if (!$document->isHeldBy($actor)) {
            throw new AuthorizationException('Only the office currently processing the document can extend its period.');
        }
        $check = $this->eligibility($document, $actor);
        if (!$check['allowed']) {
            throw ValidationException::withMessages(['reason' => $check['reason']]);
        }

        $previous = $this->calendar->deadlineFor($document)->toDateString();

        try {
            $extension = DB::transaction(function () use ($document, $reason, $actor, $ip, $check, $previous) {
                $extension = DocumentExtension::create([
                    'document_id'       => $document->document_id,
                    'extended_by'       => $actor->id,
                    'reason'            => $reason,
                    'previous_due_date' => $previous,
                    'new_due_date'      => $check['new_due_date'],
                    'extended_days'     => $check['extension_days'],
                    'extended_at'       => now(),
                    'notified_client'   => false,
                ]);

                // CART is alerted of the new deadline (Document::updated → ArtaMonitor::deadlineChanged)
                $document->update(['arta_due_date' => $check['new_due_date']]);

                $this->auditTrail->logDocumentAction(
                    document: $document,
                    action: 'Processing Period Extended',
                    description: "Processing period extended once by {$actor->name} for {$check['extension_days']} "
                        . ($this->calendar->countsWorkingDays($document->type) ? 'working ' : '') . 'day(s) under RA 11032 Sec. 9(b): new release date '
                        . $extension->new_due_date->format('M d, Y') . ' (was ' . $extension->previous_due_date->format('M d, Y') . "). Reason: {$reason}",
                    actor: $actor,
                    ipAddress: $ip
                );

                return $extension;
            });
        } catch (UniqueConstraintViolationException) {
            // Two offices pressed "Extend" at the same moment: only the first counts
            throw ValidationException::withMessages(['reason' => 'The processing period was already extended once. RA 11032 allows only one extension.']);
        }

        $this->smsNotifier->extensionGranted($document, $extension);

        return $extension;
    }

    /** Everything the written notice needs (printable page / PDF) */
    public function notice(Document $document): ?array
    {
        $document->loadMissing(['extension.extender.role', 'extension.extender.department', 'client', 'type', 'department']);
        $extension = $document->extension;
        if (!$extension) {
            return null;
        }

        return [
            'notice_number'     => 'EXT-' . ($document->tracking_number ?: $document->reference_number),
            'issued_at'         => $extension->extended_at->toIso8601String(),
            'reason'            => $extension->reason,
            'previous_due_date' => $extension->previous_due_date->toDateString(),
            'new_due_date'      => $extension->new_due_date->toDateString(),
            'extended_days'     => $extension->extended_days,
            'working_days'      => $this->calendar->countsWorkingDays($document->type),
            'notified_client'   => $extension->notified_client,
            'extended_by'       => [
                'name'     => $extension->extender?->name,
                'position' => $extension->extender?->role?->role_name,
                'office'   => $extension->extender?->department?->department_name,
            ],
            'client'            => $document->client ? [
                'name'    => $document->client->full_name,
                'address' => $document->client->full_address,
                'contact' => $document->client->contact_number,
            ] : null,
            'document'          => [
                'reference_number' => $document->reference_number,
                'tracking_number'  => $document->tracking_number,
                'title'            => $document->title,
                'type'             => $document->type?->type_name,
                'office'           => $document->department?->department_name,
                'date_filed'       => $document->date_filed?->toIso8601String(),
            ],
        ];
    }
}

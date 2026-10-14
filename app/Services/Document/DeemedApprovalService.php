<?php

namespace App\Services\Document;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\RoutingSlip;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Cart\CartAlerts;
use App\Services\Email\DocumentEmailNotifier;
use App\Services\NotificationService;
use App\Services\Sms\DocumentSmsNotifier;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Automatic approval when the office runs out of time:
 *  - RA 11032 Sec. 10: a client's application not acted on within the processing period (extended once at most)
 *    is deemed approved;
 *  - LGC Sec. 54: an ordinance / resolution neither signed nor vetoed within 10 days of receipt by the Mayor is
 *    deemed approved as if signed.
 * The document skips the people still on its route and goes to the Receiving Clerk for release (internal documents
 * are completed and returned to their sender). Runs every five minutes (documents:deemed-approvals).
 */
class DeemedApprovalService
{
    public const BASIS_ARTA = 'RA 11032 Sec. 10';
    public const BASIS_LGC = 'LGC Sec. 54';

    /** user_role of the trail entries written by the check */
    public const ACTOR = 'System / Deemed Approval';

    public function __construct(
        protected WorkingDayCalendar $calendar,
        protected MayoralActionService $mayoral,
        protected DocumentRoute $route,
        protected DocumentSmsNotifier $smsNotifier,
        protected DocumentEmailNotifier $emailNotifier
    ) {}

    /** @return array{arta: int, lgc: int} */
    public function run(?CarbonInterface $now = null): array
    {
        $now ??= now();
        $stats = ['arta' => 0, 'lgc' => 0];
        // Already acted on (approved = waiting at the counter), finished, vetoed or deemed approved before
        $skip = [...Document::CLOSED_STATUSES, 'approved', Document::STATUS_DEEMED_APPROVED];

        Document::with(['type', 'client', 'currentHolder', 'submitter'])
            ->whereNull('deemed_approved_at')
            ->whereRaw('LOWER(status) NOT IN (' . implode(', ', array_fill(0, count($skip), '?')) . ')', $skip)
            ->get()
            ->each(function (Document $document) use ($now, &$stats) {
                if ($basis = $this->lapsedBasis($document, $now)) {
                    $this->deem($document, $basis);
                    $stats[$basis === self::BASIS_LGC ? 'lgc' : 'arta']++;
                }
            });

        return $stats;
    }

    /** The law under which the document is deemed approved now, or null */
    public function lapsedBasis(Document $document, CarbonInterface $now): ?string
    {
        if ($document->requiresMayoralAction()) {
            // Only once the Mayor has received it and has not signed or vetoed it
            return $document->mayor_action_due_date
                && !$document->mayoralActions()->exists()
                && $now->gt($this->calendar->day($document->mayor_action_due_date)->endOfDay())
                ? self::BASIS_LGC
                : null;
        }

        // ARTA covers client transactions only; a document returned to the counter waits on the client, not the office
        if ($document->is_internal || $this->waitingOnClient($document)) {
            return null;
        }

        return $now->gt($this->calendar->deadlineEndsAt($document)) ? self::BASIS_ARTA : null;
    }

    /** Returned to whoever filed it (the Receiving Clerk) for the client to complete or correct */
    private function waitingOnClient(Document $document): bool
    {
        return strtolower((string) $document->status) === 'returned'
            && (int) $document->current_holder_id === (int) $document->submitted_by;
    }

    public function deem(Document $document, string $basis): Document
    {
        $clerk = User::where('is_active', true)->whereHas('role', fn ($q) => $q->where('role_name', 'Receiving Clerk'))->first();
        $lapsedWith = $document->currentHolder?->name ?? 'the processing office';
        $law = $basis === self::BASIS_LGC
            ? 'LGC Sec. 54 — not signed or vetoed by the Mayor within 10 days of receipt'
            : 'RA 11032 Sec. 10 — no action within the prescribed processing period';
        $internal = (bool) $document->is_internal;

        DB::transaction(function () use ($document, $basis, $clerk, $lapsedWith, $law, $internal) {
            $recipient = $internal ? $document->submitter : $clerk;

            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => $document->tracking_number ?: ('PENDING-' . $document->reference_number),
                'from_user_id'         => $document->current_holder_id,
                'from_department_id'   => $document->current_holder_department_id,
                'to_user_id'           => $recipient?->id,
                'target_department_id' => $recipient?->department_id,
                'sender_name'          => 'TrackNGo (Deemed Approval)',
                'action'               => 'deemed_approved',
                'instruction'          => "Deemed approved under {$law}. " . ($internal ? 'Completed and returned to the sender.' : 'For release to the applicant.'),
                'status'               => $internal ? 'completed' : 'pending',
                'date_received'        => now(),
            ]);

            $document->forceFill($internal ? [
                'status'                       => 'completed',
                'completed_at'                 => now(),
                'current_holder_id'            => null,
                'current_holder_department_id' => null,
            ] : [
                'status'                       => Document::STATUS_DEEMED_APPROVED,
                'current_holder_id'            => $clerk?->id,
                'current_holder_department_id' => $clerk?->department_id,
            ])->forceFill([
                'deemed_approved_at'    => now(),
                'deemed_approval_basis' => $basis,
                'held_for_user_id'      => null,
            ])->save();

            if ($basis === self::BASIS_LGC) {
                $this->mayoral->recordDeemedApproval($document);
            }

            AuditTrail::create([
                'category'     => 'action',
                'document_id'  => $document->document_id,
                'document_ref' => $document->reference_number,
                'user_id'      => null,
                'user_role'    => self::ACTOR,
                'department'   => $recipient?->department?->department_name,
                'action'       => 'Deemed Approved',
                'description'  => "Deemed approved under {$law} (period lapsed while with {$lapsedWith}). "
                    . ($internal ? 'Completed and returned to ' . ($recipient?->name ?? 'the sender') . '.' : 'Sent to the Receiving Clerk for release; the remaining reviewers were skipped.'),
                'ip_address'   => request()?->ip(),
                'timestamp'    => now(),
            ]);
        });

        if ($document->route_based) {
            $this->route->sync($document);
        }

        $recipient = $internal ? $document->submitter : $clerk;
        if ($recipient) {
            NotificationService::triggerDocumentReceiptNotification(
                document: $document,
                targetUserId: $recipient->id,
                targetDeptId: $recipient->department_id,
                title: 'Document Deemed Approved — ' . ($internal ? 'completed' : 'for release')
            );
        }
        CartAlerts::raise($document, CartAlerts::DEEMED_APPROVED, 'Deemed approved (' . $basis . '): ' . CartAlerts::reference($document) . " — period lapsed with {$lapsedWith}");

        if (!$internal) {
            $this->smsNotifier->deemedApproved($document);
            $this->emailNotifier->deemedApproved($document, $clerk);
        }

        return $document;
    }
}

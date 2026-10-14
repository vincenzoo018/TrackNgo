<?php

namespace App\Services\Email;

use App\Concerns\NotifiesDocumentEvents;
use App\Models\ArtaEscalation;
use App\Models\Document;
use App\Models\DocumentExtension;
use App\Models\EmailNotification;
use App\Models\User;
use App\Services\Document\DocumentConfidentiality;
use App\Support\TrackingLink;
use Illuminate\Support\Str;

/**
 * The events that send an email, who receives it and what it says (the wording of every email lives here):
 * the SMS events (completed, ready for pickup, released, extension, deemed approved, ARTA escalation) plus a
 * document returned for correction. The Receiving Clerk is emailed only when a deemed-approved document waits for
 * release; the applicant once more when their document becomes overdue. Everything else stays in-app.
 *
 * Applicants get the tracking number, what happened and the public tracking link only: never the title, remarks,
 * reasons or files. Staff get the reference number, the title unless the document is confidential, and a link that
 * opens the document after they sign in (the usual access rules apply there). Each event has a fixed event key, so
 * a repeated action, a retried job or another scheduler run can never email the same person twice.
 */
class DocumentEmailNotifier
{
    use NotifiesDocumentEvents;

    public const COMPLETED = 'document_completed';
    public const READY_FOR_PICKUP = 'ready_for_pickup';
    public const RELEASED = 'document_released';
    public const RETURNED = 'document_returned';
    public const ESCALATED = 'arta_escalation';
    public const EXTENDED = 'processing_extended';
    public const DEEMED_APPROVED = 'deemed_approved';
    public const TEST = 'test';

    /** Automatic ARTA levels; a handler's own "Escalate to CART" (Manual) is not emailed back to them */
    private const ESCALATION_LEVELS = [ArtaEscalation::LEVEL_WARNING, ArtaEscalation::LEVEL_CRITICAL, ArtaEscalation::LEVEL_OVERDUE];

    private const CITY_HALL = 'the Receiving Section, City Hall of Mati';

    public function __construct(
        protected EmailService $email
    ) {}

    /** Internal document approved and completed: the staff member who sent it. */
    public function documentCompleted(Document $document, ?User $sender): void
    {
        $this->afterCommit(function () use ($document, $sender) {
            if ($sender) {
                $this->toStaff($sender, $document, self::COMPLETED, "document:{$document->document_id}:completed:user:{$sender->id}", 'Document Completed', [
                    "Your document {$this->staffLabel($document)} received its final approval and is now completed.",
                ]);
            }
        });
    }

    /** Returned for correction: the person who must correct it (whoever it went back to, or their Officer-in-Charge). */
    public function documentReturned(Document $document, ?User $holder, User $returnedBy, int $routingSlipId): void
    {
        $this->afterCommit(function () use ($document, $holder, $returnedBy, $routingSlipId) {
            if ($holder && (int) $holder->id !== (int) $returnedBy->id) {
                $this->toStaff($holder, $document, self::RETURNED, "return:{$routingSlipId}:user:{$holder->id}", 'Document Returned for Correction', [
                    "{$this->staffLabel($document)} was returned to you for correction by {$returnedBy->name}.",
                    'Open it in TrackNGo to see what needs to be corrected, then send it back.',
                ]);
            }
        });
    }

    /** External document approved by the Mayor and waiting at Receiving: the applicant. */
    public function readyForPickup(Document $document): void
    {
        $this->afterCommit(function () use ($document) {
            $this->toApplicant($document, self::READY_FOR_PICKUP, 'ready-for-pickup', 'Document Ready for Release', [
                "Your document {$this->applicantRef($document)} has been approved.",
                'It is ready for release at ' . self::CITY_HALL . '.',
            ]);
        });
    }

    /** External document released at the counter: the applicant. */
    public function documentReleased(Document $document): void
    {
        $this->afterCommit(function () use ($document) {
            $this->toApplicant($document, self::RELEASED, 'released', 'Document Released', [
                "Your document {$this->applicantRef($document)} has been released.",
                'Thank you for transacting with the City Government of Mati.',
            ]);
        });
    }

    /** The processing period was extended once (RA 11032 Sec. 9(b)): the applicant, with the new release date. */
    public function extensionGranted(Document $document, DocumentExtension $extension): void
    {
        $this->afterCommit(function () use ($document, $extension) {
            $this->toApplicant($document, self::EXTENDED, 'extended', 'Processing Period Extended', [
                "Processing of your document {$this->applicantRef($document)} was extended once under RA 11032 (Ease of Doing Business Act).",
                'New release date: ' . $extension->new_due_date->format('F j, Y') . '.',
                'You may get the written notice at ' . self::CITY_HALL . '.',
            ]);
        });
    }

    /** No action within the processing period (RA 11032 Sec. 10): the applicant, and the Receiving Clerk who releases it. */
    public function deemedApproved(Document $document, ?User $clerk): void
    {
        $this->afterCommit(function () use ($document, $clerk) {
            $this->toApplicant($document, self::DEEMED_APPROVED, 'deemed-approved', 'Document Deemed Approved', [
                "Your document {$this->applicantRef($document)} is deemed approved under RA 11032 because it was not acted on within its processing period.",
                'It is ready for release at ' . self::CITY_HALL . '.',
            ]);
            if ($clerk) {
                $this->toStaff($clerk, $document, self::DEEMED_APPROVED, "document:{$document->document_id}:deemed-approved:user:{$clerk->id}", 'Deemed Approved, Ready for Release', [
                    "{$this->staffLabel($document)} was deemed approved under RA 11032 and is waiting for you to release it to the applicant.",
                ]);
            }
        });
    }

    /** ARTA escalation level reached: the current handler (office head while an office holds it); the applicant once, at Overdue. */
    public function escalated(Document $document, ArtaEscalation $escalation): void
    {
        $this->afterCommit(function () use ($document, $escalation) {
            $level = $escalation->escalation_level;
            if (!in_array($level, self::ESCALATION_LEVELS, true)) {
                return;
            }

            if ($handler = $this->currentHandler($document)) {
                $this->toStaff($handler, $document, self::ESCALATED, "escalation:{$escalation->escalation_id}:user:{$handler->id}", "ARTA Escalation ({$level})", [
                    "{$this->staffLabel($document)} has passed its processing deadline and was escalated ({$level}).",
                    "It is {$escalation->overdue_days} day(s) past its {$escalation->arta_threshold}-day processing period. Please act on it in TrackNGo.",
                ]);
            }
            if ($level === ArtaEscalation::LEVEL_OVERDUE) {
                $this->toApplicant($document, self::ESCALATED, 'overdue', 'Update on Your Document', [
                    "Processing of your document {$this->applicantRef($document)} is taking longer than its set processing time.",
                    'The delay has been escalated, and the responsible office has been asked to act on it.',
                ]);
            }
        });
    }

    /** @param  string[]  $lines */
    private function toStaff(User $user, Document $document, string $type, string $eventKey, string $title, array $lines): void
    {
        if (!$user->is_active) {
            return;
        }

        $this->email->notify(
            $type,
            $eventKey,
            $user->email,
            $user->name,
            EmailNotification::RECIPIENT_STAFF,
            $this->subject($title, $this->staffRef($document)),
            $this->content($lines, TrackingLink::messageBaseUrl() . "/documents/{$document->document_id}", 'Open in TrackNGo'),
            $document,
            $user->id,
        );
    }

    /** @param  string[]  $lines */
    private function toApplicant(Document $document, string $type, string $event, string $title, array $lines): void
    {
        // Only external documents have an applicant (the client the Receiving Clerk registered); the email is optional
        $client = $document->client()->first();
        if (!$client || blank($client->email)) {
            return;
        }

        $this->email->notify(
            $type,
            "document:{$document->document_id}:{$event}:client",
            $client->email,
            $client->full_name,
            EmailNotification::RECIPIENT_APPLICANT,
            $this->subject($title, $this->applicantRef($document)),
            $this->content(
                $lines,
                $document->tracking_number ? TrackingLink::messageBaseUrl() . '/track?tn=' . rawurlencode($document->tracking_number) : null,
                'Track your document'
            ),
            $document,
        );
    }

    /** "CEO-2026-0012 (Budget realignment)"; the reference number alone for a confidential document */
    private function staffLabel(Document $document): string
    {
        $ref = $this->staffRef($document);

        return DocumentConfidentiality::isConfidential($document) || blank($document->title)
            ? $ref
            : $ref . ' (' . Str::limit((string) $document->title, 80) . ')';
    }

    private function subject(string $title, string $ref): string
    {
        return "TrackNGo: {$title} — {$ref}";
    }

    /**
     * @param  string[]  $lines
     * @return array{lines: string[], action_url: ?string, action_text: ?string}
     */
    private function content(array $lines, ?string $url, string $actionText): array
    {
        $lines[] = 'Date and time: ' . now()->setTimezone(config('arta.timezone', 'Asia/Manila'))->format('F j, Y, g:i A');

        return ['lines' => $lines, 'action_url' => $url, 'action_text' => $url ? $actionText : null];
    }
}

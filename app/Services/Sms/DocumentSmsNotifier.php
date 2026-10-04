<?php

namespace App\Services\Sms;

use App\Models\ArtaEscalation;
use App\Models\Document;
use App\Models\User;
use App\Services\Document\DocumentWorkflowService;
use App\Services\SmsService;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The only events that send an SMS, who receives it and what it says (every SMS template lives here).
 * Everything else stays in the in-app notifications. Messages carry the reference / tracking number
 * only, never titles or contents (confidential documents), and stay within one 160-character SMS.
 *
 * Each event has a fixed event key, so repeating an action, a page refresh or another scheduler run can
 * never text the same person twice. SMS is evaluated after the database transaction commits and never
 * throws, so the workflow and its in-app notification succeed even when SMS fails.
 */
class DocumentSmsNotifier
{
    public const COMPLETED = 'document_completed';
    public const READY_FOR_PICKUP = 'ready_for_pickup';
    public const RELEASED = 'document_released';
    public const ESCALATED = 'arta_escalation';
    public const TEST = 'test';

    /** Automatic ARTA levels; a handler's own "Escalate to CART" (Manual) is not texted back to them */
    private const SMS_LEVELS = [ArtaEscalation::LEVEL_WARNING, ArtaEscalation::LEVEL_CRITICAL, ArtaEscalation::LEVEL_OVERDUE];

    public function __construct(
        protected SmsService $sms
    ) {}

    /** Internal document approved and completed: the staff member who sent it. */
    public function documentCompleted(Document $document, ?User $sender): void
    {
        $this->afterCommit(function () use ($document, $sender) {
            if (!$sender) {
                return;
            }
            $this->sms->notify(
                self::COMPLETED,
                "document:{$document->document_id}:completed:user:{$sender->id}",
                $sender->mobile_number,
                $sender->name,
                "TrackNGo: Document {$this->staffRef($document)} has been approved and completed. Please check TrackNGo for details.",
                $document,
                $sender->id,
            );
        });
    }

    /** External document approved by the Mayor and waiting at Receiving: the applicant. */
    public function readyForPickup(Document $document): void
    {
        $this->afterCommit(function () use ($document) {
            $this->notifyApplicant($document, self::READY_FOR_PICKUP, 'ready-for-pickup',
                "TrackNGo: Your document {$this->applicantRef($document)} has been approved and is ready for release at the Receiving Section, City Hall of Mati.");
        });
    }

    /** External document released at the counter: the applicant. */
    public function documentReleased(Document $document): void
    {
        $this->afterCommit(function () use ($document) {
            $this->notifyApplicant($document, self::RELEASED, 'released',
                "TrackNGo: Your document {$this->applicantRef($document)} has been released. Thank you for transacting with the City Government of Mati.");
        });
    }

    /** ARTA escalation level reached: the current handler (or the office head when an office holds it). */
    public function escalated(Document $document, ArtaEscalation $escalation): void
    {
        $this->afterCommit(function () use ($document, $escalation) {
            if (!in_array($escalation->escalation_level, self::SMS_LEVELS, true)) {
                return;
            }
            $handler = $document->current_holder_id
                ? User::find($document->current_holder_id)
                : ($document->current_holder_department_id
                    ? app(DocumentWorkflowService::class)->resolveOfficeHead((int) $document->current_holder_department_id)
                    : null);
            if (!$handler) {
                return;
            }
            $this->sms->notify(
                self::ESCALATED,
                "escalation:{$escalation->escalation_id}:user:{$handler->id}",
                $handler->mobile_number,
                $handler->name,
                "TrackNGo: Document {$this->staffRef($document)} has passed its processing deadline and was escalated ({$escalation->escalation_level}). Please act on it in TrackNGo.",
                $document,
                $handler->id,
            );
        });
    }

    private function notifyApplicant(Document $document, string $type, string $event, string $message): void
    {
        // Only external documents have an applicant (the client the Receiving Clerk registered)
        $client = $document->client()->first();
        if (!$client) {
            return;
        }
        $this->sms->notify(
            $type,
            "document:{$document->document_id}:{$event}:client",
            $client->contact_number ?: $document->contact_number,
            $client->full_name,
            $message,
            $document,
        );
    }

    private function staffRef(Document $document): string
    {
        return $document->reference_number ?: ($document->tracking_number ?: "#{$document->document_id}");
    }

    /** Applicants follow their document by its tracking number on the public tracking page. */
    private function applicantRef(Document $document): string
    {
        return $document->tracking_number ?: ($document->reference_number ?: "#{$document->document_id}");
    }

    private function afterCommit(Closure $callback): void
    {
        DB::afterCommit(function () use ($callback) {
            try {
                $callback();
            } catch (Throwable $e) {
                Log::error('SMS event could not be evaluated', ['error' => $e->getMessage()]);
            }
        });
    }
}

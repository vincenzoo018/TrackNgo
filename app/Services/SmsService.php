<?php

namespace App\Services;

use App\Models\Document;
use App\Models\SmsNotification;
use App\Support\PhilippineMobile;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Throwable;

use function Illuminate\Support\defer;

/**
 * The only place TrackNGo talks to Semaphore. Every SMS goes through notify(), which enforces, in order:
 *   1. idempotency: one SMS per event_key, ever (a repeated event, page refresh or scheduler run is ignored)
 *   2. a valid Philippine mobile number
 *   3. safety limits: per day overall, per recipient per day, per document (config/services.php "sms")
 *   4. the switches: SMS_ENABLED=false or SMS_DRY_RUN=true only log a "simulated" SMS
 * and records the outcome in sms_notifications. Real sends happen after the response (or command) has
 * finished, retry with backoff up to SMS_MAX_ATTEMPTS on the same record, and never throw: an SMS
 * problem must not stop the document workflow that triggered it.
 */
class SmsService
{
    /** Our own ceiling, below Semaphore's 120 message calls per minute */
    private const API_CALLS_PER_MINUTE = 100;

    private const MAX_LENGTH = 160;

    private const BALANCE_CACHE_KEY = 'semaphore:credit-balance';

    /** Minutes to wait before retry n (after a timeout, network error, 429 or 5xx) */
    private const BACKOFF_MINUTES = [1 => 1, 2 => 5, 3 => 15];

    public function notify(
        string $type,
        string $eventKey,
        ?string $number,
        string $recipientName,
        string $message,
        ?Document $document = null,
        ?int $userId = null,
    ): ?SmsNotification {
        try {
            return $this->record($type, $eventKey, $number, $recipientName, $message, $document, $userId);
        } catch (Throwable $e) {
            Log::error('SMS could not be processed', ['event_key' => $eventKey, 'type' => $type, 'error' => $this->scrub($e->getMessage())]);

            return null;
        }
    }

    /** SMS_ENABLED=false or SMS_DRY_RUN=true: nothing is sent to Semaphore and no credits are used. */
    public function simulating(): bool
    {
        return !config('services.sms.enabled') || (bool) config('services.sms.dry_run');
    }

    /**
     * Try to deliver one queued SMS. Safe to call twice for the same record (only one call can claim it).
     */
    public function attempt(int $id): void
    {
        try {
            $claimed = SmsNotification::whereKey($id)
                ->where('status', SmsNotification::QUEUED)
                ->where('attempts', '<', $this->maxAttempts())
                ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
                ->update(['status' => SmsNotification::SENDING, 'attempts' => DB::raw('attempts + 1'), 'updated_at' => now()]);
            if ($claimed !== 1) {
                return;
            }
            $sms = SmsNotification::findOrFail($id);

            // The switches are checked again at send time, so turning SMS off also stops anything still waiting
            if ($this->simulating()) {
                $sms->update(['status' => SmsNotification::SIMULATED, 'simulation' => true, 'next_attempt_at' => null]);

                return;
            }
            if (!$this->apiKey()) {
                $this->fail($sms, 'SEMAPHORE_API_KEY is not set.');

                return;
            }
            if (!RateLimiter::attempt('semaphore:messages', self::API_CALLS_PER_MINUTE, fn () => true, 60)) {
                // Our own per-minute ceiling is reached: give the attempt back and try again in a minute
                $sms->update(['status' => SmsNotification::QUEUED, 'attempts' => $sms->attempts - 1, 'next_attempt_at' => now()->addMinute()]);

                return;
            }

            $this->deliver($sms);
        } catch (Throwable $e) {
            Log::error('SMS attempt crashed', ['sms_id' => $id, 'error' => $this->scrub($e->getMessage())]);
        }
    }

    /**
     * Send every queued SMS that is due (first attempts that were spaced out, and retries). Run by
     * `php artisan sms:send-pending` every minute from the scheduler.
     */
    public function sendDue(int $limit = 50): int
    {
        // A send that died half-way may already have reached Semaphore: never resend it (no duplicate SMS)
        SmsNotification::where('status', SmsNotification::SENDING)
            ->where('updated_at', '<', now()->subMinutes(10))
            ->update(['status' => SmsNotification::FAILED, 'error_message' => 'Interrupted while sending; not retried to avoid a duplicate SMS.']);

        $ids = SmsNotification::where('status', SmsNotification::QUEUED)
            ->where('attempts', '<', $this->maxAttempts())
            ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
            ->orderBy('next_attempt_at')
            ->limit($limit)
            ->pluck('id');

        foreach ($ids as $id) {
            $this->attempt($id);
        }

        return $ids->count();
    }

    /**
     * Credit balance from Semaphore's account endpoint, cached for 5 minutes. That endpoint allows only
     * 2 requests per minute, so a failed lookup is not retried for 30 seconds. Null when unavailable.
     */
    public function creditBalance(): ?float
    {
        if (!$this->apiKey()) {
            return null;
        }
        $cached = Cache::get(self::BALANCE_CACHE_KEY);
        if ($cached !== null) {
            return (float) $cached;
        }
        if (!Cache::add(self::BALANCE_CACHE_KEY . ':lock', true, 30)) {
            return null;
        }

        try {
            $response = $this->http()->get($this->baseUrl() . '/account', ['apikey' => $this->apiKey()]);
            $balance = $response->successful() ? $response->json('credit_balance') : null;
            if (is_numeric($balance)) {
                Cache::put(self::BALANCE_CACHE_KEY, (float) $balance, now()->addMinutes(5));

                return (float) $balance;
            }
            Log::warning('Semaphore credit balance unavailable', ['http_status' => $response->status()]);
        } catch (Throwable $e) {
            Log::warning('Semaphore credit balance unavailable', ['error' => $this->scrub($e->getMessage())]);
        }

        return null;
    }

    private function record(string $type, string $eventKey, ?string $number, string $recipientName, string $message, ?Document $document, ?int $userId): ?SmsNotification
    {
        if (SmsNotification::where('event_key', $eventKey)->exists()) {
            Log::info('SMS not repeated: event already handled', ['event_key' => $eventKey]);

            return null;
        }

        $local = PhilippineMobile::normalize($number);
        $limit = $local ? $this->limitReached($local, $document) : null;
        [$status, $error] = match (true) {
            $local === null    => [SmsNotification::INVALID_NUMBER, 'No valid Philippine mobile number on file.'],
            $limit !== null    => [SmsNotification::SKIPPED, $limit],
            $this->simulating() => [SmsNotification::SIMULATED, null],
            default            => [SmsNotification::QUEUED, null],
        };

        try {
            $sms = SmsNotification::create([
                'event_key'         => $eventKey,
                'notification_type' => $type,
                'document_id'       => $document?->document_id,
                'document_ref'      => $document ? ($document->reference_number ?: $document->tracking_number) : null,
                'user_id'           => $userId,
                'recipient_name'    => mb_substr($recipientName, 0, 255),
                'mobile_number'     => $local ?? mb_substr(trim((string) $number), 0, 50),
                'message'           => $this->safeMessage($message),
                'provider'          => 'semaphore',
                'status'            => $status,
                'simulation'        => $status === SmsNotification::SIMULATED,
                'next_attempt_at'   => $status === SmsNotification::QUEUED ? $this->nextSlotFor($local) : null,
                'error_message'     => $error,
            ]);
        } catch (UniqueConstraintViolationException) {
            // A concurrent request or run recorded the same event first
            return null;
        }

        Log::info('SMS notification recorded', [
            'sms_id' => $sms->id, 'type' => $type, 'document_id' => $sms->document_id, 'user_id' => $userId, 'status' => $status,
        ]);

        if ($status === SmsNotification::QUEUED && $sms->next_attempt_at->lte(now())) {
            // After the response / command has finished, so the user never waits on Semaphore
            defer(fn () => $this->attempt($sms->id), 'sms:' . $sms->id);
        }

        return $sms;
    }

    /** Reason the SMS must not be sent because a safety limit is reached, or null. */
    private function limitReached(string $local, ?Document $document): ?string
    {
        $counted = SmsNotification::whereIn('status', SmsNotification::COUNTED_STATUSES);
        $today = now()->startOfDay();

        $perDay = (int) config('services.sms.max_per_day');
        if ((clone $counted)->where('created_at', '>=', $today)->count() >= $perDay) {
            return "Daily SMS limit of {$perDay} reached (SMS_MAX_PER_DAY).";
        }
        $perRecipient = (int) config('services.sms.max_per_user_per_day');
        if ((clone $counted)->where('mobile_number', $local)->where('created_at', '>=', $today)->count() >= $perRecipient) {
            return "This number already reached {$perRecipient} SMS today (SMS_MAX_PER_USER_PER_DAY).";
        }
        $perDocument = (int) config('services.sms.max_per_document');
        if ($document && (clone $counted)->where('document_id', $document->document_id)->count() >= $perDocument) {
            return "This document already reached {$perDocument} SMS (SMS_MAX_PER_DOCUMENT).";
        }

        return null;
    }

    /** Messages to the same number are spaced at least SMS_MIN_INTERVAL_SECONDS apart. */
    private function nextSlotFor(string $local): CarbonInterface
    {
        $last = SmsNotification::where('mobile_number', $local)
            ->whereIn('status', [SmsNotification::QUEUED, SmsNotification::SENDING, SmsNotification::PENDING, SmsNotification::SENT])
            ->where('created_at', '>=', now()->subDay())
            ->get(['sent_at', 'next_attempt_at', 'updated_at'])
            ->map(fn (SmsNotification $s) => $s->sent_at ?? $s->next_attempt_at ?? $s->updated_at)
            ->filter()
            ->max();

        $earliest = $last ? Date::parse($last)->addSeconds((int) config('services.sms.min_interval_seconds')) : now();

        return $earliest->max(now());
    }

    private function deliver(SmsNotification $sms): void
    {
        try {
            $response = $this->http()->asForm()->post($this->baseUrl() . '/messages', array_filter([
                'apikey'     => $this->apiKey(),
                'number'     => PhilippineMobile::toInternational($sms->mobile_number),
                'message'    => $sms->message,
                'sendername' => config('services.semaphore.sender_name') ?: null,
            ]));
        } catch (ConnectionException $e) {
            $this->retryOrFail($sms, 'Could not reach Semaphore: ' . $e->getMessage());

            return;
        }

        if ($response->status() === 429 || $response->serverError()) {
            $this->retryOrFail($sms, "Semaphore HTTP {$response->status()}: " . $this->providerError($response));

            return;
        }

        $accepted = $response->successful() ? ($response->json()[0] ?? null) : null;
        if (!is_array($accepted) || empty($accepted['message_id'])) {
            // Invalid key, no credits, rejected number, ... retrying would not help
            $this->fail($sms, "Semaphore rejected the message (HTTP {$response->status()}): " . $this->providerError($response));

            return;
        }

        $status = match (strtolower((string) ($accepted['status'] ?? ''))) {
            'sent'     => SmsNotification::SENT,
            'failed'   => SmsNotification::FAILED,
            'refunded' => SmsNotification::REFUNDED,
            default    => SmsNotification::PENDING, // Queued / Pending at Semaphore
        };
        $sms->update([
            'status'              => $status,
            'provider_message_id' => (string) $accepted['message_id'],
            'sent_at'             => now(),
            'next_attempt_at'     => null,
            'error_message'       => $status === SmsNotification::FAILED ? 'Semaphore reported the message as failed.' : null,
        ]);
        Log::info('SMS accepted by Semaphore', [
            'sms_id' => $sms->id, 'document_id' => $sms->document_id, 'user_id' => $sms->user_id,
            'type' => $sms->notification_type, 'provider_message_id' => $sms->provider_message_id, 'status' => $status,
        ]);
    }

    private function retryOrFail(SmsNotification $sms, string $reason): void
    {
        if ($sms->attempts >= $this->maxAttempts()) {
            $this->fail($sms, $reason . " (gave up after {$sms->attempts} attempts)");

            return;
        }
        $sms->update([
            'status'          => SmsNotification::QUEUED,
            'next_attempt_at' => now()->addMinutes(self::BACKOFF_MINUTES[$sms->attempts] ?? 15),
            'error_message'   => mb_substr($this->scrub($reason), 0, 255),
        ]);
        Log::warning('SMS attempt failed, will retry', ['sms_id' => $sms->id, 'attempts' => $sms->attempts, 'error' => $this->scrub($reason)]);
    }

    private function fail(SmsNotification $sms, string $reason): void
    {
        $sms->update([
            'status'          => SmsNotification::FAILED,
            'next_attempt_at' => null,
            'error_message'   => mb_substr($this->scrub($reason), 0, 255),
        ]);
        Log::warning('SMS failed', [
            'sms_id' => $sms->id, 'document_id' => $sms->document_id, 'user_id' => $sms->user_id,
            'type' => $sms->notification_type, 'error' => $this->scrub($reason),
        ]);
    }

    /** Readable error text from a Semaphore response (JSON errors flattened), with the key removed. */
    private function providerError(Response $response): string
    {
        $json = $response->json();
        $text = is_array($json) ? implode(' ', array_map(fn ($v) => is_scalar($v) ? (string) $v : '', \Illuminate\Support\Arr::flatten($json))) : $response->body();

        return Str::limit($this->scrub(trim($text)) ?: 'no details', 180);
    }

    /**
     * Plain ASCII (GSM-7): accents are transliterated and emoji / Unicode dropped, because Unicode cuts an
     * SMS to 70 characters and costs more credits. Capped at 160 characters (one credit). Semaphore
     * silently ignores messages that start with "TEST", so such a message gets a "TrackNGo:" prefix.
     */
    private function safeMessage(string $message): string
    {
        $text = preg_replace('/[^\x20-\x7E]|[\[\]{}\\\\^~|]/', '', Str::ascii($message));
        $text = trim(preg_replace('/\s+/', ' ', $text));
        if (stripos($text, 'test') === 0) {
            $text = 'TrackNGo: ' . $text;
        }

        return mb_substr($text, 0, self::MAX_LENGTH);
    }

    /** Never let the API key reach a log line or the database. */
    private function scrub(string $text): string
    {
        $key = (string) $this->apiKey();

        return $key !== '' ? str_replace($key, '[redacted]', $text) : $text;
    }

    private function http()
    {
        return Http::acceptJson()
            ->connectTimeout((int) config('services.semaphore.connect_timeout', 5))
            ->timeout((int) config('services.semaphore.timeout', 10));
    }

    private function apiKey(): ?string
    {
        return config('services.semaphore.api_key') ?: null;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.semaphore.base_url'), '/');
    }

    private function maxAttempts(): int
    {
        return max(1, (int) config('services.sms.max_attempts'));
    }
}

<?php

namespace App\Services\Email;

use App\Jobs\SendEmailNotification;
use App\Mail\DocumentNotificationMail;
use App\Models\Document;
use App\Models\DocumentClient;
use App\Models\EmailNotification;
use App\Models\User;
use App\Support\EmailAddress;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

/**
 * The only place TrackNGo sends email. Every email goes through notify(), which enforces, in order:
 *   1. idempotency: one email per event_key, ever (a repeated action, a retried job or another scheduler run is ignored)
 *   2. the switch: TRACKNGO_EMAIL_ENABLED=false records the event as "disabled" and sends nothing
 *   3. a well-formed address that is not on a placeholder domain (TRACKNGO_EMAIL_BLOCKED_DOMAINS)
 *   4. limits: per recipient per day (skipped) and the daily cap (deferred until the cap allows, never dropped)
 * and records the outcome in email_notifications. Sending happens in a queued job (SendEmailNotification) after the
 * transaction commits, so the workflow never waits on the mail server. Temporary failures are retried with backoff
 * up to TRACKNGO_EMAIL_MAX_ATTEMPTS; permanent ones (refused recipient, wrong SMTP login) are not. Nothing here
 * throws into the workflow: an email problem must not stop the document action that triggered it.
 */
class EmailService
{
    /** Minutes to wait before retry n after a temporary failure (timeout, network error, 4xx reply) */
    private const BACKOFF_MINUTES = [1 => 1, 2 => 5, 3 => 15];

    /** A send still "sending" after this many minutes was interrupted (worker stopped half-way) */
    private const STUCK_AFTER_MINUTES = 10;

    /** Hours to hold mail back after the provider reports its own sending limit (Gmail counts a rolling day) */
    private const PROVIDER_LIMIT_HOURS = 24;

    /** Deferred emails released per run of email:send-pending */
    private const RELEASE_BATCH = 50;

    /**
     * @param  array{lines: string[], action_url?: ?string, action_text?: ?string}  $content
     */
    public function notify(
        string $type,
        string $eventKey,
        ?string $address,
        string $recipientName,
        string $recipientType,
        string $subject,
        array $content,
        ?Document $document = null,
        ?int $userId = null,
    ): ?EmailNotification {
        try {
            return $this->record($type, $eventKey, $address, $recipientName, $recipientType, $subject, $content, $document, $userId);
        } catch (Throwable $e) {
            Log::error('Email could not be processed', ['event_key' => $eventKey, 'type' => $type, 'error' => $this->scrub($e->getMessage())]);

            return null;
        }
    }

    public function enabled(): bool
    {
        return (bool) config('services.email.enabled');
    }

    /** An SMTP mailer needs its host, username and password; the log and array mailers need nothing. */
    public function mailerConfigured(): bool
    {
        $config = (array) config('mail.mailers.' . config('mail.default'), []);
        if (($config['transport'] ?? null) !== 'smtp' || filled($config['url'] ?? null)) {
            return true;
        }

        return filled($config['host'] ?? null) && filled($config['username'] ?? null) && filled($config['password'] ?? null);
    }

    /**
     * Send one queued email (called by the SendEmailNotification job). Returns the seconds to wait before the job
     * tries again after a temporary failure, otherwise null. Safe to run twice: only one run can claim the record.
     */
    public function attempt(int $id): ?int
    {
        try {
            $claimed = EmailNotification::whereKey($id)
                ->where('status', EmailNotification::QUEUED)
                ->update(['status' => EmailNotification::SENDING, 'attempts' => DB::raw('attempts + 1'), 'next_attempt_at' => null, 'updated_at' => now()]);
            if ($claimed !== 1) {
                return null;
            }
            $email = EmailNotification::findOrFail($id);

            // Checked again at send time, so turning email off also stops anything still waiting
            if (!$this->enabled()) {
                $email->update(['status' => EmailNotification::DISABLED, 'error_message' => 'Email notifications were turned off before this was sent.']);

                return null;
            }
            if (!$this->mailerConfigured()) {
                $this->fail($email, 'SMTP is not set up: MAIL_HOST, MAIL_USERNAME and MAIL_PASSWORD are required.');

                return null;
            }

            return $this->deliver($email);
        } catch (Throwable $e) {
            // The record stays "sending" and is marked failed by the next email:send-pending run
            Log::error('Email attempt crashed', ['email_id' => $id, 'error' => $this->scrub($e->getMessage())]);

            return null;
        }
    }

    /**
     * Run every minute by `email:send-pending`: deferred emails go out as the daily cap allows (oldest first), and a
     * send interrupted half-way is marked failed rather than resent, because it may already have been delivered.
     */
    public function sendDeferred(): int
    {
        EmailNotification::where('status', EmailNotification::SENDING)
            ->where('updated_at', '<', now()->subMinutes(self::STUCK_AFTER_MINUTES))
            ->update([
                'status'        => EmailNotification::FAILED,
                'error_message' => 'Interrupted while sending; not resent automatically in case it already arrived. Use Retry if it did not.',
                'updated_at'    => now(),
            ]);

        $room = $this->maxPerDay() - $this->usedToday();
        if (!$this->enabled() || $room <= 0) {
            return 0;
        }

        $ids = EmailNotification::where('status', EmailNotification::DEFERRED)
            ->where(fn ($q) => $q->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now()))
            ->orderBy('id')
            ->limit(min($room, self::RELEASE_BATCH))
            ->pluck('id');

        $released = 0;
        foreach ($ids as $id) {
            $claimed = EmailNotification::whereKey($id)->where('status', EmailNotification::DEFERRED)
                ->update(['status' => EmailNotification::QUEUED, 'next_attempt_at' => null, 'error_message' => null, 'updated_at' => now()]);
            if ($claimed === 1) {
                SendEmailNotification::dispatch($id);
                $released++;
            }
        }

        return $released;
    }

    /**
     * The administrator's Retry on a failed, skipped or invalid-address email. The address is read again from the
     * account or the client record, so an address corrected since is used, and the email is queued once more.
     */
    public function retry(EmailNotification $email): EmailNotification
    {
        if (!in_array($email->status, EmailNotification::RETRYABLE, true)) {
            throw ValidationException::withMessages(['email' => 'Only failed, skipped or invalid-address emails can be retried.']);
        }
        if (!$this->enabled()) {
            throw ValidationException::withMessages(['email' => 'Email notifications are turned off (TRACKNGO_EMAIL_ENABLED=false).']);
        }

        $onFile = $this->addressOnFile($email);
        $address = EmailAddress::normalize($onFile);
        [$status, $error] = match (true) {
            $address === null        => [EmailNotification::INVALID_EMAIL, 'Still no valid email address on file. Correct it first, then retry.'],
            $this->blocked($address) => [EmailNotification::SKIPPED, $this->blockedMessage()],
            $this->capReached()      => [EmailNotification::DEFERRED, $this->capMessage()],
            default                  => [EmailNotification::QUEUED, null],
        };

        $email->update([
            'recipient_email' => $address ?? $this->rawAddress($onFile),
            'status'          => $status,
            'attempts'        => 0,
            'next_attempt_at' => null,
            'error_message'   => $error,
        ]);
        Log::info('Email retried by an administrator', ['email_id' => $email->id, 'status' => $status]);

        if ($status === EmailNotification::QUEUED) {
            SendEmailNotification::dispatch($email->id)->afterCommit();
        }

        return $email;
    }

    /** The send job stopped for good (timed out / killed): the record says so instead of staying "sending". */
    public function abandon(int $id, string $reason): void
    {
        EmailNotification::whereKey($id)
            ->whereIn('status', [EmailNotification::QUEUED, EmailNotification::SENDING])
            ->update(['status' => EmailNotification::FAILED, 'error_message' => mb_substr($this->scrub($reason), 0, 255), 'updated_at' => now()]);
    }

    /** @return array{sent: int, queued: int, deferred: int, failed: int, used: int, cap: int} Today's numbers for the dashboard */
    public function todaySummary(): array
    {
        $today = now()->startOfDay();

        return [
            'sent'     => EmailNotification::where('status', EmailNotification::SENT)->where('sent_at', '>=', $today)->count(),
            'queued'   => EmailNotification::whereIn('status', [EmailNotification::QUEUED, EmailNotification::SENDING])->count(),
            'deferred' => EmailNotification::where('status', EmailNotification::DEFERRED)->count(),
            'failed'   => EmailNotification::whereIn('status', [EmailNotification::FAILED, EmailNotification::INVALID_EMAIL])
                ->where('updated_at', '>=', $today)->count(),
            'used'     => $this->usedToday(),
            'cap'      => $this->maxPerDay(),
        ];
    }

    /** @param  array{lines: string[], action_url?: ?string, action_text?: ?string}  $content */
    private function record(string $type, string $eventKey, ?string $address, string $recipientName, string $recipientType, string $subject, array $content, ?Document $document, ?int $userId): ?EmailNotification
    {
        if (EmailNotification::where('event_key', $eventKey)->exists()) {
            Log::info('Email not repeated: event already handled', ['event_key' => $eventKey]);

            return null;
        }

        $normalized = EmailAddress::normalize($address);
        [$status, $error] = $this->initialStatus($address, $normalized);

        try {
            $email = EmailNotification::create([
                'event_key'         => $eventKey,
                'notification_type' => $type,
                'document_id'       => $document?->document_id,
                'document_ref'      => $document ? ($document->reference_number ?: $document->tracking_number) : null,
                'user_id'           => $userId,
                'recipient_type'    => $recipientType,
                'recipient_name'    => mb_substr($recipientName, 0, 255),
                'recipient_email'   => $normalized ?? $this->rawAddress($address),
                'subject'           => mb_substr($subject, 0, 200),
                'content'           => $content,
                'status'            => $status,
                'error_message'     => $error,
            ]);
        } catch (UniqueConstraintViolationException) {
            // A concurrent request or run recorded the same event first
            return null;
        }

        Log::info('Email notification recorded', [
            'email_id' => $email->id, 'type' => $type, 'document_id' => $email->document_id, 'user_id' => $userId, 'status' => $status,
        ]);

        if ($status === EmailNotification::QUEUED) {
            SendEmailNotification::dispatch($email->id)->afterCommit();
        }

        return $email;
    }

    /** @return array{0: string, 1: ?string} status and reason for a new email */
    private function initialStatus(?string $address, ?string $normalized): array
    {
        if (!$this->enabled()) {
            return [EmailNotification::DISABLED, 'Email notifications are turned off (TRACKNGO_EMAIL_ENABLED=false).'];
        }
        if ($normalized === null) {
            return [EmailNotification::INVALID_EMAIL, blank($address) ? 'No email address on file.' : 'The email address on file is not valid.'];
        }
        if ($this->blocked($normalized)) {
            return [EmailNotification::SKIPPED, $this->blockedMessage()];
        }
        if ($limit = $this->recipientLimitReached($normalized)) {
            return [EmailNotification::SKIPPED, $limit];
        }
        if ($this->capReached()) {
            return [EmailNotification::DEFERRED, $this->capMessage()];
        }

        return [EmailNotification::QUEUED, null];
    }

    private function deliver(EmailNotification $email): ?int
    {
        try {
            Mail::to($email->recipient_email, $email->recipient_name)->send(new DocumentNotificationMail($email));
        } catch (TransportExceptionInterface $e) {
            return $this->transportFailed($email, $e);
        } catch (Throwable $e) {
            // The message could not be built or handed over (template / configuration error): retrying would not help
            $this->fail($email, 'The email could not be prepared: ' . $this->scrub($e->getMessage(), $email->recipient_email));

            return null;
        }

        $email->update(['status' => EmailNotification::SENT, 'sent_at' => now(), 'error_message' => null]);
        Log::info('Email accepted by the mail server', [
            'email_id' => $email->id, 'type' => $email->notification_type, 'document_id' => $email->document_id, 'user_id' => $email->user_id,
        ]);

        return null;
    }

    /** Permanent failures (5xx, wrong login) are not retried; timeouts, network errors and 4xx replies are. */
    private function transportFailed(EmailNotification $email, TransportExceptionInterface $e): ?int
    {
        $code = (int) $e->getCode();
        $detail = $this->scrub($e->getMessage(), $email->recipient_email);

        // Gmail: "550 5.4.5 Daily user sending limit exceeded". Hold it back instead of failing it
        if (preg_match('/\b5\.4\.5\b|sending (quota|limit)|limit exceeded/i', $detail)) {
            $email->update([
                'status'          => EmailNotification::DEFERRED,
                'attempts'        => max(0, $email->attempts - 1),
                'next_attempt_at' => now()->addHours(self::PROVIDER_LIMIT_HOURS),
                'error_message'   => "The mail provider's daily sending limit was reached; it will be sent later.",
            ]);
            Log::warning('Email deferred: provider sending limit reached', ['email_id' => $email->id]);

            return null;
        }
        if (in_array($code, [530, 534, 535], true)) {
            $this->fail($email, 'The mail server rejected the SMTP login. Check MAIL_USERNAME and the app password (MAIL_PASSWORD).');

            return null;
        }
        if ($code >= 500) {
            $this->fail($email, "The mail server refused the message (SMTP {$code}): {$detail}");

            return null;
        }

        return $this->retryOrFail($email, $code > 0 ? "Temporary mail server error (SMTP {$code}): {$detail}" : "Could not reach the mail server: {$detail}");
    }

    private function retryOrFail(EmailNotification $email, string $reason): ?int
    {
        if ($email->attempts >= $this->maxAttempts()) {
            $this->fail($email, Str::limit($reason, 200) . " (gave up after {$email->attempts} attempts)");

            return null;
        }

        $minutes = self::BACKOFF_MINUTES[$email->attempts] ?? 15;
        $email->update([
            'status'          => EmailNotification::QUEUED,
            'next_attempt_at' => now()->addMinutes($minutes),
            'error_message'   => mb_substr($reason, 0, 255),
        ]);
        Log::warning('Email attempt failed, will retry', ['email_id' => $email->id, 'attempts' => $email->attempts, 'error' => $reason]);

        return $minutes * 60;
    }

    private function fail(EmailNotification $email, string $reason): void
    {
        $email->update(['status' => EmailNotification::FAILED, 'next_attempt_at' => null, 'error_message' => mb_substr($reason, 0, 255)]);
        Log::warning('Email failed', [
            'email_id' => $email->id, 'document_id' => $email->document_id, 'user_id' => $email->user_id,
            'type' => $email->notification_type, 'error' => $reason,
        ]);
    }

    /** Emails that count toward today's cap: accepted or refused by the server today, and those waiting to go out */
    private function usedToday(): int
    {
        $today = now()->startOfDay();

        return EmailNotification::where(fn ($q) => $q
            ->where(fn ($q) => $q->where('status', EmailNotification::SENT)->where('sent_at', '>=', $today))
            ->orWhere(fn ($q) => $q->where('status', EmailNotification::FAILED)->where('attempts', '>', 0)->where('updated_at', '>=', $today))
            ->orWhereIn('status', [EmailNotification::QUEUED, EmailNotification::SENDING])
        )->count();
    }

    private function capReached(): bool
    {
        return $this->usedToday() >= $this->maxPerDay();
    }

    private function capMessage(): string
    {
        return "Daily email cap of {$this->maxPerDay()} reached (TRACKNGO_EMAIL_MAX_PER_DAY); it will be sent when the cap allows.";
    }

    /** Reason an address must not get another email today (loop / bulk-send protection), or null */
    private function recipientLimitReached(string $address): ?string
    {
        $limit = (int) config('services.email.max_per_recipient_per_day');
        $today = EmailNotification::where('recipient_email', $address)
            ->where('created_at', '>=', now()->startOfDay())
            ->whereIn('status', [EmailNotification::QUEUED, EmailNotification::SENDING, EmailNotification::SENT, EmailNotification::FAILED, EmailNotification::DEFERRED])
            ->count();

        return $today >= $limit ? "This address already reached {$limit} emails today (TRACKNGO_EMAIL_MAX_PER_RECIPIENT_PER_DAY)." : null;
    }

    /** Placeholder domains of demo accounts (and their subdomains) are never emailed */
    private function blocked(string $address): bool
    {
        $domain = EmailAddress::domain($address);

        foreach ((array) config('services.email.blocked_domains', []) as $blocked) {
            if ($domain === $blocked || str_ends_with($domain, '.' . $blocked)) {
                return true;
            }
        }

        return false;
    }

    private function blockedMessage(): string
    {
        return 'Placeholder address domain (TRACKNGO_EMAIL_BLOCKED_DOMAINS); not sent.';
    }

    /** The address on file now: the staff account's, the applicant's client record, or the one a test was sent to */
    private function addressOnFile(EmailNotification $email): ?string
    {
        return match ($email->recipient_type) {
            EmailNotification::RECIPIENT_STAFF     => $email->user_id ? User::whereKey($email->user_id)->value('email') : null,
            EmailNotification::RECIPIENT_APPLICANT => $email->document_id ? DocumentClient::where('document_id', $email->document_id)->value('email') : null,
            default                                => $email->recipient_email,
        };
    }

    /** A malformed address is kept (trimmed, cut to the column) so the administrator can see what was wrong */
    private function rawAddress(?string $address): ?string
    {
        return filled($address) ? mb_substr(trim((string) $address), 0, 100) : null;
    }

    /** SMTP errors can quote the login name or the recipient: neither, nor the password, reaches a log or the table */
    private function scrub(string $text, ?string $recipient = null): string
    {
        $secrets = array_filter(
            [(string) config('mail.mailers.smtp.password'), (string) config('mail.mailers.smtp.username'), (string) $recipient],
            fn (string $secret) => mb_strlen($secret) >= 4
        );

        return Str::limit(trim((string) preg_replace('/\s+/', ' ', str_ireplace($secrets, '[redacted]', $text))), 180);
    }

    private function maxAttempts(): int
    {
        return max(1, (int) config('services.email.max_attempts'));
    }

    private function maxPerDay(): int
    {
        return max(0, (int) config('services.email.max_per_day'));
    }
}

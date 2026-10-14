<?php

namespace App\Jobs;

use App\Services\Email\EmailService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Sends one recorded email (see EmailService) outside the web request. After a temporary failure the job goes back
 * on the queue with the backoff the record asks for; the record, not the queue, counts the attempts.
 */
class SendEmailNotification implements ShouldQueue
{
    use Queueable;

    /** Seconds one attempt may take (the SMTP connection itself times out after MAIL_TIMEOUT) */
    public int $timeout = 60;

    public function __construct(public int $emailId) {}

    /** One more than the record allows, so the queue never gives up before the record does */
    public function tries(): int
    {
        return max(1, (int) config('services.email.max_attempts')) + 1;
    }

    public function handle(EmailService $emails): void
    {
        $retryIn = $emails->attempt($this->emailId);

        if ($retryIn !== null) {
            $this->release($retryIn);
        }
    }

    public function failed(?Throwable $exception): void
    {
        app(EmailService::class)->abandon($this->emailId, 'The send job stopped: ' . ($exception?->getMessage() ?: 'unknown reason'));
    }
}

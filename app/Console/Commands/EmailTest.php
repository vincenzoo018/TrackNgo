<?php

namespace App\Console\Commands;

use App\Models\EmailNotification;
use App\Services\Email\DocumentEmailNotifier;
use App\Services\Email\EmailService;
use App\Support\EmailAddress;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Checks the SMTP setup by emailing one address. Command line only, so there is no web endpoint that could be
 * abused to send arbitrary email; it goes through the same switch, limits and log as every other email.
 */
class EmailTest extends Command
{
    /** Test emails allowed per day, on top of the normal limits */
    private const MAX_TESTS_PER_DAY = 5;

    protected $signature = 'email:test {address : Email address to send the test to}';

    protected $description = 'Send one test email through the configured mailer (logged in the email dashboard)';

    public function handle(EmailService $emails): int
    {
        $address = EmailAddress::normalize($this->argument('address'));
        if (!$address) {
            $this->error('Please enter a valid email address.');

            return self::FAILURE;
        }

        $testsToday = EmailNotification::where('notification_type', DocumentEmailNotifier::TEST)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();
        if ($testsToday >= self::MAX_TESTS_PER_DAY) {
            $this->error('The limit of ' . self::MAX_TESTS_PER_DAY . ' test emails per day has been reached.');

            return self::FAILURE;
        }

        $this->line('Mailer: ' . config('mail.default') . ($emails->enabled() ? '' : ' (TRACKNGO_EMAIL_ENABLED=false: nothing is sent)'));

        $record = $emails->notify(
            DocumentEmailNotifier::TEST,
            'test:' . Str::uuid(),
            $address,
            'TrackNGo administrator',
            EmailNotification::RECIPIENT_TEST,
            'TrackNGo: Email setup check',
            ['lines' => ['This is a test message from TrackNGo Mati. If you received it, email notifications are working.']],
        );
        if (!$record) {
            $this->error('The test email could not be recorded; see storage/logs/laravel.log.');

            return self::FAILURE;
        }

        // Send now instead of waiting for the queue worker, so the outcome can be shown
        $emails->attempt($record->id);
        $record->refresh();

        $this->line("Status: {$record->status}" . ($record->status === EmailNotification::SENT ? ' (accepted by the mail server; check the inbox and the spam folder)' : ''));
        if ($record->error_message) {
            $this->warn($record->error_message);
        }

        return $record->status === EmailNotification::SENT ? self::SUCCESS : self::FAILURE;
    }
}

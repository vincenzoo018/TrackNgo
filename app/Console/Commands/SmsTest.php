<?php

namespace App\Console\Commands;

use App\Models\SmsNotification;
use App\Services\Sms\DocumentSmsNotifier;
use App\Services\SmsService;
use App\Support\PhilippineMobile;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Checks the Semaphore setup by texting one number. Command line only, so there is no web endpoint that
 * could be abused to send arbitrary SMS; it goes through the same switches and limits as every other SMS.
 */
class SmsTest extends Command
{
    /** Test messages allowed per day, on top of the normal SMS limits */
    private const MAX_TESTS_PER_DAY = 5;

    protected $signature = 'sms:test {number : Philippine mobile number, e.g. 09171234567} {--force : Skip the confirmation before a real (paid) SMS}';

    protected $description = 'Send one test SMS through Semaphore (simulated while SMS_ENABLED=false or SMS_DRY_RUN=true)';

    public function handle(SmsService $sms): int
    {
        $number = PhilippineMobile::normalize($this->argument('number'));
        if (!$number) {
            $this->error('Please enter a valid Philippine mobile number.');

            return self::FAILURE;
        }

        $testsToday = SmsNotification::where('notification_type', DocumentSmsNotifier::TEST)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();
        if ($testsToday >= self::MAX_TESTS_PER_DAY) {
            $this->error('The limit of ' . self::MAX_TESTS_PER_DAY . ' test SMS per day has been reached.');

            return self::FAILURE;
        }

        $live = !$sms->simulating();
        $this->line('Mode: ' . ($live ? 'LIVE (Semaphore, uses 1 credit)' : 'SIMULATION (no request to Semaphore, no credits used)'));
        if ($live && !$this->option('force') && !$this->confirm("Send a real SMS to {$number}?")) {
            return self::FAILURE;
        }

        $record = $sms->notify(
            DocumentSmsNotifier::TEST,
            'test:' . Str::uuid(),
            $number,
            'SMS test (artisan)',
            'TrackNGo: SMS setup check. If you received this, TrackNGo text alerts are working.',
        );
        if (!$record) {
            $this->error('The test SMS could not be recorded; see storage/logs/laravel.log.');

            return self::FAILURE;
        }

        // Send now instead of after the command, so the outcome can be shown
        $sms->attempt($record->id);
        $record->refresh();

        $this->line("Status: {$record->status}" . ($record->provider_message_id ? " (Semaphore message id {$record->provider_message_id})" : ''));
        if ($record->error_message) {
            $this->warn($record->error_message);
        }

        return in_array($record->status, [SmsNotification::FAILED, SmsNotification::SKIPPED, SmsNotification::INVALID_NUMBER], true)
            ? self::FAILURE
            : self::SUCCESS;
    }
}

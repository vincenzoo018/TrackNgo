<?php

namespace App\Console\Commands;

use App\Services\SmsService;
use Illuminate\Console\Command;

class SendPendingSms extends Command
{
    protected $signature = 'sms:send-pending';

    protected $description = 'Send queued SMS that are due (spaced-out messages and retries after a failed attempt)';

    public function handle(SmsService $sms): int
    {
        $count = $sms->sendDue();

        $this->info("Queued SMS processed: {$count}.");

        return self::SUCCESS;
    }
}

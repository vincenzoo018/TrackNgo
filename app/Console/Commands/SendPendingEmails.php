<?php

namespace App\Console\Commands;

use App\Services\Email\EmailService;
use Illuminate\Console\Command;

class SendPendingEmails extends Command
{
    protected $signature = 'email:send-pending';

    protected $description = 'Queue deferred emails as the daily cap allows, and mark sends that were interrupted half-way';

    public function handle(EmailService $emails): int
    {
        $count = $emails->sendDeferred();

        $this->info("Deferred emails queued: {$count}.");

        return self::SUCCESS;
    }
}

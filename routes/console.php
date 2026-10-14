<?php

use App\Models\TeamInvitation;
use Illuminate\Support\Facades\Schedule;

Schedule::call(function () {
    TeamInvitation::query()
        ->whereNotNull('expires_at')
        ->where('expires_at', '<', now())
        ->delete();
})->daily()->description('Delete expired team invitations');

// ARTA monitoring for CART (CART pages also run it, throttled, when the scheduler is not running)
Schedule::command('arta:monitor')->everyFiveMinutes()->withoutOverlapping();

// Deemed approval when the processing period lapses (RA 11032 Sec. 10) or the Mayor neither signs nor vetoes an
// ordinance / resolution within 10 days (LGC Sec. 54); only here (or the Admin's "Check now"), never on page loads,
// because the applicant is texted
Schedule::command('documents:deemed-approvals')->everyFiveMinutes()->withoutOverlapping();

// Officer-in-Charge designations that started or ended today move the waiting documents (LGC Sec. 46)
Schedule::command('oic:sync')->everyFiveMinutes()->withoutOverlapping();

// SMS that were spaced out or failed once (timeout, Semaphore busy) are sent / retried here
Schedule::command('sms:send-pending')->everyMinute()->withoutOverlapping();

// Emails held back by the daily cap go out as it allows; sends interrupted half-way are marked failed
Schedule::command('email:send-pending')->everyMinute()->withoutOverlapping();

// Queued jobs (email sending and its retries), so the scheduler alone is enough; a separate `php artisan queue:work`
// (or `composer dev`) may run as well, the queue hands each job to one worker only
Schedule::command('queue:work --stop-when-empty --max-time=50')->everyMinute()->withoutOverlapping();

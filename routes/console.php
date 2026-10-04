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

// SMS that were spaced out or failed once (timeout, Semaphore busy) are sent / retried here
Schedule::command('sms:send-pending')->everyMinute()->withoutOverlapping();

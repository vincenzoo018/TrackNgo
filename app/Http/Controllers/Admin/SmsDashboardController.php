<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SmsNotification;
use App\Services\SmsService;
use Inertia\Inertia;
use Inertia\Response;

/** Admin SMS Dashboard: provider switches, credit balance and the SMS log. Never exposes the API key. */
class SmsDashboardController extends Controller
{
    public function index(SmsService $sms): Response
    {
        return Inertia::render('cart/notifications/SmsDashboard', [
            'smsLogs' => SmsNotification::orderByDesc('id')->limit(500)->get([
                'id', 'document_id', 'document_ref', 'notification_type', 'recipient_name', 'mobile_number',
                'message', 'status', 'simulation', 'attempts', 'provider_message_id', 'error_message', 'sent_at', 'created_at',
            ]),
            'smsStatus' => [
                'provider'         => 'Semaphore',
                'enabled'          => (bool) config('services.sms.enabled'),
                'dryRun'           => (bool) config('services.sms.dry_run'),
                'simulating'       => $sms->simulating(),
                'apiKeyConfigured' => filled(config('services.semaphore.api_key')),
                'senderName'       => config('services.semaphore.sender_name') ?: null,
                // Cached for 5 minutes (Semaphore allows 2 balance requests per minute)
                'creditBalance'    => $sms->creditBalance(),
            ],
        ]);
    }
}

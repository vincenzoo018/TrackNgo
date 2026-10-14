<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EmailNotification;
use App\Services\Email\EmailService;
use App\Support\EmailAddress;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin Email Dashboard: the switch, today's numbers and the email log, with Retry for failed / skipped /
 * invalid-address emails. Addresses are shown masked; SMTP credentials and full server errors never reach the page.
 */
class EmailDashboardController extends Controller
{
    public function index(EmailService $emails): Response
    {
        $smtp = config('mail.mailers.' . config('mail.default'), []);

        return Inertia::render('admin/notifications/EmailDashboard', [
            'emailLogs' => EmailNotification::orderByDesc('id')->limit(500)->get()->map(fn (EmailNotification $email) => [
                'id'                => $email->id,
                'document_ref'      => $email->document_ref,
                'notification_type' => $email->notification_type,
                'recipient_type'    => $email->recipient_type,
                'recipient_name'    => $email->recipient_name,
                'recipient_email'   => EmailAddress::mask($email->recipient_email),
                'subject'           => $email->subject,
                'status'            => $email->status,
                'attempts'          => $email->attempts,
                'error_message'     => $email->error_message,
                'sent_at'           => $email->sent_at?->toIso8601String(),
                'created_at'        => $email->created_at?->toIso8601String(),
                'retryable'         => in_array($email->status, EmailNotification::RETRYABLE, true),
            ]),
            'emailStatus' => [
                'enabled'    => $emails->enabled(),
                'mailer'     => (string) config('mail.default'),
                'host'       => ($smtp['transport'] ?? null) === 'smtp' ? ($smtp['host'] ?? null) : null,
                'configured' => $emails->mailerConfigured(),
                'from'       => EmailAddress::mask(config('mail.from.address')),
            ],
            'today' => $emails->todaySummary(),
        ]);
    }

    public function retry(int $id, EmailService $emails): RedirectResponse
    {
        try {
            $email = $emails->retry(EmailNotification::findOrFail($id));
        } catch (ValidationException $e) {
            return back()->with('error', collect($e->errors())->flatten()->first());
        }

        return match ($email->status) {
            EmailNotification::QUEUED   => back()->with('success', 'Email queued again for ' . EmailAddress::mask($email->recipient_email) . '.'),
            EmailNotification::DEFERRED => back()->with('success', 'Email deferred: the daily cap is reached. It will be sent when the cap allows.'),
            default                     => back()->with('error', (string) $email->error_message),
        };
    }
}

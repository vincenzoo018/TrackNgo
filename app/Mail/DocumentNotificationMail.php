<?php

namespace App\Mail;

use App\Models\EmailNotification;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Every TrackNGo notification email: the subject, a few lines and one link, as recorded when the event happened. */
class DocumentNotificationMail extends Mailable
{
    public function __construct(protected EmailNotification $notification) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notification->subject);
    }

    public function content(): Content
    {
        $content = (array) $this->notification->content;

        return new Content(
            view: 'mail.document-notification',
            text: 'mail.document-notification-text',
            with: [
                'recipientName' => $this->notification->recipient_name,
                'lines'         => array_values(array_filter((array) ($content['lines'] ?? []), 'is_string')),
                'actionUrl'     => $content['action_url'] ?? null,
                'actionText'    => $content['action_text'] ?? null,
            ],
        );
    }
}

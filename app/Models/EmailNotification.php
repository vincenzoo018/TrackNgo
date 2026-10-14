<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One email TrackNGo decided to send (or defer / skip) for one event; see App\Services\Email\EmailService. */
class EmailNotification extends Model
{
    protected $table = 'email_notifications';

    /** Waiting for the queue worker (first attempt, or a retry after a temporary failure) */
    public const QUEUED = 'queued';
    /** Claimed by a worker that is talking to the mail server right now */
    public const SENDING = 'sending';
    /** Accepted by the mail server. Not proof of inbox delivery: a bounce can still come later */
    public const SENT = 'sent';
    public const FAILED = 'failed';
    /** Held back by the daily cap (or the provider's sending limit); sent later, never dropped */
    public const DEFERRED = 'deferred';
    /** Not sent: a safety limit was reached or the address is a placeholder domain */
    public const SKIPPED = 'skipped';
    /** The recipient has no well-formed email address on file */
    public const INVALID_EMAIL = 'invalid_email';
    /** TRACKNGO_EMAIL_ENABLED=false when the event happened */
    public const DISABLED = 'disabled';

    /** Who the email is for: a staff account, the applicant of an external document, or an artisan test */
    public const RECIPIENT_STAFF = 'staff';
    public const RECIPIENT_APPLICANT = 'applicant';
    public const RECIPIENT_TEST = 'test';

    /** Statuses an administrator can send again (after correcting the address, raising a limit or fixing SMTP) */
    public const RETRYABLE = [self::FAILED, self::INVALID_EMAIL, self::SKIPPED];

    protected $fillable = [
        'event_key',
        'notification_type',
        'document_id',
        'document_ref',
        'user_id',
        'recipient_type',
        'recipient_name',
        'recipient_email',
        'subject',
        'content',
        'status',
        'attempts',
        'next_attempt_at',
        'error_message',
        'sent_at',
    ];

    protected $casts = [
        'content'         => 'array',
        'attempts'        => 'integer',
        'next_attempt_at' => 'datetime',
        'sent_at'         => 'datetime',
    ];

    /** @return BelongsTo<Document, $this> */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}

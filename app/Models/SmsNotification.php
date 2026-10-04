<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** One SMS TrackNGo decided to send (or simulate / skip) for one event; see App\Services\SmsService. */
class SmsNotification extends Model
{
    use HasFactory;

    protected $table = 'sms_notifications';

    /** Waiting for its first / next attempt at Semaphore */
    public const QUEUED = 'queued';
    /** Claimed by an attempt that is talking to Semaphore right now */
    public const SENDING = 'sending';
    /** Accepted by Semaphore (provider status Queued / Pending), not yet confirmed delivered */
    public const PENDING = 'pending';
    public const SENT = 'sent';
    public const FAILED = 'failed';
    public const REFUNDED = 'refunded';
    /** SMS_ENABLED=false or SMS_DRY_RUN=true: logged, never sent, no credits used */
    public const SIMULATED = 'simulated';
    /** Not sent because a safety limit was reached */
    public const SKIPPED = 'skipped';
    /** The recipient has no valid Philippine mobile number on file */
    public const INVALID_NUMBER = 'invalid_number';

    /** Statuses that represent a message that was (or would have been) sent; these count toward the limits */
    public const COUNTED_STATUSES = [self::QUEUED, self::SENDING, self::PENDING, self::SENT, self::FAILED, self::REFUNDED, self::SIMULATED];

    protected $fillable = [
        'document_id',
        'document_ref',
        'user_id',
        'notification_type',
        'event_key',
        'recipient_name',
        'mobile_number',
        'message',
        'provider',
        'provider_message_id',
        'status',
        'simulation',
        'attempts',
        'next_attempt_at',
        'error_message',
        'sent_at',
    ];

    protected $casts = [
        'sent_at'         => 'datetime',
        'next_attempt_at' => 'datetime',
        'simulation'      => 'boolean',
        'attempts'        => 'integer',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}

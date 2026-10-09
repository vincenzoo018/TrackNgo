<?php

namespace App\Models;

use App\Casts\DateOnly;
use Illuminate\Database\Eloquent\Model;

/** A leave of absence recorded by HR (Civil Service leave types). */
class LeaveRequest extends Model
{
    public const TYPES = [
        'Vacation Leave', 'Sick Leave', 'Special Privilege Leave', 'Forced / Mandatory Leave', 'Maternity Leave',
        'Paternity Leave', 'Solo Parent Leave', 'Study Leave', 'Rehabilitation Leave', 'Special Leave Benefits for Women',
        'Official Travel', 'Others',
    ];

    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';
    public const CANCELLED = 'cancelled';

    protected $fillable = [
        'user_id', 'leave_type', 'start_date', 'end_date', 'working_days', 'reason', 'status',
        'reviewed_by', 'reviewed_at', 'review_remarks', 'oic_designation_id', 'created_by',
    ];

    protected $casts = [
        'start_date'   => DateOnly::class,
        'end_date'     => DateOnly::class,
        'reviewed_at'  => 'datetime',
        'working_days' => 'integer',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    public function designation()
    {
        return $this->belongsTo(OicDesignation::class, 'oic_designation_id');
    }
}

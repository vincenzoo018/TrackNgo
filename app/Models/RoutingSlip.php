<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoutingSlip extends Model
{
    use HasFactory;

    protected $table = 'routing_slips';

    protected $primaryKey = 'slip_id';

    protected $fillable = [
        'document_id',
        'tracking_number',
        'from_user_id',
        'from_department_id',
        'to_user_id',
        'action',
        'received_by',
        'date_received',
        'sender_name',
        'instruction',
        'target_department_id',
        'noted_by',
        'status',
        // The absent official an Officer-in-Charge sent this slip for (LGC Sec. 46)
        'acting_for_user_id',
    ];

    protected $casts = [
        'date_received' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function fromUser()
    {
        return $this->belongsTo(User::class, 'from_user_id', 'id');
    }

    public function fromDepartment()
    {
        return $this->belongsTo(Department::class, 'from_department_id', 'department_id');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user_id', 'id');
    }

    public function receiver()
    {
        return $this->belongsTo(User::class, 'received_by', 'id');
    }

    public function targetDepartment()
    {
        return $this->belongsTo(Department::class, 'target_department_id', 'department_id');
    }

    public function noter()
    {
        return $this->belongsTo(User::class, 'noted_by', 'id');
    }

    /** The absent official an Officer-in-Charge sent this slip for */
    public function actingFor()
    {
        return $this->belongsTo(User::class, 'acting_for_user_id', 'id');
    }
}

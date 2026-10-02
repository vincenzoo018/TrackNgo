<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArtaEscalation extends Model
{
    use HasFactory;

    /** Severity levels from overdue days (see config/arta.php); Manual = escalated to CART by a handler */
    public const LEVEL_WARNING = 'Warning';
    public const LEVEL_CRITICAL = 'Critical';
    public const LEVEL_OVERDUE = 'Overdue';
    public const LEVEL_MANUAL = 'Manual';

    protected $table = 'arta_escalations';

    protected $primaryKey = 'escalation_id';
    protected $fillable = [
        'document_id', 'arta_threshold', 'days_elapsed', 'overdue_days', 'escalation_level', 'reason',
        'notified_user_id', 'holder_department_id', 'notification_sent', 'resolved', 'escalated_at',
        'resolved_at', 'resolved_by', 'resolution_notes',
    ];
    protected $casts = ['escalated_at' => 'datetime', 'resolved_at' => 'datetime', 'notification_sent' => 'boolean', 'resolved' => 'boolean'];

    public function document() { return $this->belongsTo(Document::class, 'document_id', 'document_id'); }
    public function notifiedUser() { return $this->belongsTo(User::class, 'notified_user_id', 'id'); }
    public function holderDepartment() { return $this->belongsTo(Department::class, 'holder_department_id', 'department_id'); }
    public function resolver() { return $this->belongsTo(User::class, 'resolved_by', 'id'); }

    public function scopeActive($query)
    {
        return $query->where('resolved', false);
    }
}

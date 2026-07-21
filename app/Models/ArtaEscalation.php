<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArtaEscalation extends Model
{
    use HasFactory;

    protected $table = 'arta_escalations';

    protected $primaryKey = 'escalation_id';
    protected $fillable = ['document_id', 'arta_threshold', 'days_elapsed', 'escalation_level', 'notified_user_id', 'notification_sent', 'resolved', 'escalated_at', 'resolved_at'];
    protected $casts = ['escalated_at' => 'datetime', 'resolved_at' => 'datetime', 'notification_sent' => 'boolean', 'resolved' => 'boolean'];
    
    public function document() { return $this->belongsTo(Document::class, 'document_id', 'document_id'); }
    public function notifiedUser() { return $this->belongsTo(User::class, 'notified_user_id', 'id'); }
        
}

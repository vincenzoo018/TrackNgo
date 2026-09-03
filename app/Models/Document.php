<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    protected $table = 'documents';

    protected $primaryKey = 'document_id';

    protected $fillable = [
        'reference_number',
        'tracking_number',
        'title',
        'submitted_by',
        'department_id',
        'type_id',
        'attachment_path',
        'classification',
        'urgency_justification',
        'status',
        'contact_number',
        'qr_code_path',
        'ocr_text',
        'current_step_index',
        'total_steps',
        'is_escalated',
        'arta_due_date',
        'date_filed',
        'submitted_at',
        'completed_at',
        'linked_document_id',
        'version',
        'sender',
        'current_holder_id',
        'current_holder_department_id',
        'is_internal',
        'destination_department_id',
    ];

    protected $casts = [
        'date_filed' => 'datetime',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'arta_due_date' => 'date',
        'is_escalated' => 'boolean',
        'is_internal' => 'boolean',
    ];

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by', 'id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    public function type()
    {
        return $this->belongsTo(DocumentType::class, 'type_id', 'type_id');
    }

    public function currentHolder()
    {
        return $this->belongsTo(User::class, 'current_holder_id', 'id');
    }

    public function currentHolderDepartment()
    {
        return $this->belongsTo(Department::class, 'current_holder_department_id', 'department_id');
    }

    public function linkedDocument()
    {
        return $this->belongsTo(Document::class, 'linked_document_id', 'document_id');
    }

    public function routingSlips()
    {
        return $this->hasMany(RoutingSlip::class, 'document_id', 'document_id');
    }

    public function auditTrails()
    {
        return $this->hasMany(AuditTrail::class, 'document_id', 'document_id');
    }

    public function escalations()
    {
        return $this->hasMany(ArtaEscalation::class, 'document_id', 'document_id');
    }

    public function signatures()
    {
        return $this->hasMany(DigitalSignature::class, 'document_id', 'document_id');
    }

    public function smsNotifications()
    {
        return $this->hasMany(SmsNotification::class, 'document_id', 'document_id');
    }

    public function comments()
    {
        return $this->hasMany(DocumentComment::class, 'document_id', 'document_id');
    }
}

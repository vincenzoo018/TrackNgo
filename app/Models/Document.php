<?php

namespace App\Models;

use App\Services\Document\DocumentConfidentiality;
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
        'destination_user_id',
        'return_reason',
        'requires_signature',
        'signed_file_path',
    ];

    protected $casts = [
        'date_filed' => 'datetime',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'arta_due_date' => 'date',
        'is_escalated' => 'boolean',
        'is_internal' => 'boolean',
        'requires_signature' => 'boolean',
    ];

    /**
     * Confidential contents are stripped for anyone outside the sender / route / signatories wherever the
     * document is serialized (Inertia props, JSON), so no page can leak them to the Receiving Clerk.
     */
    public function toArray()
    {
        $data = parent::toArray();
        $guard = app(DocumentConfidentiality::class);
        $hidden = !$guard->canViewContents($this, auth()->user());
        $data['is_confidential_hidden'] = $hidden;

        return $hidden ? $guard->redact($data) : $data;
    }

    public function contentsVisibleTo(?User $user = null): bool
    {
        return app(DocumentConfidentiality::class)->canViewContents($this, $user ?? auth()->user());
    }

    /** Title as the viewer may see it (hidden for confidential documents they cannot open). */
    public function visibleTitle(?User $user = null): string
    {
        return $this->contentsVisibleTo($user) ? (string) $this->title : DocumentConfidentiality::HIDDEN_TITLE;
    }

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

    public function destinationDepartment()
    {
        return $this->belongsTo(Department::class, 'destination_department_id', 'department_id');
    }

    /** Internal documents: the person the sender chose; the clerk's registration routes the document to them. */
    public function destinationUser()
    {
        return $this->belongsTo(User::class, 'destination_user_id', 'id');
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

    /** Required signatories chosen by the sender, in signing order. */
    public function signatories()
    {
        return $this->hasMany(DocumentSignatory::class, 'document_id', 'document_id')->orderBy('sign_order');
    }

    public function smsNotifications()
    {
        return $this->hasMany(SmsNotification::class, 'document_id', 'document_id');
    }

    public function comments()
    {
        return $this->hasMany(DocumentComment::class, 'document_id', 'document_id');
    }

    public function attachments()
    {
        return $this->hasMany(DocumentAttachment::class, 'document_id', 'document_id');
    }

    /** External client registered by the Receiving Clerk (null for internal / staff-filed documents). */
    public function client()
    {
        return $this->hasOne(DocumentClient::class, 'document_id', 'document_id');
    }
}

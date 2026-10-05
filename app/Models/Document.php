<?php

namespace App\Models;

use App\Services\Document\DocumentConfidentiality;
use Illuminate\Database\Eloquent\Builder;
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
        'route_based',
        'signed_file_path',
        'signed_copy_signatures',
    ];

    protected $casts = [
        'date_filed' => 'datetime',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'arta_due_date' => 'date',
        'is_escalated' => 'boolean',
        'is_internal' => 'boolean',
        'requires_signature' => 'boolean',
        'route_based' => 'boolean',
        'signed_copy_signatures' => 'integer',
    ];

    /** The stored signed copy carries every required signature (release / completion may rely on it). */
    public function hasFinalSignedCopy(): bool
    {
        return $this->signed_file_path
            && $this->signed_copy_signatures >= $this->signatories()->count();
    }

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

    /**
     * Documents the user filed or holds, plus (when they belong to a department) those owned by, held by
     * or routed through their department. Used for the role-scoped dashboards, reports and escalations.
     */
    public function scopeInvolving(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $q) use ($user) {
            $q->where('submitted_by', $user->id)
              ->orWhere('current_holder_id', $user->id);

            if ($user->department_id) {
                $q->orWhere('department_id', $user->department_id)
                  ->orWhere('current_holder_department_id', $user->department_id)
                  ->orWhereHas('routingSlips', function (Builder $rq) use ($user) {
                      $rq->where('from_department_id', $user->department_id)
                         ->orWhere('target_department_id', $user->department_id)
                         ->orWhere('from_user_id', $user->id)
                         ->orWhere('to_user_id', $user->id);
                  });
            }
        });
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

    /** People the document goes through, in order (route_based documents); see App\Services\Document\DocumentRoute. */
    public function routeStops()
    {
        return $this->hasMany(DocumentRouteStop::class, 'document_id', 'document_id')->orderBy('position');
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

    /** Versions of the main file, Version 1 (the original) first; the newest is the current file. */
    public function revisions()
    {
        return $this->hasMany(DocumentRevision::class, 'document_id', 'document_id')->orderBy('version_number');
    }

    public function currentRevision()
    {
        return $this->hasOne(DocumentRevision::class, 'document_id', 'document_id')->ofMany('version_number', 'max');
    }

    /** 1 until a corrected file has been uploaded */
    public function currentVersionNumber(): int
    {
        return (int) ($this->revisions()->max('version_number') ?: 1);
    }

    /**
     * The document is with this user: the assigned holder, or anyone in the holding office while it is
     * unassigned. Mirrors resources/js/lib/document-holder.ts.
     */
    public function isHeldBy(User $user): bool
    {
        return $this->current_holder_id
            ? (int) $this->current_holder_id === (int) $user->id
            : (!$this->current_holder_department_id || (int) $this->current_holder_department_id === (int) $user->department_id);
    }

    public function isClosed(): bool
    {
        return in_array(strtolower((string) $this->status), ['completed', 'released', 'archived'], true);
    }

    /** Filed, but nobody has received or registered it yet (its filer may still fix what they entered). */
    public function awaitingFirstReceipt(): bool
    {
        return strtolower((string) $this->status) !== 'returned'
            && $this->routingSlips()->count() <= 1
            && !$this->auditTrails()->where('action', 'Accepted')->exists();
    }

    /** Someone has signed the current version of the file */
    public function hasSignaturesOnCurrentVersion(): bool
    {
        return $this->signatories()->whereNotNull('signed_at')->exists();
    }
}

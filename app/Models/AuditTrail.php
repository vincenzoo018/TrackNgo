<?php

namespace App\Models;

use App\Services\Document\DocumentConfidentiality;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditTrail extends Model
{
    use HasFactory;

    protected $table = 'audit_trail';

    protected $primaryKey = 'audit_id';

    protected $fillable = [
        'document_id',
        'category',
        'user_id',
        'user_role',
        'department',
        'document_ref',
        'action',
        'description',
        'ip_address',
        'timestamp',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
    ];

    public function toArray()
    {
        $data = parent::toArray();
        $data['description'] = $this->visibleDescription();

        return $data;
    }

    /** The trail stays visible for monitoring; descriptions quoting a confidential document do not. */
    public function visibleDescription(?User $viewer = null): ?string
    {
        if ($this->description === null || !$this->document_id) {
            return $this->description;
        }

        $guard = app(DocumentConfidentiality::class);

        return $guard->canViewContentsById((int) $this->document_id, $viewer ?? auth()->user())
            ? $this->description
            : $guard->redactAuditDescription((string) $this->action, (string) $this->description);
    }

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function scopeSystemTrail($query)
    {
        return $query->where('category', 'system');
    }

    public function scopeActionTrail($query)
    {
        return $query->where('category', 'action');
    }
}

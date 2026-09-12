<?php

namespace App\Models;

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

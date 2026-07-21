<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DigitalSignature extends Model
{
    use HasFactory;

    protected $table = 'digital_signatures';

    protected $primaryKey = 'signature_id';

    protected $fillable = [
        'document_id',
        'signed_by_user_id',
        'signature_image',
        'signature_hash',
        'action_type',
        'ip_address',
        'signed_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function signer()
    {
        return $this->belongsTo(User::class, 'signed_by_user_id', 'id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** A person the sender named to sign the document; signed once signature_id / signed_at are set. */
class DocumentSignatory extends Model
{
    use HasFactory;

    protected $primaryKey = 'signatory_id';

    protected $fillable = [
        'document_id',
        'user_id',
        'sign_order',
        'signature_id',
        'signed_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function signature()
    {
        return $this->belongsTo(DigitalSignature::class, 'signature_id', 'signature_id');
    }
}

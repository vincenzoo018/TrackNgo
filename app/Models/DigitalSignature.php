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
        // The version of the file that was signed (see DocumentRevision)
        'revision_id',
        'signed_by_user_id',
        'signature_image',
        'signature_hash',
        'action_type',
        // "Acting Mayor per Designation Order No. 12, s. 2026" when an Officer-in-Charge signed for the official
        'capacity',
        'page',
        'pos_x',
        'pos_y',
        'width',
        'height',
        'ip_address',
        'signed_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
        'page'      => 'integer',
        'pos_x'     => 'float',
        'pos_y'     => 'float',
        'width'     => 'float',
        'height'    => 'float',
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

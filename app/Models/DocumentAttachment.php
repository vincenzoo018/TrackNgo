<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentAttachment extends Model
{
    use HasFactory;

    protected $primaryKey = 'attachment_id';

    protected $fillable = [
        'document_id',
        'user_id',
        'file_name',
        'file_path',
        'file_size',
        'file_type',
        'reason',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}

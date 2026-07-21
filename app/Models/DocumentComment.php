<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentComment extends Model
{
    use HasFactory;

    protected $table = 'document_comments';

    protected $fillable = [
        'document_id',
        'user_id',
        'comment',
        'is_anchored',
    ];

    protected $casts = [
        'is_anchored' => 'boolean',
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

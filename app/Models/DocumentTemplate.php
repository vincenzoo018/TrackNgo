<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A blank form / letter template (private file) offered when filing a document of its type. */
class DocumentTemplate extends Model
{
    protected $fillable = [
        'name', 'description', 'type_id', 'file_path', 'file_name', 'file_size', 'mime_type', 'is_active', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'file_size' => 'integer',
    ];

    protected $hidden = ['file_path'];

    public function type()
    {
        return $this->belongsTo(DocumentType::class, 'type_id', 'type_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'id');
    }
}

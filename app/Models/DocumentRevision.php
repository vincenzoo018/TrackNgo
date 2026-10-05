<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One version of a document's main file. Version 1 is the file submitted at filing; every correction is a new
 * version, so no file is ever overwritten. The newest version is the document's current file (attachment_path).
 */
class DocumentRevision extends Model
{
    protected $primaryKey = 'revision_id';

    protected $fillable = [
        'document_id',
        'version_number',
        'file_path',
        'file_name',
        'file_size',
        'mime_type',
        'file_hash',
        'revision_reason',
        'created_by',
        'created_by_name',
        'signed_file_path',
        'signed_copy_signatures',
    ];

    protected $casts = [
        'version_number'         => 'integer',
        'file_size'              => 'integer',
        'signed_copy_signatures' => 'integer',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    /** Signatures made while this was the current version */
    public function signatures()
    {
        return $this->hasMany(DigitalSignature::class, 'revision_id', 'revision_id');
    }
}

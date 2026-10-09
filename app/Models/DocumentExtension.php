<?php

namespace App\Models;

use App\Casts\DateOnly;
use Illuminate\Database\Eloquent\Model;

/** The one extension of a document's processing period allowed by RA 11032 (written notice to the client). */
class DocumentExtension extends Model
{
    protected $table = 'extensions';

    protected $fillable = [
        'document_id', 'extended_by', 'reason', 'previous_due_date', 'new_due_date', 'extended_days', 'extended_at', 'notified_client',
    ];

    protected $casts = [
        'previous_due_date' => DateOnly::class,
        'new_due_date'      => DateOnly::class,
        'extended_at'       => 'datetime',
        'notified_client'   => 'boolean',
        'extended_days'     => 'integer',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function extender()
    {
        return $this->belongsTo(User::class, 'extended_by', 'id');
    }
}

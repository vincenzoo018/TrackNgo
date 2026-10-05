<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One person on a document's route, in order; approved once approved_at is set (see App\Services\Document\DocumentRoute). */
class DocumentRouteStop extends Model
{
    protected $primaryKey = 'route_stop_id';

    protected $fillable = [
        'document_id',
        'user_id',
        'position',
        'signs',
        'approved_at',
    ];

    protected $casts = [
        'signs'       => 'boolean',
        'approved_at' => 'datetime',
        'position'    => 'integer',
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

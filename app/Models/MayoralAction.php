<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** What the Mayor (or the Acting Mayor) did with an ordinance / resolution within the LGC Sec. 54 period. */
class MayoralAction extends Model
{
    public const SIGNED = 'signed';
    public const VETOED = 'vetoed';
    public const DEEMED_APPROVED = 'deemed_approved';

    protected $table = 'mayoral_action';

    protected $fillable = ['document_id', 'action', 'action_date', 'remarks', 'acted_by', 'oic_designation_id'];

    protected $casts = [
        'action_date' => 'datetime',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'acted_by', 'id');
    }

    public function designation()
    {
        return $this->belongsTo(OicDesignation::class, 'oic_designation_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Where the paper original of a document is kept; the newest row is its current place. */
class DocumentPhysicalLocation extends Model
{
    protected $fillable = ['document_id', 'department_id', 'cabinet', 'box', 'remarks', 'recorded_by'];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by', 'id');
    }
}

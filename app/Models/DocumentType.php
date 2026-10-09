<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentType extends Model
{
    use HasFactory;

    protected $table = 'document_types';

    protected $primaryKey = 'type_id';

    /**
     * Citizen's Charter categories (RA 11032 Sec. 9) and the processing period each one allows. Legislative documents
     * (ordinances / resolutions) are the Mayor's 10 calendar days to sign or veto (LGC Sec. 54); Custom keeps the days
     * the Admin enters. Every category except Legislative counts working days.
     */
    public const CATEGORIES = [
        'simple'           => ['label' => 'Simple', 'days' => 3],
        'complex'          => ['label' => 'Complex', 'days' => 7],
        'highly_technical' => ['label' => 'Highly Technical', 'days' => 20],
        'legislative'      => ['label' => 'Legislative (LGC Sec. 54)', 'days' => 10],
        'custom'           => ['label' => 'Custom', 'days' => null],
    ];

    protected $fillable = [
        'type_name',
        'description',
        'arta_processing_days',
        'service_category',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'arta_processing_days' => 'integer',
    ];

    protected $appends = ['counts_calendar_days', 'requires_mayoral_action'];

    /** LGC Sec. 54 counts calendar days; ARTA (RA 11032) counts working days */
    public function countsCalendarDays(): bool
    {
        return $this->service_category === 'legislative';
    }

    public function requiresMayoralAction(): bool
    {
        return $this->service_category === 'legislative';
    }

    public function getCountsCalendarDaysAttribute(): bool
    {
        return $this->countsCalendarDays();
    }

    public function getRequiresMayoralActionAttribute(): bool
    {
        return $this->requiresMayoralAction();
    }

    public function documents()
    {
        return $this->hasMany(Document::class, 'type_id', 'type_id');
    }
}

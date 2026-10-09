<?php

namespace App\Models;

use App\Casts\DateOnly;
use Illuminate\Database\Eloquent\Model;

/** A non-working day skipped by ARTA deadlines (see App\Services\Calendar\WorkingDayCalendar). */
class Holiday extends Model
{
    public const TYPES = [
        'regular'    => 'Regular Holiday',
        'special'    => 'Special Non-Working Day',
        'suspension' => 'Work Suspension',
    ];

    protected $fillable = ['date', 'name', 'type', 'year', 'created_by'];

    protected $casts = [
        'date' => DateOnly::class,
        'year' => 'integer',
    ];
}

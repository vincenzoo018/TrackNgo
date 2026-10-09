<?php

namespace App\Models;

use App\Casts\DateOnly;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Written designation of an Officer-in-Charge (LGC Sec. 46): while it is in effect, documents meant for the
 * absent official (designating_user_id) go to the OIC (designated_user_id), who acts with this order as reference.
 */
class OicDesignation extends Model
{
    public const ROLE_MAYOR = 'Mayor';
    public const ROLE_DEPARTMENT_HEAD = 'Department Head';

    protected $fillable = [
        'designating_user_id', 'designated_user_id', 'role_covered', 'department_id', 'start_date', 'end_date',
        'designation_order_number', 'remarks', 'created_by', 'ended_at', 'ended_by',
    ];

    protected $casts = [
        'start_date' => DateOnly::class,
        'end_date'   => DateOnly::class,
        'ended_at'   => 'datetime',
    ];

    public function official()
    {
        return $this->belongsTo(User::class, 'designating_user_id', 'id');
    }

    public function officer()
    {
        return $this->belongsTo(User::class, 'designated_user_id', 'id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id', 'department_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    /** In effect on the given office day: started, not past its end date and not ended early. */
    public function scopeActiveOn(Builder $query, string $date): Builder
    {
        return $query->whereNull('ended_at')->whereDate('start_date', '<=', $date)->whereDate('end_date', '>=', $date);
    }

    /** "Acting Mayor" / "OIC, City Engineer's Office" */
    public function title(): string
    {
        return $this->role_covered === self::ROLE_MAYOR
            ? 'Acting Mayor'
            : 'OIC, ' . ($this->department?->department_name ?? 'Department Head');
    }

    /** "Acting Mayor per Designation Order No. 12, s. 2026" */
    public function reference(): string
    {
        return $this->title() . ' per Designation Order No. ' . $this->designation_order_number;
    }

    public function status(?CarbonInterface $now = null): string
    {
        $today = ($now ?? now())->copy()->setTimezone(config('arta.timezone', 'Asia/Manila'))->toDateString();

        return match (true) {
            $this->ended_at !== null                   => 'ended',
            $this->start_date->toDateString() > $today => 'scheduled',
            $this->end_date->toDateString() < $today   => 'expired',
            default                                    => 'active',
        };
    }
}

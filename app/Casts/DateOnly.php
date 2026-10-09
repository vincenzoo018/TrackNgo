<?php

namespace App\Casts;

use Carbon\CarbonInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Database\Eloquent\SerializesCastableAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Date;

/**
 * A calendar date without a time (deadlines, holidays, leave and designation periods), stored as "Y-m-d" and sent to
 * the browser as "Y-m-d". Laravel's `date` cast would store "Y-m-d 00:00:00", which no longer matches dates written
 * as plain "Y-m-d" (unique holiday dates, lookups by day). A Carbon value keeps the day it represents in its own time
 * zone, so a deadline computed in office time (Asia/Manila) is stored as that office day.
 */
class DateOnly implements CastsAttributes, SerializesCastableAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonInterface
    {
        return $value === null || $value === '' ? null : Date::parse(substr((string) $value, 0, 10))->startOfDay();
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : Date::parse(substr((string) $value, 0, 10))->format('Y-m-d');
    }

    /** Eloquent hands over the date already serialized ("2026-07-21T00:00:00.000000Z"): keep only the day */
    public function serialize(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : substr((string) $value, 0, 10);
    }
}

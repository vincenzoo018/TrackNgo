<?php

namespace App\Support;

/**
 * National holidays declared for a year (Proclamation No. 1006, s. 2025 for 2026; Eid'l Fitr and Eid'l Adha by
 * their own proclamations). Used to seed the Holiday Calendar; local holidays (e.g. the City of Mati's charter day)
 * and work suspensions are added by the Admin under System Configuration → Holiday Calendar.
 */
class PhilippineHolidays
{
    /** @return list<array{date: string, name: string, type: string}> */
    public static function for(int $year): array
    {
        return match ($year) {
            2026 => [
                ['date' => '2026-01-01', 'name' => "New Year's Day", 'type' => 'regular'],
                ['date' => '2026-02-17', 'name' => 'Chinese New Year', 'type' => 'special'],
                ['date' => '2026-03-20', 'name' => "Eid'l Fitr", 'type' => 'regular'],
                ['date' => '2026-04-02', 'name' => 'Maundy Thursday', 'type' => 'regular'],
                ['date' => '2026-04-03', 'name' => 'Good Friday', 'type' => 'regular'],
                ['date' => '2026-04-04', 'name' => 'Black Saturday', 'type' => 'special'],
                ['date' => '2026-04-09', 'name' => 'Araw ng Kagitingan', 'type' => 'regular'],
                ['date' => '2026-05-01', 'name' => 'Labor Day', 'type' => 'regular'],
                ['date' => '2026-05-27', 'name' => "Eid'l Adha", 'type' => 'regular'],
                ['date' => '2026-06-12', 'name' => 'Independence Day', 'type' => 'regular'],
                ['date' => '2026-08-21', 'name' => 'Ninoy Aquino Day', 'type' => 'special'],
                ['date' => '2026-08-31', 'name' => 'National Heroes Day', 'type' => 'regular'],
                ['date' => '2026-11-01', 'name' => "All Saints' Day", 'type' => 'special'],
                ['date' => '2026-11-02', 'name' => "All Souls' Day", 'type' => 'special'],
                ['date' => '2026-11-30', 'name' => 'Bonifacio Day', 'type' => 'regular'],
                ['date' => '2026-12-08', 'name' => 'Feast of the Immaculate Conception of Mary', 'type' => 'special'],
                ['date' => '2026-12-24', 'name' => 'Christmas Eve', 'type' => 'special'],
                ['date' => '2026-12-25', 'name' => 'Christmas Day', 'type' => 'regular'],
                ['date' => '2026-12-30', 'name' => 'Rizal Day', 'type' => 'regular'],
                ['date' => '2026-12-31', 'name' => 'Last Day of the Year', 'type' => 'special'],
            ],
            default => [],
        };
    }
}

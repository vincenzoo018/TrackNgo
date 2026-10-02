<?php

/*
|--------------------------------------------------------------------------
| ARTA (RA 11032) processing-time monitoring — EODB-Compliant Smart Escalation
|--------------------------------------------------------------------------
|
| WD = days elapsed since the document was assigned for processing (date filed)
| L  = allowable processing period (the document type's ARTA processing days)
| E  = 1 when WD > L  → the document is escalated
| OD = WD − L         → overdue days, which decide the escalation severity
|
*/

return [

    // Count Monday–Friday only. RA 11032 counts working days; the rest of TrackNGo counts calendar days,
    // so this stays off unless both should change together.
    'count_working_days' => (bool) env('ARTA_COUNT_WORKING_DAYS', false),

    // Days roll over at midnight office time, not server (UTC) time
    'timezone' => env('ARTA_TIMEZONE', 'Asia/Manila'),

    // L for a document type with no processing period configured
    'default_processing_days' => 3,

    // Escalation severity by overdue days: Warning 1–2, Critical 3–5, Overdue above 5
    'severity' => [
        'warning_max_days'  => 2,
        'critical_max_days' => 5,
    ],

    // "Approaching Deadline" once this share of L or less remains (never less than 1 day)
    'approaching_ratio' => 0.2,

    // "Inactive" alert when a document sits with one handler this many days without any action
    'inactivity_days' => 2,

    // A CART follow-up to the same handler about the same document is allowed once per this many hours
    'follow_up_cooldown_hours' => 24,

    // Page loads re-run the monitor at most this often (the scheduler runs it every five minutes)
    'sync_interval_seconds' => 60,
];

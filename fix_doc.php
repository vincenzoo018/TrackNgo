<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$d = \App\Models\Document::find(42);
if ($d) {
    $d->destination_department_id = 14;
    $d->save();
    echo "Fixed document 42\n";
}

$d2 = \App\Models\Document::where('tracking_number', 'like', 'RS-2026-0041')->first();
if ($d2) {
    echo "Found document with RS-2026-0041\n";
}

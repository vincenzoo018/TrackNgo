<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$docs = \App\Models\Document::whereIn('reference_number', ['CHRMO-2026-0002', 'CHRMO-2026-0003'])->get();
foreach($docs as $doc) {
    $doc->is_internal = true;
    $doc->status = 'pending_registration';
    $doc->current_holder_department_id = 1; 
    $doc->save();
}
echo "Updated " . count($docs) . " documents.\n";

<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$k = $app->make(Illuminate\Contracts\Http\Kernel::class);
$k->bootstrap();

$documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
    ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
    ->orderBy('completed_at', 'desc')
    ->orderBy('updated_at', 'desc')
    ->get();

echo "Count: " . count($documents) . PHP_EOL;
foreach ($documents as $d) {
    echo "ID: {$d->document_id} | Ref: {$d->reference_number} | Status: {$d->status} | Dept: " . ($d->department->department_name ?? 'NULL') . " | Type: " . ($d->type->type_name ?? 'NULL') . " | Filed: " . ($d->date_filed ?? 'NULL') . " | Completed: " . ($d->completed_at ?? 'NULL') . " | ARTA: " . ($d->arta_days_left ?? 'NULL') . PHP_EOL;
}

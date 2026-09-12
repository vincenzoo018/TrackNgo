<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();
$docs = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
    ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
    ->get();
echo "Count: " . count($docs) . "\n";
foreach ($docs as $doc) {
    echo "ID: {$doc->document_id}, Ref: {$doc->reference_number}, Status: {$doc->status}, Type: " . ($doc->type ? $doc->type->type_name : 'NULL') . ", Dept: " . ($doc->department ? $doc->department->department_name : 'NULL') . "\n";
}

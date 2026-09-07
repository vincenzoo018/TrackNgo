<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$doc = \App\Models\Document::where('reference_number', 'ADACS-2026-0002')->first();
if ($doc) {
    \App\Models\Document::where('reference_number', 'BPLO-2026-0001')->update([
        'attachment_path' => $doc->attachment_path,
        'ocr_text' => $doc->ocr_text
    ]);
    echo "Updated BPLO-2026-0001 successfully.\n";
} else {
    echo "Could not find ADACS-2026-0002.\n";
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Document files leave the public disk (anyone with the link could open /storage/...) for the private disk, where
     * only DocumentFileController serves them after checking the viewer may open the document. Paths stay the same.
     */
    public function up(): void
    {
        $public = Storage::disk('public');
        $private = Storage::disk('local');

        $paths = collect()
            ->merge(DB::table('documents')->pluck('attachment_path'))
            ->merge(DB::table('documents')->pluck('signed_file_path'))
            ->merge(DB::table('document_attachments')->pluck('file_path'))
            ->merge(DB::table('document_revisions')->pluck('file_path'))
            ->merge(DB::table('document_revisions')->pluck('signed_file_path'))
            ->filter()
            ->unique();

        foreach ($paths as $path) {
            if ($public->exists($path) && !$private->exists($path)) {
                $private->writeStream($path, $public->readStream($path));
            }
            if ($private->exists($path) && $public->exists($path)) {
                $public->delete($path);
            }
        }
    }

    public function down(): void
    {
        // Files stay private
    }
};

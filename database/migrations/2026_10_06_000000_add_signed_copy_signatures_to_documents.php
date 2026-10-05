<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The signed copy is rebuilt after every signature (not only once all have signed), so the document records
 * how many signatures the stored copy carries; the copy is final once that equals the number of signatories.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->unsignedSmallInteger('signed_copy_signatures')->default(0)->after('signed_file_path');
        });

        // Copies made before this change were only ever built once everyone had signed
        DB::table('documents')->whereNotNull('signed_file_path')->update([
            'signed_copy_signatures' => DB::raw('(SELECT COUNT(*) FROM document_signatories WHERE document_signatories.document_id = documents.document_id)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('signed_copy_signatures');
        });
    }
};

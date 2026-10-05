<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Versions of a document's main file. Version 1 is the file submitted at filing; a corrected file becomes
     * the next version and never overwrites an earlier one. Each signature records the version it was made on,
     * and the signed copy of a version is kept with it when a newer version replaces it.
     */
    public function up(): void
    {
        if (!Schema::hasTable('document_revisions')) {
            Schema::create('document_revisions', function (Blueprint $table) {
                $table->id('revision_id');
                $table->unsignedBigInteger('document_id');
                $table->unsignedSmallInteger('version_number');
                $table->string('file_path');
                $table->string('file_name');
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('mime_type', 100)->nullable();
                $table->char('file_hash', 64)->nullable();
                $table->text('revision_reason');
                $table->unsignedBigInteger('created_by')->nullable();
                // Kept so the creator stays identifiable even if the account is removed later
                $table->string('created_by_name', 150);
                $table->string('signed_file_path')->nullable();
                $table->unsignedSmallInteger('signed_copy_signatures')->default(0);
                $table->timestamps();

                $table->unique(['document_id', 'version_number']);
                $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }

        if (!Schema::hasColumn('digital_signatures', 'revision_id')) {
            Schema::table('digital_signatures', function (Blueprint $table) {
                $table->unsignedBigInteger('revision_id')->nullable()->after('document_id');
                $table->foreign('revision_id')->references('revision_id')->on('document_revisions')->onDelete('set null');
            });
        }

        $this->backfillOriginals();
    }

    /** Every existing document's file becomes its Version 1, and its signatures belong to that version. */
    private function backfillOriginals(): void
    {
        $disk = Storage::disk('public');

        DB::table('documents')
            ->whereNotNull('attachment_path')
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('document_revisions')->whereColumn('document_revisions.document_id', 'documents.document_id'))
            ->orderBy('document_id')
            ->chunkById(100, function ($documents) use ($disk) {
                foreach ($documents as $doc) {
                    $exists = $disk->exists($doc->attachment_path);
                    $creator = $doc->submitted_by ? DB::table('users')->where('id', $doc->submitted_by)->first() : null;
                    $creatorName = $creator
                        ? trim(preg_replace('/\s+/', ' ', "{$creator->first_name} " . ($creator->middle_name ?? '') . " {$creator->last_name}"))
                        : ($doc->sender ?: 'Sender');

                    $revisionId = DB::table('document_revisions')->insertGetId([
                        'document_id'     => $doc->document_id,
                        'version_number'  => 1,
                        'file_path'       => $doc->attachment_path,
                        'file_name'       => basename($doc->attachment_path),
                        'file_size'       => $exists ? $disk->size($doc->attachment_path) : null,
                        'mime_type'       => $exists ? $disk->mimeType($doc->attachment_path) : null,
                        'file_hash'       => $exists ? hash_file('sha256', $disk->path($doc->attachment_path)) : null,
                        'revision_reason' => 'Original submission',
                        'created_by'      => $creator?->id,
                        'created_by_name' => mb_substr($creatorName, 0, 150),
                        'created_at'      => $doc->date_filed ?? $doc->created_at,
                        'updated_at'      => $doc->date_filed ?? $doc->created_at,
                    ], 'revision_id');

                    DB::table('digital_signatures')->where('document_id', $doc->document_id)->update(['revision_id' => $revisionId]);
                }
            }, 'document_id');
    }

    public function down(): void
    {
        if (Schema::hasColumn('digital_signatures', 'revision_id')) {
            Schema::table('digital_signatures', function (Blueprint $table) {
                $table->dropForeign(['revision_id']);
                $table->dropColumn('revision_id');
            });
        }

        Schema::dropIfExists('document_revisions');
    }
};

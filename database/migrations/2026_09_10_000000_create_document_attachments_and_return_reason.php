<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('documents', 'return_reason')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->text('return_reason')->nullable()->after('status');
            });
        }

        if (!Schema::hasTable('document_attachments')) {
            Schema::create('document_attachments', function (Blueprint $table) {
                $table->id('attachment_id');
                $table->unsignedBigInteger('document_id');
                $table->unsignedBigInteger('user_id');
                $table->string('file_name');
                $table->string('file_path');
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('file_type')->nullable();
                $table->text('reason')->nullable();
                $table->timestamps();

                $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_attachments');

        if (Schema::hasColumn('documents', 'return_reason')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->dropColumn('return_reason');
            });
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * OCR text extracted from multi-page PDFs exceeds TEXT (64 KB) and made document
     * submission fail with "Data too long for column 'ocr_text'".
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->longText('ocr_text')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->text('ocr_text')->nullable()->change();
        });
    }
};

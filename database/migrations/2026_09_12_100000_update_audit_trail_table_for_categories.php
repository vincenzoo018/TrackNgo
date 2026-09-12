<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('audit_trail', function (Blueprint $table) {
            if (!Schema::hasColumn('audit_trail', 'category')) {
                $table->string('category', 20)->default('action')->after('document_id')->index();
            }
            $table->unsignedBigInteger('document_id')->nullable()->change();
            $table->unsignedBigInteger('user_id')->nullable()->change();
        });

        // Ensure all pre-existing records have category = 'action'
        DB::table('audit_trail')->whereNull('category')->orWhere('category', '')->update(['category' => 'action']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_trail', function (Blueprint $table) {
            if (Schema::hasColumn('audit_trail', 'category')) {
                $table->dropColumn('category');
            }
        });
    }
};

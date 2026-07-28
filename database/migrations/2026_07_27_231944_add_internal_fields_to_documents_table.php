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
        Schema::table('documents', function (Blueprint $table) {
            $table->boolean('is_internal')->default(false)->after('classification');
            $table->unsignedBigInteger('destination_department_id')->nullable()->after('is_internal');
            
            $table->foreign('destination_department_id')->references('department_id')->on('departments')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['destination_department_id']);
            $table->dropColumn(['is_internal', 'destination_department_id']);
        });
    }
};

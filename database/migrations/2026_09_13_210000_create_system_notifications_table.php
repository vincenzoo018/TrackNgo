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
        if (!Schema::hasTable('system_notifications')) {
            Schema::create('system_notifications', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('document_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('target_role', 50)->nullable()->index();
                $table->unsignedBigInteger('target_department_id')->nullable()->index();
                $table->string('type', 40)->default('receipt'); // receipt, deadline_warning, deadline_overdue, escalated
                $table->string('severity', 20)->default('normal'); // normal, warning, overdue, escalated
                $table->string('title', 150);
                $table->string('reference_number', 60)->nullable();
                $table->string('document_type', 100)->nullable();
                $table->string('originating_department', 150)->nullable();
                $table->string('action_url', 255)->nullable();
                $table->boolean('is_read')->default(false)->index();
                $table->timestamps();

                $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_notifications');
    }
};

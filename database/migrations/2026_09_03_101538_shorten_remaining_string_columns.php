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
        Schema::table('users', function (Blueprint $table) {
            $table->string('mobile_number', 50)->nullable()->change();
        });

        Schema::table('audit_trail', function (Blueprint $table) {
            $table->string('department', 100)->nullable()->change();
            $table->string('document_ref', 50)->nullable()->change();
            $table->string('ip_address', 45)->nullable()->change();
            $table->string('user_role', 100)->nullable()->change();
        });

        Schema::table('digital_signatures', function (Blueprint $table) {
            $table->string('action_type', 50)->change();
            $table->string('ip_address', 45)->nullable()->change();
        });

        Schema::table('document_types', function (Blueprint $table) {
            $table->string('type_name', 100)->change();
        });

        Schema::table('report_logs', function (Blueprint $table) {
            $table->string('report_type', 100)->change();
        });

        Schema::table('routing_slips', function (Blueprint $table) {
            $table->string('action', 50)->change();
        });

        Schema::table('sms_notifications', function (Blueprint $table) {
            $table->string('document_ref', 50)->nullable()->change();
            $table->string('mobile_number', 50)->change();
            $table->string('recipient_name', 100)->change();
            $table->string('status', 50)->default('pending')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('mobile_number', 255)->nullable()->change();
        });

        Schema::table('audit_trail', function (Blueprint $table) {
            $table->string('department', 255)->nullable()->change();
            $table->string('document_ref', 255)->nullable()->change();
            $table->string('ip_address', 255)->nullable()->change();
            $table->string('user_role', 255)->nullable()->change();
        });

        Schema::table('digital_signatures', function (Blueprint $table) {
            $table->string('action_type', 255)->change();
            $table->string('ip_address', 255)->nullable()->change();
        });

        Schema::table('document_types', function (Blueprint $table) {
            $table->string('type_name', 255)->change();
        });

        Schema::table('report_logs', function (Blueprint $table) {
            $table->string('report_type', 255)->change();
        });

        Schema::table('routing_slips', function (Blueprint $table) {
            $table->string('action', 255)->change();
        });

        Schema::table('sms_notifications', function (Blueprint $table) {
            $table->string('document_ref', 255)->nullable()->change();
            $table->string('mobile_number', 255)->change();
            $table->string('recipient_name', 255)->change();
            $table->string('status', 255)->default('pending')->change();
        });
    }
};

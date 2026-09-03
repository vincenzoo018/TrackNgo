<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 60)->nullable()->change();
            $table->string('middle_name', 60)->nullable()->change();
            $table->string('last_name', 60)->nullable()->change();
            $table->string('email', 100)->change();
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->string('department_name', 100)->change();
            $table->string('code', 50)->nullable()->change();
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->string('role_name', 100)->change();
            $table->string('position', 100)->change();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->string('title', 150)->change();
            $table->string('reference_number', 50)->nullable()->change();
            $table->string('tracking_number', 50)->nullable()->change();
            $table->string('classification', 50)->default('normal')->change();
            $table->string('status', 50)->default('submitted')->change();
            $table->string('contact_number', 50)->nullable()->change();
            $table->string('sender', 100)->nullable()->change();
        });

        Schema::table('routing_slips', function (Blueprint $table) {
            $table->string('tracking_number', 50)->change();
            $table->string('sender_name', 100)->change();
            $table->string('status', 50)->default('Active')->change();
        });

        Schema::table('audit_trail', function (Blueprint $table) {
            $table->string('action', 50)->change();
        });

        Schema::table('arta_escalations', function (Blueprint $table) {
            $table->string('escalation_level', 50)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 255)->nullable()->change();
            $table->string('middle_name', 255)->nullable()->change();
            $table->string('last_name', 255)->nullable()->change();
            $table->string('email', 255)->change();
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->string('department_name', 255)->change();
            $table->string('code', 255)->nullable()->change();
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->string('role_name', 255)->change();
            $table->string('position', 255)->change();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->string('title', 255)->change();
            $table->string('reference_number', 255)->nullable()->change();
            $table->string('tracking_number', 255)->nullable()->change();
            $table->string('classification', 255)->default('normal')->change();
            $table->string('status', 255)->default('submitted')->change();
            $table->string('contact_number', 255)->nullable()->change();
            $table->string('sender', 255)->nullable()->change();
        });

        Schema::table('routing_slips', function (Blueprint $table) {
            $table->string('tracking_number', 255)->change();
            $table->string('sender_name', 255)->change();
            $table->string('status', 255)->default('Active')->change();
        });

        Schema::table('audit_trail', function (Blueprint $table) {
            $table->string('action', 255)->change();
        });

        Schema::table('arta_escalations', function (Blueprint $table) {
            $table->string('escalation_level', 255)->change();
        });
    }
};

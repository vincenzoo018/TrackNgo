<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id('role_id');
            $table->string('role_name');
            $table->string('position');
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id('department_id');
            $table->string('department_name');
            $table->timestamps();
        });

        Schema::create('document_types', function (Blueprint $table) {
            $table->id('type_id');
            $table->string('type_name');
            $table->integer('arta_days');
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('mobile_number')->nullable();
            $table->integer('is_active')->default(1);

            $table->foreign('role_id')->references('role_id')->on('roles')->onDelete('set null');
            $table->foreign('department_id')->references('department_id')->on('departments')->onDelete('set null');
        });

        Schema::create('report_logs', function (Blueprint $table) {
            $table->id('report_id');
            $table->unsignedBigInteger('generated_by');
            $table->string('report_type');
            $table->date('date_from');
            $table->date('date_to');
            $table->dateTime('generated_at');
            $table->timestamps();

            $table->foreign('generated_by')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id('document_id');
            $table->string('reference_number')->unique();
            $table->string('title');
            $table->unsignedBigInteger('submitted_by');
            $table->unsignedBigInteger('department_id');
            $table->unsignedBigInteger('type_id');
            $table->string('attachment_path')->nullable();
            $table->integer('current_step_index')->default(1);
            $table->boolean('is_escalated')->default(false);
            $table->dateTime('date_filed');
            $table->timestamps();

            $table->foreign('submitted_by')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('department_id')->references('department_id')->on('departments')->onDelete('cascade');
            $table->foreign('type_id')->references('type_id')->on('document_types')->onDelete('cascade');
        });

        Schema::create('digital_signatures', function (Blueprint $table) {
            $table->id('signature_id');
            $table->unsignedBigInteger('document_id');
            $table->unsignedBigInteger('signed_by_user_id');
            $table->string('signature_image')->nullable();
            $table->string('signature_hash');
            $table->string('action_type');
            $table->dateTime('signed_at');
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
            $table->foreign('signed_by_user_id')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('routing_slips', function (Blueprint $table) {
            $table->id('slip_id');
            $table->unsignedBigInteger('document_id');
            $table->string('tracking_number');
            $table->unsignedBigInteger('received_by')->nullable();
            $table->dateTime('date_received')->nullable();
            $table->string('sender_name');
            $table->text('action_instruction')->nullable();
            $table->unsignedBigInteger('target_department_id')->nullable();
            $table->unsignedBigInteger('noted_by')->nullable();
            $table->string('slip_status')->default('Active');
            $table->dateTime('created_at')->useCurrent();
            $table->dateTime('updated_at')->nullable();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
            $table->foreign('received_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('target_department_id')->references('department_id')->on('departments')->onDelete('set null');
            $table->foreign('noted_by')->references('id')->on('users')->onDelete('set null');
        });

        Schema::create('audit_trail', function (Blueprint $table) {
            $table->id('audit_id');
            $table->unsignedBigInteger('document_id');
            $table->unsignedBigInteger('user_id');
            $table->string('action');
            $table->text('details')->nullable();
            $table->dateTime('timestamp');
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('arta_escalations', function (Blueprint $table) {
            $table->id('escalation_id');
            $table->unsignedBigInteger('document_id');
            $table->integer('arta_threshold');
            $table->integer('days_elapsed');
            $table->string('escalation_level');
            $table->unsignedBigInteger('notified_user_id')->nullable();
            $table->boolean('notification_sent')->default(false);
            $table->boolean('resolved')->default(false);
            $table->dateTime('escalated_at');
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
            $table->foreign('notified_user_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arta_escalations');
        Schema::dropIfExists('audit_trail');
        Schema::dropIfExists('routing_slips');
        Schema::dropIfExists('digital_signatures');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('report_logs');
        
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['role_id', 'department_id', 'mobile_number', 'is_active']);
        });

        Schema::dropIfExists('document_types');
        Schema::dropIfExists('departments');
        Schema::dropIfExists('roles');
    }
};

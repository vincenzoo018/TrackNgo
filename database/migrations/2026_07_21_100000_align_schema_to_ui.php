<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. departments ──────────────────────────────────────────
        Schema::table('departments', function (Blueprint $table) {
            $table->string('code')->nullable()->after('department_name');
            $table->text('description')->nullable()->after('code');
            $table->unsignedBigInteger('head_id')->nullable()->after('description');
            $table->boolean('is_active')->default(true)->after('head_id');

            $table->foreign('head_id')->references('id')->on('users')->onDelete('set null');
        });

        // ── 2. document_types ───────────────────────────────────────
        Schema::table('document_types', function (Blueprint $table) {
            $table->renameColumn('arta_days', 'arta_processing_days');
        });
        Schema::table('document_types', function (Blueprint $table) {
            $table->text('description')->nullable()->after('type_name');
            $table->boolean('is_active')->default(true)->after('arta_processing_days');
        });

        // ── 3. documents ────────────────────────────────────────────
        Schema::table('documents', function (Blueprint $table) {
            $table->string('tracking_number')->unique()->nullable()->after('reference_number');
            $table->string('classification')->default('normal')->after('attachment_path');
            $table->text('urgency_justification')->nullable()->after('classification');
            $table->string('status')->default('submitted')->after('urgency_justification');
            $table->string('contact_number')->nullable()->after('status');
            $table->string('qr_code_path')->nullable()->after('contact_number');
            $table->text('ocr_text')->nullable()->after('qr_code_path');
            $table->integer('total_steps')->default(5)->after('current_step_index');
            $table->date('arta_due_date')->nullable()->after('total_steps');
            $table->dateTime('submitted_at')->nullable()->after('date_filed');
            $table->dateTime('completed_at')->nullable()->after('submitted_at');
            $table->unsignedBigInteger('linked_document_id')->nullable()->after('completed_at');
            $table->string('version')->default('v1.0')->after('linked_document_id');
            $table->string('sender')->nullable()->after('version');
            $table->unsignedBigInteger('current_holder_id')->nullable()->after('sender');
            $table->unsignedBigInteger('current_holder_department_id')->nullable()->after('current_holder_id');

            $table->foreign('linked_document_id')->references('document_id')->on('documents')->onDelete('set null');
            $table->foreign('current_holder_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('current_holder_department_id')->references('department_id')->on('departments')->onDelete('set null');
        });

        // ── 4. routing_slips ────────────────────────────────────────
        Schema::table('routing_slips', function (Blueprint $table) {
            $table->unsignedBigInteger('from_user_id')->nullable()->after('document_id');
            $table->unsignedBigInteger('from_department_id')->nullable()->after('from_user_id');
            $table->unsignedBigInteger('to_user_id')->nullable()->after('from_department_id');
            $table->string('action')->default('forward')->after('to_user_id');
            $table->renameColumn('action_instruction', 'instruction');
            $table->renameColumn('slip_status', 'status');

            $table->foreign('from_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('from_department_id')->references('department_id')->on('departments')->onDelete('set null');
            $table->foreign('to_user_id')->references('id')->on('users')->onDelete('set null');
        });

        // ── 5. digital_signatures ───────────────────────────────────
        Schema::table('digital_signatures', function (Blueprint $table) {
            $table->string('ip_address')->nullable()->after('action_type');
        });

        // ── 6. audit_trail ──────────────────────────────────────────
        Schema::table('audit_trail', function (Blueprint $table) {
            $table->renameColumn('details', 'description');
        });
        Schema::table('audit_trail', function (Blueprint $table) {
            $table->string('user_role')->nullable()->after('user_id');
            $table->string('department')->nullable()->after('user_role');
            $table->string('document_ref')->nullable()->after('department');
            $table->string('ip_address')->nullable()->after('description');
        });

        // ── 7. users ────────────────────────────────────────────────
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar')->nullable()->after('is_active');
        });

        // ── 8. sms_notifications (new table) ────────────────────────
        Schema::create('sms_notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('document_id')->nullable();
            $table->string('document_ref')->nullable();
            $table->string('recipient_name');
            $table->string('mobile_number');
            $table->text('message');
            $table->string('status')->default('pending'); // sent, failed, pending
            $table->dateTime('sent_at')->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('set null');
        });

        // ── 9. document_comments (new table) ────────────────────────
        Schema::create('document_comments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('document_id');
            $table->unsignedBigInteger('user_id');
            $table->text('comment');
            $table->boolean('is_anchored')->default(false);
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_comments');
        Schema::dropIfExists('sms_notifications');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar');
        });

        Schema::table('audit_trail', function (Blueprint $table) {
            $table->dropColumn(['user_role', 'department', 'document_ref', 'ip_address']);
        });
        Schema::table('audit_trail', function (Blueprint $table) {
            $table->renameColumn('description', 'details');
        });

        Schema::table('digital_signatures', function (Blueprint $table) {
            $table->dropColumn('ip_address');
        });

        Schema::table('routing_slips', function (Blueprint $table) {
            $table->renameColumn('instruction', 'action_instruction');
            $table->renameColumn('status', 'slip_status');
            $table->dropForeign(['from_user_id']);
            $table->dropForeign(['from_department_id']);
            $table->dropForeign(['to_user_id']);
            $table->dropColumn(['from_user_id', 'from_department_id', 'to_user_id', 'action']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['linked_document_id']);
            $table->dropForeign(['current_holder_id']);
            $table->dropForeign(['current_holder_department_id']);
            $table->dropColumn([
                'tracking_number', 'classification', 'urgency_justification', 'status',
                'contact_number', 'qr_code_path', 'ocr_text', 'total_steps',
                'arta_due_date', 'submitted_at', 'completed_at', 'linked_document_id',
                'version', 'sender', 'current_holder_id', 'current_holder_department_id',
            ]);
        });

        Schema::table('document_types', function (Blueprint $table) {
            $table->dropColumn(['description', 'is_active']);
        });
        Schema::table('document_types', function (Blueprint $table) {
            $table->renameColumn('arta_processing_days', 'arta_days');
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->dropForeign(['head_id']);
            $table->dropColumn(['code', 'description', 'head_id', 'is_active']);
        });
    }
};

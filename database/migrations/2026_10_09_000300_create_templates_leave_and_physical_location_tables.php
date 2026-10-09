<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Blank forms / letter templates managed by the Admin and offered when filing a document of that type
        if (!Schema::hasTable('document_templates')) {
            Schema::create('document_templates', function (Blueprint $table) {
                $table->id();
                $table->string('name', 150);
                $table->text('description')->nullable();
                $table->unsignedBigInteger('type_id')->nullable();
                $table->string('file_path');
                $table->string('file_name');
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('mime_type', 100)->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->foreign('type_id')->references('type_id')->on('document_types')->nullOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        // Leave of absence recorded by HR; approving a head's leave can designate an Officer-in-Charge
        if (!Schema::hasTable('leave_requests')) {
            Schema::create('leave_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->string('leave_type', 40);
                $table->date('start_date');
                $table->date('end_date');
                // Working days covered (weekends and the Holiday Calendar are not counted)
                $table->unsignedSmallInteger('working_days');
                $table->text('reason')->nullable();
                // pending | approved | rejected | cancelled
                $table->string('status', 20)->default('pending')->index();
                $table->unsignedBigInteger('reviewed_by')->nullable();
                $table->dateTime('reviewed_at')->nullable();
                $table->text('review_remarks')->nullable();
                $table->unsignedBigInteger('oic_designation_id')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users');
                $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('oic_designation_id')->references('id')->on('oic_designations')->nullOnDelete();
            });
        }

        // Where the paper original is kept (office, cabinet / shelf, box / folder); the latest row is the current place
        if (!Schema::hasTable('document_physical_locations')) {
            Schema::create('document_physical_locations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('document_id')->index();
                $table->unsignedBigInteger('department_id')->nullable();
                $table->string('cabinet', 100);
                $table->string('box', 100)->nullable();
                $table->string('remarks', 255)->nullable();
                $table->unsignedBigInteger('recorded_by')->nullable();
                $table->timestamps();

                $table->foreign('document_id')->references('document_id')->on('documents')->cascadeOnDelete();
                $table->foreign('department_id')->references('department_id')->on('departments')->nullOnDelete();
                $table->foreign('recorded_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_physical_locations');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('document_templates');
    }
};

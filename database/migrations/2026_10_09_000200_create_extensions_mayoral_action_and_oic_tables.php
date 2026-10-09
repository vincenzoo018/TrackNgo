<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // RA 11032: a processing office may extend the period ONCE, with written notice to the client.
        // The unique document_id makes a second extension impossible even if two requests race.
        if (!Schema::hasTable('extensions')) {
            Schema::create('extensions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('document_id')->unique();
                $table->unsignedBigInteger('extended_by')->nullable();
                $table->text('reason');
                $table->date('previous_due_date');
                $table->date('new_due_date');
                $table->unsignedSmallInteger('extended_days');
                $table->dateTime('extended_at');
                $table->boolean('notified_client')->default(false);
                $table->timestamps();

                $table->foreign('document_id')->references('document_id')->on('documents')->cascadeOnDelete();
                $table->foreign('extended_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        // LGC Sec. 54: what the Mayor (or the Acting Mayor) did with an ordinance / resolution
        if (!Schema::hasTable('mayoral_action')) {
            Schema::create('mayoral_action', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('document_id')->index();
                // signed | vetoed | deemed_approved
                $table->string('action', 20);
                $table->dateTime('action_date');
                $table->text('remarks')->nullable();
                $table->unsignedBigInteger('acted_by')->nullable();
                $table->unsignedBigInteger('oic_designation_id')->nullable();
                $table->timestamps();

                $table->foreign('document_id')->references('document_id')->on('documents')->cascadeOnDelete();
                $table->foreign('acted_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        // LGC Sec. 46: written designation of an Officer-in-Charge / Acting Mayor while an official is away
        if (!Schema::hasTable('oic_designations')) {
            Schema::create('oic_designations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('designating_user_id');
                $table->unsignedBigInteger('designated_user_id');
                // Mayor | Department Head
                $table->string('role_covered', 30);
                $table->unsignedBigInteger('department_id')->nullable();
                $table->date('start_date');
                $table->date('end_date');
                $table->string('designation_order_number', 60);
                $table->text('remarks')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->dateTime('ended_at')->nullable();
                $table->unsignedBigInteger('ended_by')->nullable();
                $table->timestamps();

                $table->index(['designating_user_id', 'start_date', 'end_date']);
                $table->foreign('designating_user_id')->references('id')->on('users');
                $table->foreign('designated_user_id')->references('id')->on('users');
                $table->foreign('department_id')->references('department_id')->on('departments')->nullOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('ended_by')->references('id')->on('users')->nullOnDelete();
            });

            Schema::table('mayoral_action', function (Blueprint $table) {
                $table->foreign('oic_designation_id')->references('id')->on('oic_designations')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('mayoral_action');
        Schema::dropIfExists('oic_designations');
        Schema::dropIfExists('extensions');
    }
};

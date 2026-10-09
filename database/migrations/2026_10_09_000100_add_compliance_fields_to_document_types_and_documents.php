<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Document types get their Citizen's Charter category: Simple (3 working days), Complex (7), Highly Technical
     * (20), Custom, or Legislative — ordinances and resolutions the Mayor must sign or veto within 10 calendar days
     * of receipt or they are deemed approved (LGC Sec. 54).
     *
     * Documents record the deemed approval (RA 11032 Sec. 10 / LGC Sec. 54), when the Mayor received a legislative
     * document and must act by, and on whose behalf an Officer-in-Charge holds it (LGC Sec. 46).
     */
    public function up(): void
    {
        if (!Schema::hasColumn('document_types', 'service_category')) {
            Schema::table('document_types', function (Blueprint $table) {
                $table->string('service_category', 20)->default('custom')->after('arta_processing_days');
            });
        }

        // Existing types: 3 / 7 / 20 days are the ARTA categories; ordinances and resolutions are legislative (10 days)
        DB::table('document_types')->whereIn(DB::raw('LOWER(type_name)'), ['ordinance', 'resolution'])
            ->update(['service_category' => 'legislative', 'arta_processing_days' => 10]);
        foreach ([3 => 'simple', 7 => 'complex', 20 => 'highly_technical'] as $days => $category) {
            DB::table('document_types')->where('service_category', 'custom')->where('arta_processing_days', $days)
                ->update(['service_category' => $category]);
        }

        Schema::table('documents', function (Blueprint $table) {
            if (!Schema::hasColumn('documents', 'deemed_approved_at')) {
                $table->dateTime('deemed_approved_at')->nullable();
                $table->string('deemed_approval_basis', 40)->nullable();
            }
            if (!Schema::hasColumn('documents', 'mayor_received_at')) {
                $table->dateTime('mayor_received_at')->nullable();
                $table->date('mayor_action_due_date')->nullable();
            }
            if (!Schema::hasColumn('documents', 'held_for_user_id')) {
                // The absent official (Mayor / Department Head) an Officer-in-Charge holds the document for
                $table->unsignedBigInteger('held_for_user_id')->nullable();
                $table->foreign('held_for_user_id')->references('id')->on('users')->nullOnDelete();
            }
        });

        // An Officer-in-Charge acts for the absent official: the routing slips they send and the signatures they
        // stamp say so ("Acting Mayor per Designation Order No. 12, s. 2026")
        if (!Schema::hasColumn('routing_slips', 'acting_for_user_id')) {
            Schema::table('routing_slips', function (Blueprint $table) {
                $table->unsignedBigInteger('acting_for_user_id')->nullable();
                $table->foreign('acting_for_user_id')->references('id')->on('users')->nullOnDelete();
            });
        }
        if (!Schema::hasColumn('digital_signatures', 'capacity')) {
            Schema::table('digital_signatures', function (Blueprint $table) {
                $table->string('capacity', 191)->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('digital_signatures', fn (Blueprint $table) => $table->dropColumn('capacity'));
        Schema::table('routing_slips', function (Blueprint $table) {
            $table->dropForeign(['acting_for_user_id']);
            $table->dropColumn('acting_for_user_id');
        });
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['held_for_user_id']);
            $table->dropColumn(['deemed_approved_at', 'deemed_approval_basis', 'mayor_received_at', 'mayor_action_due_date', 'held_for_user_id']);
        });
        Schema::table('document_types', fn (Blueprint $table) => $table->dropColumn('service_category'));
    }
};

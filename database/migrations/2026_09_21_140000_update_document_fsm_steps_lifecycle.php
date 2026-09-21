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
        Schema::table('documents', function (Blueprint $table) {
            $table->integer('total_steps')->default(7)->change();
        });

        // Migrate all existed documents to proper FSM lifecycle step indices and total steps
        $docs = DB::table('documents')->get();

        foreach ($docs as $doc) {
            $isInternal = (bool) $doc->is_internal;
            $rawStatus = strtolower(trim((string) $doc->status));

            if ($isInternal) {
                $totalSteps = 6;
                $step = match (true) {
                    $rawStatus === 'submitted' => 1,
                    in_array($rawStatus, ['pending_registration', 'registered']) => 2,
                    in_array($rawStatus, ['in_review', 'reviewed', 'dept_reviewed']) => 3,
                    in_array($rawStatus, ['forwarded', 'endorsed', 'sent', 'ongoing']) => 4,
                    in_array($rawStatus, ['accepted', 'mayor_accepted']) => 5,
                    in_array($rawStatus, ['approved', 'for_release', 'released', 'completed', 'archived']) => 6,
                    default => max(1, min((int) $doc->current_step_index, 6)),
                };
            } else {
                $totalSteps = 7;
                $step = match (true) {
                    in_array($rawStatus, ['submitted', 'pending_registration']) => 1,
                    in_array($rawStatus, ['dept_accepted', 'accepted']) => ($doc->current_step_index >= 5 ? 5 : 2),
                    in_array($rawStatus, ['in_review', 'reviewed', 'dept_reviewed']) => ($doc->current_step_index >= 6 ? 6 : 3),
                    in_array($rawStatus, ['forwarded', 'endorsed', 'sent', 'ongoing']) => 4,
                    $rawStatus === 'mayor_accepted' => 5,
                    in_array($rawStatus, ['approved', 'mayor_reviewed']) => 6,
                    $rawStatus === 'for_release' => 6,
                    in_array($rawStatus, ['released', 'completed', 'archived']) => 7,
                    default => max(1, min((int) $doc->current_step_index, 7)),
                };
            }

            DB::table('documents')
                ->where('document_id', $doc->document_id)
                ->update([
                    'total_steps'        => $totalSteps,
                    'current_step_index' => $step,
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->integer('total_steps')->default(5)->change();
        });
    }
};

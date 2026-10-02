<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Escalation events recorded by the ARTA monitor: one row per document and severity level, with the
     * responsible office at the time and who resolved it.
     */
    public function up(): void
    {
        Schema::table('arta_escalations', function (Blueprint $table) {
            $table->integer('overdue_days')->default(0)->after('days_elapsed');
            $table->string('reason', 255)->nullable()->after('escalation_level');
            $table->unsignedBigInteger('holder_department_id')->nullable()->after('notified_user_id');
            $table->unsignedBigInteger('resolved_by')->nullable()->after('resolved_at');
            $table->text('resolution_notes')->nullable()->after('resolved_by');

            $table->index(['document_id', 'escalation_level']);
            $table->index('resolved');
        });
    }

    public function down(): void
    {
        Schema::table('arta_escalations', function (Blueprint $table) {
            $table->dropIndex(['document_id', 'escalation_level']);
            $table->dropIndex(['resolved']);
            $table->dropColumn(['overdue_days', 'reason', 'holder_department_id', 'resolved_by', 'resolution_notes']);
        });
    }
};

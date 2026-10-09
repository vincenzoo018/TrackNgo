<?php

use App\Support\PhilippineHolidays;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Non-working days skipped by every ARTA deadline (RA 11032 counts working days): regular holidays, special
     * non-working days and work suspensions (typhoons, local declarations). Weekends are skipped by the calculator.
     */
    public function up(): void
    {
        if (!Schema::hasTable('holidays')) {
            Schema::create('holidays', function (Blueprint $table) {
                $table->id();
                $table->date('date')->unique();
                $table->string('name', 150);
                // regular | special | suspension
                $table->string('type', 20)->default('regular');
                $table->unsignedSmallInteger('year')->index();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        $now = now();
        foreach (PhilippineHolidays::for(2026) as $holiday) {
            DB::table('holidays')->insertOrIgnore($holiday + ['year' => 2026, 'created_at' => $now, 'updated_at' => $now]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('holidays');
    }
};

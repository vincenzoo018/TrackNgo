<?php

use App\Models\DocumentType;
use App\Services\Calendar\WorkingDayCalendar;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Every document gets the deadline its type allows from the day it was filed, counted with the Holiday Calendar
     * (working days; calendar days for ordinances / resolutions). New documents get it at filing, so the clock,
     * the lists, the reports and the public tracking page all read the same date.
     */
    public function up(): void
    {
        $calendar = new WorkingDayCalendar();
        $types = DocumentType::all()->keyBy('type_id');

        DB::table('documents')->whereNull('arta_due_date')->orderBy('document_id')
            ->get(['document_id', 'type_id', 'date_filed', 'created_at'])
            ->each(function ($document) use ($calendar, $types) {
                $filed = $document->date_filed ?? $document->created_at;
                if (!$filed) {
                    return;
                }
                DB::table('documents')->where('document_id', $document->document_id)->update([
                    'arta_due_date' => $calendar->dueDate($filed, $types->get($document->type_id))->toDateString(),
                ]);
            });
    }

    public function down(): void
    {
        // The computed deadlines are kept: they are what the type allowed when the document was filed
    }
};

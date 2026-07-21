<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ReportController extends Controller
{
    // Feature 4: Predictive SLA Warning Dashboard
    public function getPredictiveWarnings()
    {
        // Get all active documents that aren't escalated yet
        $activeDocuments = Document::with('type')
            ->where('is_escalated', false)
            ->where('current_step_index', '<', 5) // Assuming 5 is completed
            ->get();

        $warnings = [];

        foreach ($activeDocuments as $doc) {
            if (!$doc->type) continue;
            
            $daysAllowed = $doc->type->arta_days;
            $deadline = Carbon::parse($doc->date_filed)->addWeekdays($daysAllowed);
            $daysLeft = Carbon::now()->diffInWeekdays($deadline, false);

            // If there's 1 day or less left, flag it as a critical warning
            if ($daysLeft <= 1 && $daysLeft >= 0) {
                $warnings[] = [
                    'document' => $doc,
                    'status' => 'Critical Warning',
                    'message' => "Expiring in {$daysLeft} day(s)",
                    'deadline' => $deadline->format('Y-m-d')
                ];
            }
        }

        return response()->json($warnings);
    }
}

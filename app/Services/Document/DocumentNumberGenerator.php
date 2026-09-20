<?php

namespace App\Services\Document;

use App\Models\Department;
use App\Models\Document;

class DocumentNumberGenerator
{
    /**
     * Generate department-aware reference number: {DEPT_CODE}-{YEAR}-{SEQ}
     */
    public function generateReferenceNumber(?int $departmentId): string
    {
        $department = $departmentId ? Department::find($departmentId) : null;
        $deptCode = $department?->code ?? 'GEN';
        $year = date('Y');

        $deptDocCount = Document::where('department_id', $departmentId)
            ->whereYear('created_at', $year)
            ->count() + 1;

        return sprintf('%s-%s-%s', $deptCode, $year, str_pad($deptDocCount, 4, '0', STR_PAD_LEFT));
    }

    /**
     * Generate sequential tracking number: RS-{YEAR}-{SEQ}
     */
    public function generateTrackingNumber(): string
    {
        $year = date('Y');
        $latestDoc = Document::whereNotNull('tracking_number')
            ->where('tracking_number', 'like', "RS-{$year}-%")
            ->orderBy('tracking_number', 'desc')
            ->first();

        $nextSeq = $latestDoc ? ((int) substr($latestDoc->tracking_number, -4)) + 1 : 1;

        return sprintf('RS-%s-%s', $year, str_pad($nextSeq, 4, '0', STR_PAD_LEFT));
    }
}

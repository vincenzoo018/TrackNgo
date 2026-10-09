<?php

namespace App\Services\Document;

use App\Models\Department;
use App\Models\Document;

/**
 * Reference ({OFFICE CODE}-{YEAR}-{SEQ}) and tracking (RS-{YEAR}-{SEQ}) numbers. The next number follows the
 * highest one already used with the same prefix (not a count, which repeats numbers once documents move between
 * offices or are removed), and is checked against what exists; the unique indexes catch a simultaneous filing.
 */
class DocumentNumberGenerator
{
    /**
     * Generate department-aware reference number: {DEPT_CODE}-{YEAR}-{SEQ}
     */
    public function generateReferenceNumber(?int $departmentId): string
    {
        $department = $departmentId ? Department::find($departmentId) : null;
        $deptCode = $department?->code ?: 'GEN';

        return $this->next('reference_number', sprintf('%s-%s-', $deptCode, $this->year()));
    }

    /**
     * Generate sequential tracking number: RS-{YEAR}-{SEQ}
     */
    public function generateTrackingNumber(): string
    {
        return $this->next('tracking_number', sprintf('RS-%s-', $this->year()));
    }

    private function next(string $column, string $prefix): string
    {
        $highest = Document::where($column, 'like', $prefix . '%')
            ->pluck($column)
            ->map(fn ($number) => (int) substr((string) $number, strlen($prefix)))
            ->max() ?? 0;

        do {
            $candidate = $prefix . str_pad((string) ++$highest, 4, '0', STR_PAD_LEFT);
        } while (Document::where($column, $candidate)->exists());

        return $candidate;
    }

    /** The filing year in office time (a document filed on 1 January, 07:00 in Manila belongs to the new year) */
    private function year(): string
    {
        return now()->setTimezone(config('arta.timezone', 'Asia/Manila'))->format('Y');
    }
}

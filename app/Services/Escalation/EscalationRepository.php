<?php

namespace App\Services\Escalation;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\User;
use Illuminate\Support\Collection;

class EscalationRepository
{
    /**
     * Get candidate documents for escalation and SLA breach tracking.
     */
    public function getCandidateDocuments(User $user, bool $isFullAccess): Collection
    {
        $docQuery = Document::with([
            'department',
            'type',
            'submitter.role',
            'currentHolder.role',
            'currentHolderDepartment',
        ]);

        if (!$isFullAccess) {
            $docQuery->involving($user);
        }

        return $docQuery->orderBy('document_id', 'desc')->get();
    }

    public function getActiveDepartments(): Collection
    {
        return Department::where('is_active', true)->orderBy('department_name')->get(['department_id', 'department_name', 'code']);
    }

    public function getDocumentTypes(): Collection
    {
        return DocumentType::where('is_active', true)->orderBy('type_name')->get(['type_id', 'type_name', 'arta_processing_days']);
    }
}

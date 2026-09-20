<?php

namespace App\Services\Document;

use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class DocumentRepository
{
    /**
     * Query documents scoped to user role and department.
     */
    public function getDocumentsForUser(User $user): Collection
    {
        $query = Document::with(['submitter', 'department', 'type', 'currentHolder', 'currentHolderDepartment']);

        $roleName = $user->role->role_name ?? '';
        if (!in_array($roleName, ['Admin', 'Mayor'])) {
            $query->where(function (Builder $q) use ($user) {
                if ($user->department_id) {
                    $q->where('current_holder_department_id', $user->department_id);
                }
                $q->orWhere('current_holder_id', $user->id)
                  ->orWhere('submitted_by', $user->id);
            });
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Find document by ID with full relations loaded.
     */
    public function findWithRelations(int $id): Document
    {
        return Document::with([
            'submitter',
            'department',
            'type',
            'currentHolder',
            'currentHolderDepartment',
            'routingSlips',
            'auditTrails.user',
            'signatures.signer',
            'attachments',
            'comments.user',
        ])->findOrFail($id);
    }
}

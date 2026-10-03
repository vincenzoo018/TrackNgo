<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Documents and Archived list pages of each role area (/admin, /receiving, /department-head, /mayor, /hr).
 */
class DocumentListController extends Controller
{
    private const LIST_RELATIONS = ['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'];

    public function admin(): Response
    {
        // Finished documents are included too: the list's "Archived" tab shows them
        $documents = Document::with(['submitter', 'department', 'type'])
            ->orderBy('reference_number', 'asc')
            ->get();

        return $this->renderList('admin/documents/Documents', $documents);
    }

    public function receiving(Request $request): Response
    {
        $documents = $this->whereInvolved(
            Document::with(self::LIST_RELATIONS)->whereNotIn(DB::raw('LOWER(status)'), ['completed', 'archived']),
            $request->user(),
            ownDepartment: false,
            alsoVisible: fn (Builder $query) => $query->orWhere('status', 'pending_registration')
                ->orWhere('status', 'approved'),
        )->get();

        return $this->renderList('receiving/documents/Documents', $documents);
    }

    public function departmentHead(Request $request): Response
    {
        $user = $request->user();
        $documents = $this->whereInvolved(
            Document::with(self::LIST_RELATIONS)
                // Powers the "Sent" tab: documents this Dept Head filed or forwarded that are now with someone else
                ->withExists(['routingSlips as forwarded_by_me' => fn ($q) => $q->where('from_user_id', $user->id)])
                // Finished documents stay in the list ("Completed" tab) for the people who handled them
                ->whereRaw("LOWER(status) <> 'archived'"),
            $user,
            ownDepartment: true,
        )->get();

        return $this->renderList('department-head/documents/Endorsements', $documents);
    }

    public function mayor(Request $request): Response
    {
        $documents = $this->whereInvolved(
            // Finished documents stay in the list ("Approved" tab) for the people who handled them
            Document::with(self::LIST_RELATIONS)->whereRaw("LOWER(status) <> 'archived'"),
            $request->user(),
            ownDepartment: false,
            // Every document at the Mayor's stage, while it is still being processed
            alsoVisible: fn (Builder $query) => $query->orWhere(fn ($stage) => $stage->whereIn('current_step_index', [4, 5, 6])
                ->whereRaw("LOWER(status) NOT IN ('completed', 'approved')")),
        )->get();

        return $this->renderList('mayor/documents/FinalApproval', $documents);
    }

    public function hr(Request $request): Response
    {
        $documents = $this->whereInvolved(
            // Finished documents stay in the list ("Completed" tab) for the people who handled them
            Document::with(self::LIST_RELATIONS)->whereRaw("LOWER(status) <> 'archived'"),
            $request->user(),
            ownDepartment: true,
        )->get();

        return $this->renderList('hr/documents/Documents', $documents);
    }

    /** Finished documents; $role is the archived page's role key (admin, receiving, department_head, mayor, hr). */
    public function archived(string $role): Response
    {
        $statuses = $role === 'department_head' ? ['completed', 'archived'] : ['approved', 'completed', 'archived'];

        $documents = Document::with(self::LIST_RELATIONS)
            ->whereIn(DB::raw('LOWER(status)'), $statuses)
            ->orderBy('completed_at', 'desc')
            ->orderBy('updated_at', 'desc')
            ->get();

        return Inertia::render('archived/Index', [
            'dbDocuments'     => $documents,
            'dbDepartments'   => $this->activeDepartments(),
            'dbDocumentTypes' => $this->activeDocumentTypes(),
            'role'            => $role,
        ]);
    }

    /**
     * Documents the user holds or filed, those $alsoVisible adds, those held by (and with $ownDepartment, owned by)
     * their department or routed through it, and any routed to them personally.
     */
    private function whereInvolved(Builder $documents, User $user, bool $ownDepartment, ?Closure $alsoVisible = null): Builder
    {
        return $documents
            ->where(function ($query) use ($user, $ownDepartment, $alsoVisible) {
                $query->where('current_holder_id', $user->id)
                      ->orWhere('submitted_by', $user->id);
                if ($alsoVisible) {
                    $alsoVisible($query);
                }
                if ($user->department_id) {
                    $query->orWhere('current_holder_department_id', $user->department_id);
                    if ($ownDepartment) {
                        $query->orWhere('department_id', $user->department_id);
                    }
                    $query->orWhereHas('routingSlips', function ($q) use ($user) {
                        $q->where('target_department_id', $user->department_id)
                          ->orWhere('from_department_id', $user->department_id)
                          ->orWhere('to_user_id', $user->id);
                    });
                }
                $query->orWhereHas('routingSlips', function ($q) use ($user) {
                    $q->where('to_user_id', $user->id);
                });
            })
            ->orderBy('reference_number', 'asc');
    }

    private function renderList(string $view, Collection $documents): Response
    {
        return Inertia::render($view, [
            'dbDocuments'     => $documents,
            'dbDepartments'   => $this->activeDepartments(),
            'dbDocumentTypes' => $this->activeDocumentTypes(),
            'dbUsers'         => User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                ->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')
                ->select('users.*', 'roles.role_name', 'departments.department_name')
                ->where('users.is_active', true)
                ->get(),
        ]);
    }

    private function activeDepartments(): Collection
    {
        return Department::where('is_active', true)->orderBy('department_name')->get();
    }

    private function activeDocumentTypes(): Collection
    {
        return DocumentType::where('is_active', true)->orderBy('type_name')->get();
    }
}

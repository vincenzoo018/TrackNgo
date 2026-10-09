<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\User;
use App\Services\Document\DocumentListQuery;
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
    public function __construct(
        protected DocumentListQuery $lists
    ) {}

    public function admin(): Response
    {
        return $this->renderList('admin/documents/Documents', $this->lists->admin()->get());
    }

    public function receiving(Request $request): Response
    {
        return $this->renderList('receiving/documents/Documents', $this->lists->receiving($request->user())->get());
    }

    public function departmentHead(Request $request): Response
    {
        return $this->renderList('department-head/documents/Endorsements', $this->lists->departmentHead($request->user())->get());
    }

    public function mayor(Request $request): Response
    {
        return $this->renderList('mayor/documents/FinalApproval', $this->lists->mayor($request->user())->get());
    }

    public function hr(Request $request): Response
    {
        return $this->renderList('hr/documents/Documents', $this->lists->hr($request->user())->get());
    }

    /** Finished documents; $role is the archived page's role key (admin, receiving, department_head, mayor, hr). */
    public function archived(string $role): Response
    {
        $statuses = $role === 'department_head' ? ['completed', 'archived', Document::STATUS_VETOED] : ['approved', 'completed', 'archived', Document::STATUS_VETOED];

        $documents = Document::with(DocumentListQuery::RELATIONS)
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
            // Blank forms offered in the filing form for the chosen document type
            'dbTemplates'     => \App\Models\DocumentTemplate::where('is_active', true)->orderBy('name')->get(['id', 'name', 'type_id', 'file_name']),
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

<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public Client Routes
Route::get('/', function () {
    return redirect()->route('login');
});

Route::get('/track', function () {
    return Inertia::render('client/TrackDocument');
})->name('track');

// Authenticated Role Routes
Route::middleware(['auth'])->group(function () {

    Route::post('/documents/{id}/export', [\App\Http\Controllers\DocumentController::class, 'export'])->name('documents.export');

    // Profile Routes
    Route::get('/profile', [\App\Http\Controllers\ProfileController::class, 'show'])->name('profile.show');
    Route::put('/profile', [\App\Http\Controllers\ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [\App\Http\Controllers\ProfileController::class, 'updatePassword'])->name('profile.password');

    // Admin Routes
    Route::prefix('admin')->middleware('role:Admin')->group(function () {
        Route::get('/', fn() => Inertia::render('admin/Dashboard'));
        Route::get('/documents', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('admin/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
            ]);
        });
        Route::get('/users/create', fn() => Inertia::render('admin/users/Create'));
        Route::get('/users', fn() => Inertia::render('admin/users/Index'));
        Route::get('/system', fn() => Inertia::render('admin/system/SystemConfiguration'));
        Route::get('/reports', fn() => Inertia::render('admin/reports/Index'));
        Route::get('/templates', fn() => Inertia::render('admin/templates/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('admin/routing-slips/RoutingSlips'));
    });

    // Receiving Routes
    Route::prefix('receiving')->middleware('role:Receiving Clerk')->group(function () {
        Route::get('/', fn() => Inertia::render('receiving/Dashboard'));
        Route::get('/documents', function () {
            $user = auth()->user();
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->where(function ($query) use ($user) {
                    if ($user->department_id) {
                        $query->where('current_holder_department_id', $user->department_id)
                              ->orWhereHas('routingSlips', function($q) use ($user) {
                                  $q->where('target_department_id', $user->department_id)
                                    ->orWhere('from_department_id', $user->department_id);
                              });
                    }
                    $query->orWhere('current_holder_id', $user->id)
                          ->orWhere('submitted_by', $user->id)
                          ->orWhere('status', 'pending_registration');
                })
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('receiving/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'dbUsers'         => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')
                    ->select('users.*', 'roles.role_name', 'departments.department_name')
                    ->where('users.is_active', true)
                    ->get(),
            ]);
        });
        // GET /documents/create removed - handled via modal in Index.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            
            // Hide contents if confidential
            if (strtolower($document->classification) === 'confidential') {
                $document->is_confidential_hidden = true;
                $document->ocr_text = null;
                $document->attachment_path = null;
            } else {
                $document->is_confidential_hidden = false;
            }

            return Inertia::render('receiving/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with('user')->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get()
            ]);
        });
        Route::get('/documents/{id}/versions', fn() => Inertia::render('receiving/documents/VersionHistory'));
        Route::get('/documents/{id}/arta-timeline', fn() => Inertia::render('receiving/documents/ArtaTimeline'));
        Route::get('/documents/{id}/ocr-workspace', fn() => Inertia::render('receiving/documents/OcrWorkspace'));
        Route::get('/documents/{id}/location-map', fn() => Inertia::render('receiving/documents/LocationMap'));
        
        // Document Actions
        Route::post('/documents/{id}/register', [\App\Http\Controllers\DocumentController::class, 'register']);
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/escalate', [\App\Http\Controllers\DocumentController::class, 'escalate']);
        Route::post('/documents/{id}/link', [\App\Http\Controllers\DocumentController::class, 'link']);
        Route::post('/documents/{id}/release', [\App\Http\Controllers\DocumentController::class, 'releaseToApplicant']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
        Route::get('/routing-slips', fn() => Inertia::render('receiving/routing-slips/RoutingSlips'));
        Route::get('/audit-trail', fn() => Inertia::render('receiving/audit-trail/AuditTrail'));
        Route::get('/reports', fn() => Inertia::render('receiving/reports/Index'));
    });

    // Department Head Routes
    Route::prefix('department-head')->middleware('role:Department Head')->group(function () {
        Route::get('/', fn() => Inertia::render('department-head/Dashboard'));
        Route::get('/documents', function () {
            $user = auth()->user();
            
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->where(function ($query) use ($user) {
                    if ($user->department_id) {
                        $query->where('current_holder_department_id', $user->department_id)
                              ->orWhereHas('routingSlips', function($q) use ($user) {
                                  $q->where('target_department_id', $user->department_id)
                                    ->orWhere('from_department_id', $user->department_id);
                              });
                    }
                    $query->orWhere('current_holder_id', $user->id)
                          ->orWhere('submitted_by', $user->id);
                })
                ->orderBy('reference_number', 'asc')
                ->get();
                
            return Inertia::render('department-head/documents/Endorsements', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'dbUsers'         => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')
                    ->select('users.*', 'roles.role_name', 'departments.department_name')
                    ->where('users.is_active', true)
                    ->get(),
            ]);
        });
        // GET /documents/create removed - handled via modal in Endorsements.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('department-head/documents/ReviewAndActions', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with('user')->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get()
            ]);
        });
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/accept', [\App\Http\Controllers\DocumentController::class, 'accept']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
        Route::get('/workflow', fn() => Inertia::render('department-head/workflow/Index'));
        Route::get('/signature', fn() => Inertia::render('department-head/signature/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('department-head/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('department-head/reports/Index'));
    });

    // Mayor Routes
    Route::prefix('mayor')->middleware('role:Mayor')->group(function () {
        Route::get('/', fn() => Inertia::render('mayor/Dashboard'));
        Route::get('/documents', function () {
            $user = auth()->user();
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->where(function ($query) use ($user) {
                    if ($user->department_id) {
                        $query->where('current_holder_department_id', $user->department_id)
                              ->orWhereHas('routingSlips', function($q) use ($user) {
                                  $q->where('target_department_id', $user->department_id)
                                    ->orWhere('from_department_id', $user->department_id);
                              });
                    }
                    $query->orWhere('current_holder_id', $user->id)
                          ->orWhere('submitted_by', $user->id);
                })
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('mayor/documents/FinalApproval', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'dbUsers'         => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')
                    ->select('users.*', 'roles.role_name', 'departments.department_name')
                    ->where('users.is_active', true)
                    ->get(),
            ]);
        });
        // GET /documents/create removed - handled via modal in FinalApproval.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('mayor/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with('user')->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get()
            ]);
        });
        Route::get('/signature', fn() => Inertia::render('mayor/signature/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('mayor/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('mayor/reports/Index'));
        
        // Document Actions
        Route::post('/documents/{id}/approve-route', [\App\Http\Controllers\DocumentController::class, 'approveAndRouteToReceiving']);
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/accept', [\App\Http\Controllers\DocumentController::class, 'accept']);
        Route::post('/documents/{id}/review', [\App\Http\Controllers\DocumentController::class, 'review']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
    });

    // CART Routes
    Route::prefix('cart')->middleware('role:CART')->group(function () {
        Route::get('/', fn() => Inertia::render('cart/Dashboard'));
        Route::get('/documents', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('cart/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
            ]);
        });
        Route::get('/documents/create', fn() => Inertia::render('cart/documents/Create'));
        Route::get('/escalations', fn() => Inertia::render('cart/escalations/ArtaEscalations'));
        Route::get('/escalations/documents', fn() => Inertia::render('cart/escalations/Documents'));
        Route::get('/escalations/documents/create', fn() => Inertia::render('cart/escalations/Create'));
        Route::get('/notifications/sms', fn() => Inertia::render('cart/notifications/SmsDashboard'));
        Route::get('/audit-trail', fn() => Inertia::render('cart/audit-trail/AuditTrail'));
        Route::get('/reports', fn() => Inertia::render('cart/reports/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('cart/routing-slips/RoutingSlips'));
        
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
    });

    // HR Routes
    Route::prefix('hr')->middleware('role:HR')->group(function () {
        Route::get('/', fn() => Inertia::render('hr/Dashboard'));
        Route::get('/documents', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('hr/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
            ]);
        });
        
        Route::get('/employees', [\App\Http\Controllers\HR\EmployeeController::class, 'index'])->name('hr.employees.index');
        Route::get('/employees/create', [\App\Http\Controllers\HR\EmployeeController::class, 'create'])->name('hr.employees.create');
        Route::post('/employees', [\App\Http\Controllers\HR\EmployeeController::class, 'store'])->name('hr.employees.store');
        Route::get('/employees/{employee}/edit', [\App\Http\Controllers\HR\EmployeeController::class, 'edit'])->name('hr.employees.edit');
        Route::put('/employees/{employee}', [\App\Http\Controllers\HR\EmployeeController::class, 'update'])->name('hr.employees.update');
        Route::delete('/employees/{employee}', [\App\Http\Controllers\HR\EmployeeController::class, 'destroy'])->name('hr.employees.destroy');
        
        Route::get('/departments', [\App\Http\Controllers\HR\DepartmentController::class, 'index'])->name('hr.departments.index');
        Route::post('/departments', [\App\Http\Controllers\HR\DepartmentController::class, 'store'])->name('hr.departments.store');
        Route::put('/departments/{department}', [\App\Http\Controllers\HR\DepartmentController::class, 'update'])->name('hr.departments.update');
        Route::delete('/departments/{department}', [\App\Http\Controllers\HR\DepartmentController::class, 'destroy'])->name('hr.departments.destroy');

        Route::get('/leave', fn() => Inertia::render('hr/leave/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('hr/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('hr/reports/Index'));
        
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
    });
});

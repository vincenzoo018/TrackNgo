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

    // Admin Routes
    Route::prefix('admin')->middleware('role:Admin')->group(function () {
        Route::get('/', fn() => Inertia::render('admin/Dashboard'));
        Route::get('/documents', fn() => Inertia::render('admin/documents/Documents'));
        Route::get('/documents/create', fn() => Inertia::render('admin/documents/Create'));
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
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->orderBy('created_at', 'desc')
                ->get();
            return Inertia::render('receiving/documents/Documents', [
                'dbDocuments' => $documents
            ]);
        });
        Route::get('/documents/create', function () {
            return Inertia::render('receiving/documents/Create', [
                'departments' => \App\Models\Department::all(),
                'document_types' => \App\Models\DocumentType::all(),
            ]);
        });
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('receiving/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with('user')->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', 'users.name as user_name', 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get()
            ]);
        });
        Route::get('/documents/{id}/versions', fn() => Inertia::render('receiving/documents/VersionHistory'));
        Route::get('/documents/{id}/arta-timeline', fn() => Inertia::render('receiving/documents/ArtaTimeline'));
        Route::get('/documents/{id}/ocr-workspace', fn() => Inertia::render('receiving/documents/OcrWorkspace'));
        Route::get('/documents/{id}/location-map', fn() => Inertia::render('receiving/documents/LocationMap'));
        
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/escalate', [\App\Http\Controllers\DocumentController::class, 'escalate']);
        Route::post('/documents/{id}/link', [\App\Http\Controllers\DocumentController::class, 'link']);
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
            // Find the department headed by the current user
            $user = auth()->user();
            $department = \App\Models\Department::where('head_id', $user->id)->first();
            $departmentId = $department ? $department->department_id : null;
            
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->where(function ($query) use ($departmentId, $user) {
                    if ($departmentId) {
                        $query->where('current_holder_department_id', $departmentId);
                    }
                    $query->orWhere('current_holder_id', $user->id);
                })
                ->orderBy('created_at', 'desc')
                ->get();
                
            return Inertia::render('department-head/documents/Endorsements', [
                'dbDocuments' => $documents,
                'departments' => \App\Models\Department::all(),
                'document_types' => \App\Models\DocumentType::all(),
            ]);
        });
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
                    ->select('document_comments.*', 'users.name as user_name', 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get()
            ]);
        });
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
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
        Route::get('/documents', fn() => Inertia::render('mayor/documents/FinalApproval'));
        Route::get('/documents/{id}', fn() => Inertia::render('mayor/documents/Show'));
        Route::get('/signature', fn() => Inertia::render('mayor/signature/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('mayor/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('mayor/reports/Index'));
    });

    // CART Routes
    Route::prefix('cart')->middleware('role:CART')->group(function () {
        Route::get('/', fn() => Inertia::render('cart/Dashboard'));
        Route::get('/documents', fn() => Inertia::render('cart/documents/Documents'));
        Route::get('/documents/create', fn() => Inertia::render('cart/documents/Create'));
        Route::get('/escalations', fn() => Inertia::render('cart/escalations/ArtaEscalations'));
        Route::get('/escalations/documents', fn() => Inertia::render('cart/escalations/Documents'));
        Route::get('/escalations/documents/create', fn() => Inertia::render('cart/escalations/Create'));
        Route::get('/notifications/sms', fn() => Inertia::render('cart/notifications/SmsDashboard'));
        Route::get('/audit-trail', fn() => Inertia::render('cart/audit-trail/AuditTrail'));
        Route::get('/reports', fn() => Inertia::render('cart/reports/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('cart/routing-slips/RoutingSlips'));
    });

    // HR Routes
    Route::prefix('hr')->middleware('role:HR')->group(function () {
        Route::get('/', fn() => Inertia::render('hr/Dashboard'));
        Route::get('/documents', fn() => Inertia::render('hr/documents/Documents'));
        Route::get('/employees', fn() => Inertia::render('hr/employees/Index'));
        Route::get('/leave', fn() => Inertia::render('hr/leave/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('hr/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('hr/reports/Index'));
    });
});

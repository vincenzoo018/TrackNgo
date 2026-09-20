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

    Route::post('/documents/{id}/attachments', [\App\Http\Controllers\DocumentController::class, 'addAttachment'])->name('documents.attachments');
    Route::post('/documents/{id}/export', [\App\Http\Controllers\DocumentController::class, 'export'])->name('documents.export');
    Route::post('/documents/{id}/log-action', [\App\Http\Controllers\DocumentController::class, 'logAction'])->name('documents.logAction');
    Route::post('/documents/{id}/return', [\App\Http\Controllers\DocumentController::class, 'returnDocument'])->name('documents.return');
    Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive'])->name('documents.receive');
    Route::post('/documents/{id}/review', [\App\Http\Controllers\DocumentController::class, 'review'])->name('documents.review');
    Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse'])->name('documents.endorse');
    Route::post('/documents/{id}/archive', [\App\Http\Controllers\DocumentController::class, 'archiveDocument'])->name('documents.archive');
    Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment'])->name('documents.comments');
    Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments'])->name('documents.getComments');
    Route::get('/documents/{id}/timeline-sync', [\App\Http\Controllers\DocumentController::class, 'getTimelineSync'])->name('documents.timelineSync');
    Route::get('/documents/{id}/ocr-workspace', function($id) {
        $document = \App\Models\Document::find($id);
        return Inertia::render('receiving/documents/OcrWorkspace', [
            'dbDocument' => $document,
            'documentId' => $id,
        ]);
    })->name('documents.ocrWorkspace');

    // Universal Document Details Route (Redirects to role-specific document view with FSM)
    Route::get('/documents/{id}', function ($id) {
        $user = auth()->user();
        $role = strtolower($user->role->role_name ?? '');
        $prefix = match($role) {
            'admin' => 'admin',
            'mayor' => 'mayor',
            'department head', 'department_head' => 'department-head',
            'cart' => 'cart',
            'hr' => 'hr',
            default => 'receiving',
        };
        return redirect("/{$prefix}/documents/{$id}");
    })->name('documents.show');

    // Real-Time Notification API Routes
    Route::get('/api/notifications', [\App\Http\Controllers\NotificationController::class, 'index'])->name('api.notifications');
    Route::post('/api/notifications/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead'])->name('api.notifications.read');
    Route::post('/api/notifications/mark-all-read', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead'])->name('api.notifications.markAllRead');
    Route::post('/api/notifications/log-toast', [\App\Http\Controllers\NotificationController::class, 'logToastTriggered'])->name('api.notifications.logToast');

    // Profile Routes
    Route::get('/profile', [\App\Http\Controllers\ProfileController::class, 'show'])->name('profile.show');
    Route::put('/profile', [\App\Http\Controllers\ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [\App\Http\Controllers\ProfileController::class, 'updatePassword'])->name('profile.password');

    // Admin Routes
    Route::prefix('admin')->middleware('role:Admin')->group(function () {
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('admin/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
            ]);
        });
        Route::get('/archived', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('completed_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->get();
            return Inertia::render('archived/Index', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'role'            => 'admin',
            ]);
        });
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('receiving/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'dbAttachments' => \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get(),
            ]);
        });
        // User Accounts Management (Full CRUD & Role Override)
        Route::get('/users', [\App\Http\Controllers\Admin\UserController::class, 'index'])->name('admin.users.index');
        Route::get('/users/create', [\App\Http\Controllers\Admin\UserController::class, 'create'])->name('admin.users.create');
        Route::post('/users', [\App\Http\Controllers\Admin\UserController::class, 'store'])->name('admin.users.store');
        Route::put('/users/{id}', [\App\Http\Controllers\Admin\UserController::class, 'update'])->name('admin.users.update');
        Route::delete('/users/{id}', [\App\Http\Controllers\Admin\UserController::class, 'destroy'])->name('admin.users.destroy');
        Route::post('/users/{id}/override-role', [\App\Http\Controllers\Admin\UserController::class, 'overrideRole'])->name('admin.users.overrideRole');

        // Document Management CRUD & Admin Overrides
        Route::delete('/documents/{id}', function ($id) {
            $doc = \App\Models\Document::findOrFail($id);
            $ref = $doc->reference_number;
            \App\Models\AuditTrail::create([
                'user_id' => auth()->id(),
                'user_role' => auth()->user()->role->role_name ?? 'Admin',
                'department' => auth()->user()->department->department_name ?? null,
                'action' => 'Delete Document',
                'description' => "Admin permanently deleted document {$ref}",
                'ip_address' => request()->ip(),
                'timestamp' => now(),
            ]);
            $doc->delete();
            return redirect()->back()->with('success', "Document {$ref} permanently deleted.");
        });
        Route::post('/documents/{id}/override', function (\Illuminate\Http\Request $request, $id) {
            $doc = \App\Models\Document::findOrFail($id);
            $validated = $request->validate([
                'status' => 'nullable|string',
                'current_holder_department_id' => 'nullable|exists:departments,department_id',
                'current_holder_id' => 'nullable|exists:users,id',
            ]);
            $doc->update(array_filter($validated));
            \App\Models\AuditTrail::create([
                'document_id' => $doc->document_id,
                'document_ref' => $doc->reference_number,
                'user_id' => auth()->id(),
                'user_role' => auth()->user()->role->role_name ?? 'Admin',
                'department' => auth()->user()->department->department_name ?? null,
                'action' => 'Admin Override',
                'description' => "Admin overrode document status/holder for {$doc->reference_number}",
                'ip_address' => $request->ip(),
                'timestamp' => now(),
            ]);
            return redirect()->back()->with('success', "Document {$doc->reference_number} overridden successfully.");
        });

        Route::get('/system', fn() => Inertia::render('admin/system/SystemConfiguration'));
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
        Route::get('/compliance-reports', [\App\Http\Controllers\ReportController::class, 'index']);
        Route::get('/notifications/sms', fn() => Inertia::render('cart/notifications/SmsDashboard'));
        Route::get('/templates', fn() => Inertia::render('admin/templates/Index'));
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/escalations', [\App\Http\Controllers\CartEscalationController::class, 'index']);
        Route::post('/escalations/{id}/resolve', [\App\Http\Controllers\CartEscalationController::class, 'resolve']);
    });

    // Receiving Routes
    Route::prefix('receiving')->middleware('role:Receiving Clerk')->group(function () {
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', function () {
            $user = auth()->user();
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
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
        Route::get('/archived', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('completed_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->get();
            return Inertia::render('archived/Index', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'role'            => 'receiving',
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
                'dbAuditTrail' => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'dbAttachments' => \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get(),
            ]);
        });
        Route::get('/documents/{id}/versions', fn() => Inertia::render('receiving/documents/VersionHistory'));
        Route::get('/documents/{id}/arta-timeline', fn() => Inertia::render('receiving/documents/ArtaTimeline'));
        Route::get('/documents/{id}/ocr-workspace', function($id) {
            $document = \App\Models\Document::find($id);
            return Inertia::render('receiving/documents/OcrWorkspace', [
                'dbDocument' => $document,
                'documentId' => $id,
            ]);
        });
        Route::get('/documents/{id}/location-map', fn() => Inertia::render('receiving/documents/LocationMap'));
        
        // Document Actions
        Route::post('/documents/{id}/register', [\App\Http\Controllers\DocumentController::class, 'register']);
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/escalate', [\App\Http\Controllers\DocumentController::class, 'escalate']);
        Route::post('/documents/{id}/link', [\App\Http\Controllers\DocumentController::class, 'link']);
        Route::post('/documents/{id}/release', [\App\Http\Controllers\DocumentController::class, 'releaseToApplicant']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
    });

    // Department Head Routes
    Route::prefix('department-head')->middleware('role:Department Head')->group(function () {
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', function () {
            $user = auth()->user();
            
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
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
        Route::get('/archived', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('completed_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->get();
            return Inertia::render('archived/Index', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'role'            => 'department_head',
            ]);
        });
        // GET /documents/create removed - handled via modal in Endorsements.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('department-head/documents/ReviewAndActions', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'dbAttachments' => \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get(),
            ]);
        });
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/accept', [\App\Http\Controllers\DocumentController::class, 'accept']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
    });

    // Mayor Routes
    Route::prefix('mayor')->middleware('role:Mayor')->group(function () {
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', function () {
            $user = auth()->user();
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
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
        Route::get('/archived', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('completed_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->get();
            return Inertia::render('archived/Index', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'role'            => 'mayor',
            ]);
        });
        // GET /documents/create removed - handled via modal in FinalApproval.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('mayor/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'dbAttachments' => \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get(),
            ]);
        });
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
        
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
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('cart/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
            ]);
        });
        Route::get('/archived', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('completed_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->get();
            return Inertia::render('archived/Index', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'role'            => 'cart',
            ]);
        });
        Route::get('/documents/create', fn() => Inertia::render('cart/documents/Create'));
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('receiving/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'dbAttachments' => \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get(),
            ]);
        });
        Route::get('/escalations', [\App\Http\Controllers\CartEscalationController::class, 'index']);
        Route::get('/escalations/documents', [\App\Http\Controllers\CartEscalationController::class, 'index']);
        Route::post('/escalations/{id}/resolve', [\App\Http\Controllers\CartEscalationController::class, 'resolve']);
        Route::get('/notifications/sms', fn() => Inertia::render('cart/notifications/SmsDashboard'));
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
    });

    // HR Routes
    Route::prefix('hr')->middleware('role:HR')->group(function () {
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type'])
                ->whereNotIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('reference_number', 'asc')
                ->get();
            return Inertia::render('hr/documents/Documents', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
            ]);
        });
        Route::get('/archived', function () {
            $documents = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])
                ->whereIn(\Illuminate\Support\Facades\DB::raw('LOWER(status)'), ['approved', 'completed', 'archived'])
                ->orderBy('completed_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->get();
            return Inertia::render('archived/Index', [
                'dbDocuments'     => $documents,
                'dbDepartments'   => \App\Models\Department::where('is_active', true)->orderBy('department_name')->get(),
                'dbDocumentTypes' => \App\Models\DocumentType::where('is_active', true)->orderBy('type_name')->get(),
                'role'            => 'hr',
            ]);
        });
        Route::get('/documents/{id}', function ($id) {
            $document = \App\Models\Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment'])->findOrFail($id);
            return Inertia::render('receiving/documents/Show', [
                'dbDocument' => $document,
                'dbAuditTrail' => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
                'dbDepartments' => \App\Models\Department::all(),
                'dbUsers' => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')->select('users.*', 'roles.role_name', 'departments.department_name')->get(),
                'dbComments' => \Illuminate\Support\Facades\DB::table('document_comments')
                    ->where('document_id', $id)
                    ->join('users', 'document_comments.user_id', '=', 'users.id')
                    ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                    ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'dbAttachments' => \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get(),
            ]);
        });
        
        Route::get('/employees', [\App\Http\Controllers\HR\EmployeeController::class, 'index'])->name('hr.employees.index');
        Route::get('/employees/create', [\App\Http\Controllers\HR\EmployeeController::class, 'create'])->name('hr.employees.create');
        Route::post('/employees', [\App\Http\Controllers\HR\EmployeeController::class, 'store'])->name('hr.employees.store');
        Route::get('/employees/{employee}/edit', [\App\Http\Controllers\HR\EmployeeController::class, 'edit'])->name('hr.employees.edit');
        Route::put('/employees/{employee}', [\App\Http\Controllers\HR\EmployeeController::class, 'update'])->name('hr.employees.update');
        Route::delete('/employees/{employee}', [\App\Http\Controllers\HR\EmployeeController::class, 'destroy'])->name('hr.employees.destroy');
        
        // User Accounts Management (HR Override employee info & department assignments)
        Route::get('/users', [\App\Http\Controllers\Admin\UserController::class, 'index'])->name('hr.users.index');
        Route::put('/users/{id}', [\App\Http\Controllers\Admin\UserController::class, 'update'])->name('hr.users.update');
        Route::post('/users/{id}/override-role', [\App\Http\Controllers\Admin\UserController::class, 'overrideRole'])->name('hr.users.overrideRole');
        
        Route::get('/departments', [\App\Http\Controllers\HR\DepartmentController::class, 'index'])->name('hr.departments.index');
        Route::post('/departments', [\App\Http\Controllers\HR\DepartmentController::class, 'store'])->name('hr.departments.store');
        Route::put('/departments/{department}', [\App\Http\Controllers\HR\DepartmentController::class, 'update'])->name('hr.departments.update');
        Route::delete('/departments/{department}', [\App\Http\Controllers\HR\DepartmentController::class, 'destroy'])->name('hr.departments.destroy');

        Route::get('/leave', fn() => Inertia::render('hr/leave/Index'));
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
        
        // Document Actions
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse']);
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive']);
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
    });
});

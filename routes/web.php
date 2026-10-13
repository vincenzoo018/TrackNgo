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

// Public lookups are limited so the tracking numbers cannot be enumerated
Route::get('/api/track/{trackingNumber}', [\App\Http\Controllers\DocumentController::class, 'trackPublicDocument'])
    ->middleware('throttle:30,1')
    ->name('track.public');

// Authenticated Role Routes
Route::middleware(['auth', 'active'])->group(function () {

    // Filing and processing documents: CART only monitors, so it is kept out of every write below
    Route::middleware('not-role:CART')->group(function () {
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store'])->name('documents.store');
        Route::post('/documents/{id}/attachments', [\App\Http\Controllers\DocumentController::class, 'addAttachment'])->name('documents.attachments');
        Route::post('/documents/{id}/export', [\App\Http\Controllers\DocumentController::class, 'export'])->name('documents.export');
        Route::post('/documents/{id}/log-action', [\App\Http\Controllers\DocumentController::class, 'logAction'])->name('documents.logAction');
        Route::post('/documents/{id}/return', [\App\Http\Controllers\DocumentController::class, 'returnDocument'])->name('documents.return');
        // Returned document: holder uploads the missing / corrected files and it goes back to whoever returned it
        Route::post('/documents/{id}/resubmit', [\App\Http\Controllers\DocumentController::class, 'resubmit'])->name('documents.resubmit');
        Route::post('/documents/{id}/accept', [\App\Http\Controllers\DocumentController::class, 'accept'])->name('documents.accept');
        Route::post('/documents/{id}/receive', [\App\Http\Controllers\DocumentController::class, 'receive'])->name('documents.receive');
        Route::post('/documents/{id}/review', [\App\Http\Controllers\DocumentController::class, 'review'])->name('documents.review');
        Route::post('/documents/{id}/endorse', [\App\Http\Controllers\DocumentController::class, 'endorse'])->name('documents.endorse');
        Route::post('/documents/{id}/escalate', [\App\Http\Controllers\DocumentController::class, 'escalate'])->name('documents.escalate');
        Route::post('/documents/{id}/link', [\App\Http\Controllers\DocumentController::class, 'link'])->name('documents.link');
        Route::post('/documents/{id}/release', [\App\Http\Controllers\DocumentController::class, 'releaseToApplicant'])->name('documents.release');
        // Final internal step: current holder forwards the reviewed document to the Receiving Clerk (holder-guarded in DocumentService)
        Route::post('/documents/{id}/approve-route', [\App\Http\Controllers\DocumentController::class, 'approveAndRouteToReceiving'])->name('documents.approveRoute');
        // Route-based documents: approve and pass to the next person on the route chosen at filing
        Route::post('/documents/{id}/approve-next', [\App\Http\Controllers\DocumentController::class, 'approveOnRoute'])->name('documents.approveNext');
        Route::post('/documents/{id}/archive', [\App\Http\Controllers\DocumentController::class, 'archiveDocument'])->name('documents.archive');
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment'])->name('documents.comments');
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments'])->name('documents.getComments');
        Route::get('/documents/{id}/timeline-sync', [\App\Http\Controllers\DocumentController::class, 'getTimelineSync'])->name('documents.timelineSync');

        // Digital signatures are stamped automatically when each signatory forwards / approves; once all have
        // signed, the copy with every signature stamped on it is attached to the document
        Route::post('/documents/{id}/signed-copy', [\App\Http\Controllers\SignatureController::class, 'storeSignedCopy'])->name('documents.signedCopy');
        // Text read from the document file by OCR in the browser (upload, or "Scan Text" in the viewer)
        Route::post('/documents/{id}/ocr-text', [\App\Http\Controllers\DocumentController::class, 'saveOcrText'])->name('documents.ocrText');

        // Edit Metadata and new versions of the main file; who may is checked by App\Policies\DocumentPolicy
        // (config/document_permissions.php) on every request
        Route::put('/documents/{id}/metadata', [\App\Http\Controllers\DocumentMetadataController::class, 'update'])->name('documents.metadata');
        Route::post('/documents/{id}/revisions', [\App\Http\Controllers\DocumentRevisionController::class, 'store'])->name('documents.revisions.store');

        // RA 11032 Sec. 9(b): the one extension of the processing period, by the office processing it
        Route::post('/documents/{id}/extend', [\App\Http\Controllers\DocumentComplianceController::class, 'extend'])->whereNumber('id')->name('documents.extend');
        // LGC Sec. 54: the Mayor (or the Acting Mayor) vetoes an ordinance / resolution, stating the reasons
        Route::post('/documents/{id}/veto', [\App\Http\Controllers\DocumentComplianceController::class, 'veto'])->whereNumber('id')->name('documents.veto');

        // Where the paper original is kept: the holder of an internal document records it from the document page
        Route::post('/documents/{id}/physical-location', [\App\Http\Controllers\Receiving\DocumentLookupController::class, 'storePhysicalLocation'])->whereNumber('id')->name('documents.physicalLocation');
    });

    // Document files are private: shown only to the people who may open the document
    Route::get('/documents/{id}/files/{kind}/{name}', [\App\Http\Controllers\DocumentFileController::class, 'show'])
        ->whereNumber('id')->whereIn('kind', ['main', 'signed'])->name('documents.files');
    Route::get('/documents/{id}/files/{kind}/{fileId}/{name}', [\App\Http\Controllers\DocumentFileController::class, 'item'])
        ->whereNumber('id')->whereNumber('fileId')->whereIn('kind', ['attachment', 'revision', 'revision-signed'])->name('documents.files.item');

    // Written notice of the extension (printable / PDF), for the people handling the document
    Route::get('/documents/{id}/extension-notice', [\App\Http\Controllers\DocumentComplianceController::class, 'notice'])->whereNumber('id')->name('documents.extensionNotice');
    // Blank forms / templates offered when filing a document of their type
    Route::get('/templates/{id}/download', [\App\Http\Controllers\Admin\DocumentTemplateController::class, 'download'])->whereNumber('id')->name('templates.download');

    // Philippine address lookup (PSA PSGC) for the client address dropdowns
    Route::get('/locations/provinces', [\App\Http\Controllers\LocationController::class, 'provinces'])->name('locations.provinces');
    Route::get('/locations/provinces/{code}/cities', [\App\Http\Controllers\LocationController::class, 'cities'])->name('locations.cities');
    Route::get('/locations/cities/{code}/barangays', [\App\Http\Controllers\LocationController::class, 'barangays'])->name('locations.barangays');
    Route::get('/documents/{id}/ocr-workspace', [\App\Http\Controllers\DocumentController::class, 'ocrWorkspace'])->name('documents.ocrWorkspace');

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

    // Live updates: one light "what changed?" check every 15 s from open pages (no per-page polling)
    Route::get('/api/changes', [\App\Http\Controllers\LiveUpdateController::class, 'changes'])->name('api.changes');

    // Real-Time Notification API Routes
    Route::get('/api/notifications', [\App\Http\Controllers\NotificationController::class, 'index'])->name('api.notifications');
    Route::post('/api/notifications/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead'])->name('api.notifications.read');
    Route::post('/api/notifications/mark-all-read', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead'])->name('api.notifications.markAllRead');
    Route::post('/api/notifications/log-toast', [\App\Http\Controllers\NotificationController::class, 'logToastTriggered'])->name('api.notifications.logToast');

    // Profile Routes
    Route::get('/profile', [\App\Http\Controllers\ProfileController::class, 'show'])->name('profile.show');
    Route::put('/profile', [\App\Http\Controllers\ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [\App\Http\Controllers\ProfileController::class, 'updatePassword'])->name('profile.password');
    // Document PIN asked before downloads / exports
    Route::put('/profile/document-pin', [\App\Http\Controllers\ProfileController::class, 'updateDocumentPin'])->name('profile.documentPin');

    // Pages every processing role (Admin, Receiving, Department Head, Mayor, HR) has under its own prefix:
    // dashboard, its document list (DocumentListController::$listAction), archive, document page and modules
    $rolePages = function (string $listAction, string $archiveRole, string $documentView) {
        Route::get('/', [\App\Http\Controllers\DashboardController::class, 'index']);
        Route::get('/documents', [\App\Http\Controllers\DocumentListController::class, $listAction]);
        Route::get('/archived', [\App\Http\Controllers\DocumentListController::class, 'archived'])->defaults('role', $archiveRole);
        Route::get('/documents/{id}', [\App\Http\Controllers\DocumentController::class, 'page'])->defaults('view', $documentView);
        Route::get('/documents/{id}/versions', [\App\Http\Controllers\DocumentRevisionController::class, 'index']);
        Route::get('/routing-slips', [\App\Http\Controllers\RoutingSlipController::class, 'index']);
        Route::get('/audit-trail', [\App\Http\Controllers\AuditTrailController::class, 'index']);
        Route::get('/qr', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/qr-codes', [\App\Http\Controllers\QrCodeController::class, 'index']);
        Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
    };

    // Workflow actions a role can post from its document page (uri => DocumentController method),
    // plus the page's discussion thread
    $documentActions = function (array $actions) {
        foreach ($actions as $uri => $method) {
            Route::post("/documents/{id}/{$uri}", [\App\Http\Controllers\DocumentController::class, $method]);
        }
        Route::post('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'addComment']);
        Route::get('/documents/{id}/comments', [\App\Http\Controllers\DocumentController::class, 'getComments']);
    };

    // Admin Routes
    Route::prefix('admin')->middleware('role:Admin')->group(function () use ($rolePages) {
        $rolePages('admin', 'admin', 'receiving/documents/Show');
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

        // System Configuration: document types (Citizen's Charter category / days) and the Holiday Calendar
        Route::get('/system', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'index']);
        Route::post('/system/types', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'storeType']);
        Route::put('/system/types/{id}', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'updateType'])->whereNumber('id');
        Route::post('/system/holidays', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'storeHoliday']);
        Route::post('/system/holidays/national', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'loadNationalHolidays']);
        Route::put('/system/holidays/{id}', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'updateHoliday'])->whereNumber('id');
        Route::delete('/system/holidays/{id}', [\App\Http\Controllers\Admin\SystemConfigurationController::class, 'destroyHoliday'])->whereNumber('id');

        // User Accounts → OIC Designations (LGC Sec. 46)
        Route::get('/oic', [\App\Http\Controllers\Admin\OicDesignationController::class, 'index']);
        Route::post('/oic', [\App\Http\Controllers\Admin\OicDesignationController::class, 'store']);
        Route::post('/oic/{id}/end', [\App\Http\Controllers\Admin\OicDesignationController::class, 'end'])->whereNumber('id');

        // Deemed-approval check on demand (it also runs every five minutes from the scheduler)
        Route::post('/deemed-approvals/run', [\App\Http\Controllers\DocumentComplianceController::class, 'runDeemedApprovals']);

        Route::get('/compliance-reports', [\App\Http\Controllers\ReportController::class, 'index']);
        Route::get('/notifications/sms', [\App\Http\Controllers\Admin\SmsDashboardController::class, 'index']);
        Route::get('/templates', [\App\Http\Controllers\Admin\DocumentTemplateController::class, 'index']);
        Route::post('/templates', [\App\Http\Controllers\Admin\DocumentTemplateController::class, 'store']);
        // POST (not PUT) so a replacement file can be uploaded
        Route::post('/templates/{id}', [\App\Http\Controllers\Admin\DocumentTemplateController::class, 'update'])->whereNumber('id');
        Route::delete('/templates/{id}', [\App\Http\Controllers\Admin\DocumentTemplateController::class, 'destroy'])->whereNumber('id');
        Route::get('/escalations', [\App\Http\Controllers\CartEscalationController::class, 'index']);
        Route::post('/escalations/{id}/resolve', [\App\Http\Controllers\CartEscalationController::class, 'resolve']);
    });

    // Receiving Routes
    Route::prefix('receiving')->middleware('role:Receiving Clerk')->group(function () use ($rolePages, $documentActions) {
        $rolePages('receiving', 'receiving', 'receiving/documents/Show');
        // GET /documents/create removed - handled via modal in Index.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        // ARTA Timeline and Location Map of any document: from its page, or found by tracking / reference number
        Route::get('/arta-timeline', [\App\Http\Controllers\Receiving\DocumentLookupController::class, 'search'])->defaults('page', 'arta-timeline');
        Route::get('/location-map', [\App\Http\Controllers\Receiving\DocumentLookupController::class, 'search'])->defaults('page', 'location-map');
        Route::get('/documents/{id}/arta-timeline', [\App\Http\Controllers\Receiving\DocumentLookupController::class, 'artaTimeline'])->whereNumber('id');
        Route::get('/documents/{id}/ocr-workspace', [\App\Http\Controllers\DocumentController::class, 'ocrWorkspace']);
        Route::get('/documents/{id}/location-map', [\App\Http\Controllers\Receiving\DocumentLookupController::class, 'locationMap'])->whereNumber('id');
        Route::post('/documents/{id}/physical-location', [\App\Http\Controllers\Receiving\DocumentLookupController::class, 'storePhysicalLocation'])->whereNumber('id');

        // Document Actions
        $documentActions([
            'endorse'  => 'endorse',
            'escalate' => 'escalate',
            'link'     => 'link',
            'release'  => 'releaseToApplicant',
        ]);
    });

    // Department Head Routes
    Route::prefix('department-head')->middleware('role:Department Head')->group(function () use ($rolePages, $documentActions) {
        $rolePages('departmentHead', 'department_head', 'department-head/documents/ReviewAndActions');
        // GET /documents/create removed - handled via modal in Endorsements.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);
        // Document Actions
        $documentActions([
            'endorse'       => 'endorse',
            'receive'       => 'receive',
            'accept'        => 'accept',
            'review'        => 'review',
            // Mayor-origin internal step 6: Dept Head forwards the reviewed document to the Receiving Clerk
            'approve-route' => 'approveAndRouteToReceiving',
            'escalate'      => 'escalate',
            'link'          => 'link',
        ]);
    });

    // Mayor Routes
    Route::prefix('mayor')->middleware('role:Mayor')->group(function () use ($rolePages, $documentActions) {
        $rolePages('mayor', 'mayor', 'mayor/documents/Show');
        // GET /documents/create removed - handled via modal in FinalApproval.tsx
        Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']);

        // Document Actions
        $documentActions([
            'approve-route' => 'approveAndRouteToReceiving',
            'endorse'       => 'endorse',
            'receive'       => 'receive',
            'accept'        => 'accept',
            'review'        => 'review',
        ]);
    });

    // CART Routes — a read-only monitoring layer over the workflow (never a processing step)
    Route::prefix('cart')->middleware('role:CART')->group(function () {
        Route::get('/', [\App\Http\Controllers\Cart\DashboardController::class, 'index']);

        Route::get('/monitoring', [\App\Http\Controllers\Cart\MonitoringController::class, 'index']);
        Route::get('/monitoring/{id}', [\App\Http\Controllers\Cart\MonitoringController::class, 'show'])->whereNumber('id');
        // /documents/{id} (any role) lands here for CART
        Route::get('/documents/{id}', fn (int $id) => redirect("/cart/monitoring/{$id}"))->whereNumber('id');
        Route::post('/documents/{id}/follow-up', [\App\Http\Controllers\Cart\MonitoringController::class, 'followUp'])->whereNumber('id');

        Route::get('/escalations', [\App\Http\Controllers\Cart\EscalationController::class, 'index']);
        Route::post('/escalations/{id}/resolve', [\App\Http\Controllers\Cart\EscalationController::class, 'resolve'])->whereNumber('id');

        Route::get('/alerts', [\App\Http\Controllers\Cart\AlertController::class, 'index']);
        Route::post('/alerts/read-all', [\App\Http\Controllers\Cart\AlertController::class, 'readAll']);
        Route::post('/alerts/{id}/read', [\App\Http\Controllers\Cart\AlertController::class, 'read'])->whereNumber('id');

        Route::get('/audit-trail', [\App\Http\Controllers\Cart\AuditTrailController::class, 'index']);

        Route::get('/reports', [\App\Http\Controllers\Cart\ReportController::class, 'index']);
        Route::get('/reports/export', [\App\Http\Controllers\Cart\ReportController::class, 'export']);

        Route::get('/search', [\App\Http\Controllers\Cart\SearchController::class, 'index']);

        // Earlier CART addresses (bookmarks, old notifications)
        Route::redirect('/documents', '/cart/monitoring');
        Route::redirect('/archived', '/cart/monitoring?view=completed');
    });

    // HR Routes
    Route::prefix('hr')->middleware('role:HR')->group(function () use ($rolePages, $documentActions) {
        $rolePages('hr', 'hr', 'receiving/documents/Show');

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

        // Leave Management (approving a head's leave can designate the Officer-in-Charge)
        Route::get('/leave', [\App\Http\Controllers\HR\LeaveController::class, 'index']);
        Route::post('/leave', [\App\Http\Controllers\HR\LeaveController::class, 'store']);
        Route::post('/leave/{id}/approve', [\App\Http\Controllers\HR\LeaveController::class, 'approve'])->whereNumber('id');
        Route::post('/leave/{id}/reject', [\App\Http\Controllers\HR\LeaveController::class, 'reject'])->whereNumber('id');
        Route::post('/leave/{id}/cancel', [\App\Http\Controllers\HR\LeaveController::class, 'cancel'])->whereNumber('id');

        // Document Actions
        $documentActions([
            'endorse' => 'endorse',
            'receive' => 'receive',
        ]);
    });
});

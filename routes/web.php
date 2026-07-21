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

// Mock Authentication Routes
Route::middleware(['web'])->group(function () {
    Route::get('/login', function () {
        return Inertia::render('auth/login');
    })->name('login');
    
    Route::post('/login', function () {
        return redirect('/receiving');
    });
    
    Route::post('/logout', function () {
        return redirect('/login');
    })->name('logout');
});

// Authenticated Role Routes (Mocked)
Route::middleware(['web'])->group(function () {
    
    // Admin Routes
    Route::prefix('admin')->group(function () {
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
    Route::prefix('receiving')->group(function () {
        Route::get('/', fn() => Inertia::render('receiving/Dashboard'));
        Route::get('/documents', fn() => Inertia::render('receiving/documents/Documents'));
        Route::get('/documents/create', fn() => Inertia::render('receiving/documents/Create'));
        Route::get('/documents/{id}', fn() => Inertia::render('receiving/documents/Show'));
        Route::get('/documents/{id}/versions', fn() => Inertia::render('receiving/documents/VersionHistory'));
        Route::get('/documents/{id}/arta-timeline', fn() => Inertia::render('receiving/documents/ArtaTimeline'));
        Route::get('/documents/{id}/ocr-workspace', fn() => Inertia::render('receiving/documents/OcrWorkspace'));
        Route::get('/documents/{id}/location-map', fn() => Inertia::render('receiving/documents/LocationMap'));
        Route::get('/routing-slips', fn() => Inertia::render('receiving/routing-slips/RoutingSlips'));
        Route::get('/audit-trail', fn() => Inertia::render('receiving/audit-trail/AuditTrail'));
        Route::get('/reports', fn() => Inertia::render('receiving/reports/Index'));
    });

    // Department Head Routes
    Route::prefix('department-head')->group(function () {
        Route::get('/', fn() => Inertia::render('department-head/Dashboard'));
        Route::get('/documents', fn() => Inertia::render('department-head/documents/Endorsements'));
        Route::get('/documents/{id}', fn() => Inertia::render('department-head/documents/ReviewAndActions'));
        Route::get('/workflow', fn() => Inertia::render('department-head/workflow/Index'));
        Route::get('/signature', fn() => Inertia::render('department-head/signature/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('department-head/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('department-head/reports/Index'));
    });

    // Mayor Routes
    Route::prefix('mayor')->group(function () {
        Route::get('/', fn() => Inertia::render('mayor/Dashboard'));
        Route::get('/documents', fn() => Inertia::render('mayor/documents/FinalApproval'));
        Route::get('/documents/{id}', fn() => Inertia::render('mayor/documents/Show'));
        Route::get('/signature', fn() => Inertia::render('mayor/signature/Index'));
        Route::get('/routing-slips', fn() => Inertia::render('mayor/routing-slips/RoutingSlips'));
        Route::get('/reports', fn() => Inertia::render('mayor/reports/Index'));
    });

    // CART Routes
    Route::prefix('cart')->group(function () {
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
});


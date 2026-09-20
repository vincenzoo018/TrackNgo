<?php

namespace App\Http\Controllers;

use App\Contracts\AuditTrailServiceInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditTrailController extends Controller
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    /**
     * Display the Audit Trail module with System Trail and Action Trail separation
     * and role-based visibility rules.
     */
    public function index(Request $request): Response
    {
        $payload = $this->auditTrailService->getAuditTrailPayload($request->user() ?: auth()->user());

        return Inertia::render('audit-trail/Index', $payload);
    }
}

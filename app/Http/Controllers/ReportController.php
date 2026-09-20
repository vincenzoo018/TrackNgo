<?php

namespace App\Http\Controllers;

use App\Contracts\ReportServiceInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function __construct(
        protected ReportServiceInterface $reportService
    ) {}

    /**
     * Display the comprehensive Reports & Analytics dashboard.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user() ?: auth()->user();
        $payload = $this->reportService->getReportsPayload($actor, $request->query());

        return Inertia::render('reports/Index', $payload);
    }
}

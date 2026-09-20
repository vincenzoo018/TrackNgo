<?php

namespace App\Http\Controllers;

use App\Contracts\DashboardServiceInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        protected DashboardServiceInterface $dashboardService
    ) {}

    /**
     * Display the live, synchronized Dashboard module.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user() ?: auth()->user();
        $payload = $this->dashboardService->getDashboardPayload($actor, $request->query());

        return Inertia::render('dashboard/Index', $payload);
    }
}

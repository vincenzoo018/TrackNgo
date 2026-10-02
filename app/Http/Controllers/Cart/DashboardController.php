<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartMonitoringService;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        protected CartMonitoringService $monitoring
    ) {}

    /** Monitoring overview: volume, ARTA status, escalations and the departments holding delayed documents. */
    public function index(): Response
    {
        return Inertia::render('cart/Dashboard', $this->monitoring->dashboard());
    }
}

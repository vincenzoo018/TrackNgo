<?php

namespace App\Http\Controllers;

use App\Contracts\RoutingSlipServiceInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RoutingSlipController extends Controller
{
    public function __construct(
        protected RoutingSlipServiceInterface $routingSlipService
    ) {}

    /**
     * Display a listing of routing slips and document timelines with role-based scoping.
     */
    public function index(Request $request): Response
    {
        $payload = $this->routingSlipService->getRoutingSlipsPayload($request->user() ?: auth()->user());

        return Inertia::render('routing-slips/Index', $payload);
    }
}

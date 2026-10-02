<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartMonitoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MonitoringController extends Controller
{
    public function __construct(
        protected CartMonitoringService $monitoring
    ) {}

    /** Read-only list of every document with its location, handler, stage and processing time. */
    public function index(Request $request): Response
    {
        return Inertia::render('cart/monitoring/Index', [
            'rows'    => $this->monitoring->rows(),
            'options' => $this->monitoring->filterOptions(),
            'initial' => $request->only(['view', 'search']),
        ]);
    }

    /** Tracking view of one document: timing, timeline, escalations and its audit history. */
    public function show(int $id): Response
    {
        return Inertia::render('cart/monitoring/Show', $this->monitoring->document($id));
    }

    /** Notice to the current handler asking them to act (recorded in the audit trail). */
    public function followUp(Request $request, int $id): RedirectResponse
    {
        $validated = $request->validate(['message' => 'nullable|string|max:300']);
        $handler = $this->monitoring->sendFollowUp($id, $request->user(), $validated['message'] ?? null);

        return redirect()->back()->with('success', "Follow-up sent to {$handler}.");
    }
}

<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartMonitoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EscalationController extends Controller
{
    public function __construct(
        protected CartMonitoringService $monitoring
    ) {}

    /** ARTA compliance board: every document by processing-time status, with its escalation state. */
    public function index(Request $request): Response
    {
        return Inertia::render('cart/escalations/Board', [
            'rows'    => $this->monitoring->rows(),
            'options' => $this->monitoring->filterOptions(),
            'rules'   => $this->monitoring->rules(),
            'initial' => $request->only(['view', 'status']),
        ]);
    }

    /** Close the document's open escalation with CART's notes; the workflow itself is untouched. */
    public function resolve(Request $request, int $id): RedirectResponse
    {
        $validated = $request->validate(['notes' => 'required|string|min:5|max:1000']);
        $this->monitoring->resolveEscalation($id, $request->user(), $validated['notes']);

        return redirect()->back()->with('success', 'Escalation marked as resolved.');
    }
}

<?php

namespace App\Http\Controllers;

use App\Contracts\EscalationServiceInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CartEscalationController extends Controller
{
    public function __construct(
        protected EscalationServiceInterface $escalationService
    ) {}

    /**
     * Display the consolidated ARTA Escalated Docs module.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user() ?: auth()->user();
        $payload = $this->escalationService->getEscalationPayload($actor, $request->query());

        return Inertia::render('cart/escalations/Index', $payload);
    }

    /**
     * Mark an escalated document as resolved.
     */
    public function resolve(Request $request, $id): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();
        $this->escalationService->resolveEscalation((int) $id, $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document escalation status has been marked as resolved.');
    }
}

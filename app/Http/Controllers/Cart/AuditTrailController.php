<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartActivityService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditTrailController extends Controller
{
    public function __construct(
        protected CartActivityService $activity
    ) {}

    /** Document activity history (view only — CART cannot edit or delete audit records). */
    public function index(Request $request): Response
    {
        return Inertia::render('cart/audit-trail/Index', $this->activity->auditTrail($request->query()));
    }
}

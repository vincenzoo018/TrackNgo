<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\ArtaMonitor;
use App\Services\Cart\CartActivityService;
use App\Services\Cart\CartAlerts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AlertController extends Controller
{
    public function __construct(
        protected CartActivityService $activity
    ) {}

    public function index(Request $request, ArtaMonitor $monitor): Response
    {
        $monitor->syncIfDue();

        return Inertia::render('cart/alerts/Index', $this->activity->alerts($request->query()));
    }

    public function read(int $id): RedirectResponse
    {
        $this->activity->markRead($id);

        return redirect()->back();
    }

    public function readAll(): RedirectResponse
    {
        CartAlerts::markAllRead();

        return redirect()->back()->with('success', 'All alerts marked as read.');
    }
}

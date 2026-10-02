<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\Cart\CartMonitoringService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
    public function __construct(
        protected CartMonitoringService $monitoring
    ) {}

    /** Find any document (active or finished) and see its tracking timeline beside the results. */
    public function index(Request $request): Response
    {
        return Inertia::render('cart/search/Index', [
            // Closures: picking a result reloads only "selected"
            'rows'     => fn () => $this->monitoring->rows(),
            'options'  => fn () => $this->monitoring->filterOptions(),
            'selected' => function () use ($request) {
                $document = is_numeric($request->query('doc')) ? Document::find((int) $request->query('doc')) : null;

                return $document ? ['id' => $document->document_id, 'timeline' => $this->monitoring->timeline($document)] : null;
            },
        ]);
    }
}

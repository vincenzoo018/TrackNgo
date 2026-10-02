<?php

namespace App\Http\Controllers\Cart;

use App\Http\Controllers\Controller;
use App\Services\Cart\CartMonitoringService;
use App\Services\Cart\CartReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        protected CartReportService $reports,
        protected CartMonitoringService $monitoring
    ) {}

    public function index(Request $request): Response
    {
        $filters = $this->reports->filters($request->query());

        return Inertia::render('cart/reports/Index', [
            'reportTypes' => collect(CartReportService::TYPES)->map(fn ($type, $id) => ['id' => $id] + $type)->values(),
            'report'      => $this->reports->build($filters),
            'filters'     => $filters,
            'options'     => $this->monitoring->filterOptions() + [
                'stages'   => $this->reports->stageOptions(),
                'statuses' => collect(CartReportService::STATUS_LABELS)->map(fn ($label, $id) => ['id' => $id, 'label' => $label])->values(),
            ],
        ]);
    }

    /** CSV download of the selected report with the same filters (logged in report_logs and the audit trail). */
    public function export(Request $request): StreamedResponse
    {
        return $this->reports->export($this->reports->filters($request->query()), $request->user(), $request->ip());
    }
}

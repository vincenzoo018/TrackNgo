<?php

namespace App\Http\Controllers\Receiving;

use App\Contracts\AuditTrailServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentPhysicalLocation;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Cart\ArtaClock;
use App\Services\Cart\CartMonitoringService;
use App\Services\Document\DocumentRoute;
use App\Services\Document\MayoralActionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Receiving → ARTA Timeline and Location Map for any document, opened from its page or found by tracking /
 * reference number. Both show record data only (never the file), so the clerk may open them for every document.
 */
class DocumentLookupController extends Controller
{
    public function __construct(
        protected WorkingDayCalendar $calendar,
        protected ArtaClock $clock,
        protected CartMonitoringService $monitoring,
        protected MayoralActionService $mayoral
    ) {}

    /** ?q=<tracking or reference number> opens that document's page of the lookup; without q, the search page */
    public function search(Request $request, string $page): Response|RedirectResponse
    {
        $q = strtoupper(trim((string) $request->query('q', '')));
        if ($q !== '') {
            $document = Document::where('tracking_number', $q)->orWhere('reference_number', preg_replace('/^PENDING-/', '', $q))->first();
            if ($document) {
                return redirect("/receiving/documents/{$document->document_id}/{$page}");
            }
        }

        return Inertia::render($page === 'arta-timeline' ? 'receiving/documents/ArtaTimeline' : 'receiving/documents/LocationMap', [
            'document' => null,
            'query'    => $q,
            'notFound' => $q !== '',
            'recent'   => $this->recent(),
        ]);
    }

    public function artaTimeline(int $id): Response
    {
        $document = Document::with(['type', 'extension.extender', 'department', 'currentHolder', 'currentHolderDepartment'])->findOrFail($id);
        $timing = $this->clock->evaluate($document);
        $assigned = $this->calendar->day($timing['assigned_at']);
        $due = $this->calendar->deadlineFor($document);
        $originalDue = $document->extension ? $this->calendar->day($document->extension->previous_due_date) : $due;
        $closed = ArtaClock::isClosed($document);
        $end = $closed
            ? $this->calendar->day($document->deemed_approved_at ?? $document->completed_at ?? $document->updated_at)
            : $this->calendar->day(now());
        $last = $end->greaterThan($due) ? $end : $due;
        $working = $timing['working_days'];

        // Every day from filing to the later of the deadline and today (or the day it closed)
        $days = [];
        $count = 0;
        for ($day = $assigned->copy(); $day->lte($last); $day->addDay()) {
            $isStart = $day->isSameDay($assigned);
            $holiday = $this->calendar->holidayName($day);
            $counts = !$isStart && (!$working || $this->calendar->isWorkingDay($day));
            $count += $counts ? 1 : 0;
            $days[] = [
                'date'      => $day->toDateString(),
                'kind'      => $isStart ? 'filed' : ($counts ? 'counted' : ($holiday ? 'holiday' : 'weekend')),
                'label'     => $holiday ?? ($day->isWeekend() && $working ? ($day->isSaturday() ? 'Saturday' : 'Sunday') : null),
                'number'    => $counts ? $count : null,
                'overdue'   => $counts && $count > $timing['allowed_days'],
                'extension' => $counts && $document->extension && $day->greaterThan($originalDue) && $day->lte($due),
                'is_due'    => $day->isSameDay($due),
                'is_today'  => $day->isSameDay($this->calendar->day(now())),
            ];
        }

        return Inertia::render('receiving/documents/ArtaTimeline', [
            'document' => $this->summary($document) + [
                'category'       => $document->type?->service_category,
                'period_days'    => $this->calendar->processingDays($document->type),
                'working_days'   => $working,
                'filed_at'       => ($document->date_filed ?? $document->created_at)?->toIso8601String(),
                'original_due'   => $originalDue->toDateString(),
                'due_date'       => $due->toDateString(),
                'timing'         => collect($timing)->only(['allowed_days', 'elapsed_days', 'remaining_days', 'overdue_days', 'status', 'completed_late'])->all(),
                'extension'      => $document->extension ? [
                    'reason'      => $document->contentsVisibleTo() ? $document->extension->reason : null,
                    'by'          => $document->extension->extender?->name,
                    'at'          => $document->extension->extended_at->toIso8601String(),
                    'days'        => $document->extension->extended_days,
                    'notified'    => $document->extension->notified_client,
                ] : null,
                'deemed'         => $document->deemed_approved_at ? ['at' => $document->deemed_approved_at->toIso8601String(), 'basis' => $document->deemed_approval_basis] : null,
                'mayoral'        => $this->mayoral->present($document),
            ],
            'days'     => $days,
            'offices'  => $this->monitoring->hops(collect([$document]))->get($document->document_id, collect())->values(),
            'query'    => '',
            'notFound' => false,
            'recent'   => [],
        ]);
    }

    public function locationMap(int $id): Response
    {
        $document = Document::with(['currentHolder.role', 'currentHolderDepartment', 'heldFor', 'department', 'type', 'physicalLocations.department', 'physicalLocations.recorder'])->findOrFail($id);
        $hops = $this->monitoring->hops(collect([$document]))->get($document->document_id, collect())->values();
        $current = null;
        if ($document->route_based && !$document->isClosed()) {
            $current = collect(app(DocumentRoute::class)->steps($document))->firstWhere('status', DocumentRoute::CURRENT);
        }

        return Inertia::render('receiving/documents/LocationMap', [
            'document'    => $this->summary($document) + [
                'holder'          => $document->currentHolder?->name,
                'holder_role'     => $document->currentHolder?->role?->role_name,
                'holder_office'   => $document->currentHolderDepartment?->department_name,
                'held_for'        => $document->heldFor?->name,
                'since'           => $hops->last()['arrived_at'] ?? ($document->date_filed ?? $document->created_at)?->toIso8601String(),
                'live_status'     => $current['detail'] ?? null,
                'closed'          => $document->isClosed(),
                'completed_at'    => $document->completed_at?->toIso8601String(),
            ],
            'path'        => $hops,
            'physical'    => $document->physicalLocations->map(fn (DocumentPhysicalLocation $l) => [
                'id'          => $l->id,
                'office'      => $l->department?->department_name,
                'cabinet'     => $l->cabinet,
                'box'         => $l->box,
                'remarks'     => $l->remarks,
                'recorded_by' => $l->recorder?->name,
                'recorded_at' => $l->created_at?->toIso8601String(),
            ])->values(),
            'departments' => Department::where('is_active', true)->orderBy('department_name')->get(['department_id', 'department_name']),
            'query'       => '',
            'notFound'    => false,
            'recent'      => [],
        ]);
    }

    /**
     * Record where the paper original is kept now (each change is kept as history). Also posted from the document
     * page by the holder of an internal document (see Document::paperLocationRecordableBy).
     */
    public function storePhysicalLocation(Request $request, int $id, AuditTrailServiceInterface $auditTrail): RedirectResponse
    {
        $document = Document::findOrFail($id);
        abort_unless($document->paperLocationRecordableBy($request->user()), 403, 'Only the Receiving Clerk or the person who has this document can record where its paper original is kept.');
        $data = $request->validate([
            'department_id' => 'required|integer|exists:departments,department_id',
            'cabinet'       => 'required|string|max:100',
            'box'           => 'nullable|string|max:100',
            'remarks'       => 'nullable|string|max:255',
        ], [
            'cabinet.required' => 'Enter the cabinet / shelf where the original is kept.',
        ]);

        $location = DocumentPhysicalLocation::create($data + ['document_id' => $document->document_id, 'recorded_by' => $request->user()->id]);
        $office = Department::find($data['department_id'])?->department_name;
        $auditTrail->logDocumentAction(
            document: $document,
            action: 'Physical Location Updated',
            description: "Paper original kept at {$office}, {$location->cabinet}" . ($location->box ? ", {$location->box}" : '') . ($location->remarks ? " ({$location->remarks})" : '') . '.',
            actor: $request->user(),
            ipAddress: $request->ip()
        );

        return redirect()->back()->with('success', 'Location of the paper original saved.');
    }

    private function summary(Document $document): array
    {
        return [
            'document_id'      => $document->document_id,
            'reference_number' => $document->reference_number,
            'tracking_number'  => $document->tracking_number,
            'title'            => $document->visibleTitle(),
            'type'             => $document->type?->type_name,
            'status'           => $document->status,
            'office'           => $document->department?->department_name,
            'is_internal'      => (bool) $document->is_internal,
        ];
    }

    /** Documents still in process, nearest deadline first (shown on the search page) */
    private function recent(): array
    {
        return Document::with('type')
            ->whereRaw('LOWER(status) NOT IN (' . ArtaClock::placeholders() . ')', ArtaClock::CLOSED_STATUSES)
            ->orderBy('arta_due_date')
            ->limit(8)
            ->get()
            ->map(fn (Document $d) => [
                'document_id'      => $d->document_id,
                'reference_number' => $d->reference_number,
                'tracking_number'  => $d->tracking_number,
                'title'            => $d->visibleTitle(),
                'type'             => $d->type?->type_name,
                'due_date'         => $d->arta_due_date?->toDateString(),
            ])
            ->all();
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Contracts\AuditTrailServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\DocumentType;
use App\Models\Holiday;
use App\Services\Calendar\WorkingDayCalendar;
use App\Support\PhilippineHolidays;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin → System Configuration: document types with their Citizen's Charter category and processing period, and
 * the Holiday Calendar every ARTA deadline skips. Changing a period applies to documents filed afterwards (each
 * document keeps the deadline it was given at filing); CART is alerted of the change.
 */
class SystemConfigurationController extends Controller
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrail,
        protected WorkingDayCalendar $calendar
    ) {}

    public function index(Request $request): Response
    {
        $year = (int) $request->query('year', now()->setTimezone($this->calendar->timezone())->year);

        return Inertia::render('admin/system/SystemConfiguration', [
            'documentTypes' => DocumentType::withCount('documents')->orderBy('type_name')->get(),
            'categories'    => collect(DocumentType::CATEGORIES)->map(fn ($c, $key) => ['id' => $key] + $c)->values(),
            'holidays'      => Holiday::where('year', $year)->orderBy('date')->get(),
            'holidayTypes'  => collect(Holiday::TYPES)->map(fn ($label, $key) => ['id' => $key, 'label' => $label])->values(),
            'year'          => $year,
            'years'         => Holiday::query()->distinct()->orderBy('year')->pluck('year')->push($year)->unique()->sort()->values(),
            'hasNationalList' => PhilippineHolidays::for($year) !== [],
        ]);
    }

    public function storeType(Request $request): RedirectResponse
    {
        $data = $this->validateType($request);
        $type = DocumentType::create($data + ['is_active' => true]);

        $this->auditTrail->logUserAction('Document Type Created', "Document type \"{$type->type_name}\" created ({$this->describe($type)}).", $request->user(), $request->ip());

        return redirect()->back()->with('success', "Document type \"{$type->type_name}\" added.");
    }

    public function updateType(Request $request, int $id): RedirectResponse
    {
        $type = DocumentType::findOrFail($id);
        $data = $this->validateType($request, $type) + $request->validate(['is_active' => 'required|boolean']);
        $before = $this->describe($type);
        $type->update($data);

        $this->auditTrail->logUserAction('Document Type Updated', "Document type \"{$type->type_name}\" updated: {$before} → {$this->describe($type)}"
            . ($type->is_active ? '' : ' (inactive: no longer offered when filing)') . '.', $request->user(), $request->ip());

        return redirect()->back()->with('success', "Document type \"{$type->type_name}\" saved. New documents of this type get the new period; documents already filed keep theirs.");
    }

    public function storeHoliday(Request $request): RedirectResponse
    {
        $data = $this->validateHoliday($request);
        $holiday = Holiday::create($data + ['year' => (int) substr($data['date'], 0, 4), 'created_by' => $request->user()->id]);
        $this->calendar->flush();

        $this->auditTrail->logUserAction('Holiday Added', "{$holiday->name} ({$holiday->date->format('M d, Y')}, " . Holiday::TYPES[$holiday->type] . ') added to the Holiday Calendar.', $request->user(), $request->ip());

        return redirect()->back()->with('success', "{$holiday->name} added. Deadlines computed from now on skip it.");
    }

    public function updateHoliday(Request $request, int $id): RedirectResponse
    {
        $holiday = Holiday::findOrFail($id);
        $data = $this->validateHoliday($request, $holiday);
        $holiday->update($data + ['year' => (int) substr($data['date'], 0, 4)]);
        $this->calendar->flush();

        $this->auditTrail->logUserAction('Holiday Updated', "Holiday Calendar entry updated: {$holiday->name} ({$holiday->date->format('M d, Y')}).", $request->user(), $request->ip());

        return redirect()->back()->with('success', "{$holiday->name} saved.");
    }

    public function destroyHoliday(Request $request, int $id): RedirectResponse
    {
        $holiday = Holiday::findOrFail($id);
        $holiday->delete();
        $this->calendar->flush();

        $this->auditTrail->logUserAction('Holiday Removed', "{$holiday->name} ({$holiday->date->format('M d, Y')}) removed from the Holiday Calendar.", $request->user(), $request->ip());

        return redirect()->back()->with('success', "{$holiday->name} removed.");
    }

    /** Add the national holidays declared for the year (entries already in the calendar are kept) */
    public function loadNationalHolidays(Request $request): RedirectResponse
    {
        $year = (int) $request->validate(['year' => 'required|integer|min:2020|max:2100'])['year'];
        $added = 0;
        foreach (PhilippineHolidays::for($year) as $holiday) {
            $added += Holiday::firstOrCreate(['date' => $holiday['date']], $holiday + ['year' => $year, 'created_by' => $request->user()->id])->wasRecentlyCreated ? 1 : 0;
        }
        $this->calendar->flush();

        if ($added > 0) {
            $this->auditTrail->logUserAction('Holidays Loaded', "{$added} national holiday(s) for {$year} added to the Holiday Calendar.", $request->user(), $request->ip());
        }

        return redirect()->back()->with('success', $added > 0 ? "{$added} national holiday(s) for {$year} added." : "The national holidays for {$year} are already in the calendar.");
    }

    private function validateType(Request $request, ?DocumentType $type = null): array
    {
        $data = $request->validate([
            'type_name'            => ['required', 'string', 'max:100', Rule::unique('document_types', 'type_name')->ignore($type?->type_id, 'type_id')],
            'description'          => 'nullable|string|max:255',
            'service_category'     => ['required', Rule::in(array_keys(DocumentType::CATEGORIES))],
            // Only a Custom category takes the days entered; the others fix them
            'arta_processing_days' => 'exclude_unless:service_category,custom|nullable|integer|min:1|max:60',
        ], [
            'type_name.unique' => 'A document type with this name already exists.',
        ]);

        // The ARTA categories and LGC Sec. 54 fix the period; Custom takes the days entered
        $fixed = DocumentType::CATEGORIES[$data['service_category']]['days'];
        if ($fixed === null && empty($data['arta_processing_days'])) {
            throw \Illuminate\Validation\ValidationException::withMessages(['arta_processing_days' => 'Enter the processing days for a custom category.']);
        }
        $data['arta_processing_days'] = $fixed ?? (int) $data['arta_processing_days'];

        return $data;
    }

    private function validateHoliday(Request $request, ?Holiday $holiday = null): array
    {
        return $request->validate([
            'date' => ['required', 'date_format:Y-m-d', Rule::unique('holidays', 'date')->ignore($holiday?->id)],
            'name' => 'required|string|max:150',
            'type' => ['required', Rule::in(array_keys(Holiday::TYPES))],
        ], [
            'date.unique' => 'That date is already in the Holiday Calendar.',
        ]);
    }

    private function describe(DocumentType $type): string
    {
        $category = DocumentType::CATEGORIES[$type->service_category]['label'] ?? 'Custom';

        return "{$category}, {$type->arta_processing_days} " . ($type->countsCalendarDays() ? 'calendar' : 'working') . ' days';
    }
}

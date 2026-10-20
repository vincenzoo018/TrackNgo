<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\DigitalSignature;
use App\Models\Document;
use App\Models\DocumentExtension;
use App\Models\DocumentType;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\MayoralAction;
use App\Models\OicDesignation;
use App\Models\Role;
use App\Models\SmsNotification;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Calendar\WorkingDayCalendar;
use App\Services\Cart\CartAlerts;
use App\Services\Document\DeemedApprovalService;
use App\Services\Document\DocumentRoute;
use App\Services\Oic\OicService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * RA 11032 and the Local Government Code: holiday-aware working-day deadlines, the one extension with notice,
 * deemed approval, the Mayor's 10-day sign-or-veto period for ordinances / resolutions, and Officers-in-Charge.
 */
class ArtaComplianceTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $clerk;
    private User $mayor;
    private User $engineer;
    private User $budget;
    private User $admin;
    private User $hr;
    private DocumentType $permit;
    private DocumentType $ordinance;
    private string $barangay;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        $this->withoutVite();
        $this->withoutDefer();
        config(['services.sms.enabled' => false, 'services.sms.dry_run' => true]);
        // Wednesday 25 November 2026, 09:00 in Manila (Monday 30 November is Bonifacio Day)
        Carbon::setTestNow(Carbon::parse('2026-11-25 09:00', 'Asia/Manila')->utc());

        $records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $mayorOffice = Department::create(['department_name' => 'Office of the City Mayor', 'code' => 'OCM', 'is_active' => true]);
        $engineering = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $budgetOffice = Department::create(['department_name' => 'City Budget Office', 'code' => 'CBO', 'is_active' => true]);
        $hrOffice = Department::create(['department_name' => 'City Human Resource Office', 'code' => 'CHRMO', 'is_active' => true]);

        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $records, '09170000001');
        $this->mayor = $this->makeUser('Michelle', 'Mayor', $mayorOffice, '09170000002');
        $this->engineer = $this->makeUser('Ricardo', 'Department Head', $engineering, '09170000003');
        $this->budget = $this->makeUser('Bea', 'Department Head', $budgetOffice, '09170000004');
        $this->admin = $this->makeUser('Ada', 'Admin', $records, '09170000005');
        $this->hr = $this->makeUser('Hana', 'HR', $hrOffice, '09170000006');
        $this->permit = DocumentType::create(['type_name' => 'Permit', 'arta_processing_days' => 3, 'service_category' => 'simple', 'is_active' => true]);
        $this->ordinance = DocumentType::create(['type_name' => 'City Ordinance', 'arta_processing_days' => 10, 'service_category' => 'legislative', 'is_active' => true]);

        $province = DB::table('ph_provinces')->where('name', 'Davao Oriental')->first();
        if (!$province) {
            DB::table('ph_provinces')->insert(['code' => '112500000', 'name' => 'Davao Oriental']);
            DB::table('ph_cities')->insert(['code' => '112505000', 'name' => 'City of Mati', 'province_code' => '112500000', 'is_city' => true]);
            DB::table('ph_barangays')->insert(['code' => '1125050001', 'name' => 'Central', 'city_code' => '112505000']);
            $province = DB::table('ph_provinces')->where('name', 'Davao Oriental')->first();
        }
        $city = DB::table('ph_cities')->where('province_code', $province->code)->where('name', 'City of Mati')->first();
        $this->barangay = DB::table('ph_barangays')->where('city_code', $city->code)->value('name');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeUser(string $firstName, string $roleName, Department $department, ?string $mobile = null): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['position' => $roleName]);

        return User::forceCreate([
            'first_name'    => $firstName,
            'last_name'     => 'Tester',
            'email'         => strtolower($firstName) . '@example.test',
            'password'      => Hash::make('password'),
            'role_id'       => $role->role_id,
            'department_id' => $department->department_id,
            'mobile_number' => $mobile,
            'is_active'     => true,
            'signature'     => self::SIGNATURE_PNG,
        ]);
    }

    private function stop(User $user, bool $signs = true): array
    {
        return ['user_id' => $user->id, 'signs' => $signs];
    }

    private function fileExternal(array $route, ?DocumentType $type = null): Document
    {
        $this->actingAs($this->clerk)->post('/documents', [
            'title'          => 'Building Permit Application',
            'type_id'        => ($type ?? $this->permit)->type_id,
            'department_id'  => $this->clerk->department_id,
            'file'           => UploadedFile::fake()->create('permit.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'route'          => $route,
            'client'         => [
                'client_type' => 'Citizen', 'first_name' => 'Ana', 'middle_name' => 'Maria', 'last_name' => 'Reyes',
                'barangay' => $this->barangay, 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
                'contact_number' => '09171234567', 'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
            ],
        ])->assertSessionHasNoErrors();

        return Document::latest('document_id')->firstOrFail();
    }

    private function approve(User $user, Document $doc): void
    {
        $this->actingAs($user)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$doc->document_id}/approve-next")->assertSessionHasNoErrors();
    }

    private function designate(User $official, User $officer, string $start, string $end, string $order = '12, s. 2026'): void
    {
        $this->actingAs($this->admin)->post('/admin/oic', [
            'designating_user_id'      => $official->id,
            'designated_user_id'       => $officer->id,
            'start_date'               => $start,
            'end_date'                 => $end,
            'designation_order_number' => $order,
        ])->assertSessionHasNoErrors();
    }

    // ── Holiday calendar ─────────────────────────────────────────────────────────────────────────────

    public function test_the_deadline_skips_weekends_and_holidays_at_filing(): void
    {
        $this->assertTrue(Holiday::where('date', '2026-11-30')->exists(), 'national holidays are seeded');

        $doc = $this->fileExternal([$this->stop($this->engineer)]);

        // Thu 26 (1), Fri 27 (2), Sat/Sun skipped, Mon 30 Bonifacio Day skipped, Tue 1 Dec (3)
        $this->assertSame('2026-12-01', $doc->arta_due_date->toDateString());
        $this->assertSame(3, app(WorkingDayCalendar::class)->daysBetween('2026-11-25', '2026-12-01'));
    }

    public function test_a_work_suspension_added_by_the_admin_moves_new_deadlines(): void
    {
        $this->actingAs($this->admin)->post('/admin/system/holidays', ['date' => '2026-11-26', 'name' => 'Typhoon work suspension', 'type' => 'suspension'])
            ->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post('/admin/system/holidays', ['date' => '2026-11-26', 'name' => 'Again', 'type' => 'special'])
            ->assertSessionHasErrors('date');

        $doc = $this->fileExternal([$this->stop($this->engineer)]);
        $this->assertSame('2026-12-02', $doc->arta_due_date->toDateString());
    }

    public function test_document_type_categories_fix_the_period(): void
    {
        $this->actingAs($this->admin)->put("/admin/system/types/{$this->permit->type_id}", [
            'type_name' => 'Permit', 'service_category' => 'complex', 'arta_processing_days' => 99, 'is_active' => true,
        ])->assertSessionHasNoErrors();
        $this->assertSame(7, $this->permit->refresh()->arta_processing_days);

        $this->actingAs($this->admin)->post('/admin/system/types', ['type_name' => 'Clearance', 'service_category' => 'custom'])
            ->assertSessionHasErrors('arta_processing_days');
        $this->actingAs($this->engineer)->post('/admin/system/types', ['type_name' => 'Clearance', 'service_category' => 'simple'])
            ->assertRedirect('/department-head');
    }

    // ── Extension (RA 11032 Sec. 9(b)) ───────────────────────────────────────────────────────────────

    public function test_the_processing_office_extends_once_with_notice_to_the_client(): void
    {
        $doc = $this->fileExternal([$this->stop($this->engineer)]);

        $this->actingAs($this->budget)->post("/documents/{$doc->document_id}/extend", ['reason' => 'Site inspection needed'])->assertForbidden();

        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/extend", ['reason' => 'Site inspection needed'])
            ->assertSessionHasNoErrors();
        $extension = DocumentExtension::where('document_id', $doc->document_id)->sole();
        // Same number of days as the period: Wed 2, Thu 3, Fri 4 December
        $this->assertSame(['2026-12-01', '2026-12-04', 3], [$extension->previous_due_date->toDateString(), $extension->new_due_date->toDateString(), $extension->extended_days]);
        $this->assertSame('2026-12-04', $doc->refresh()->arta_due_date->toDateString());
        $this->assertTrue($extension->refresh()->notified_client);
        $this->assertTrue(SmsNotification::where('document_id', $doc->document_id)->where('notification_type', 'processing_extended')->exists());
        $this->assertTrue(SystemNotification::where('type', CartAlerts::DEADLINE_CHANGED)->where('document_id', $doc->document_id)->exists());

        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/extend", ['reason' => 'Another reason here'])
            ->assertSessionHasErrors(['reason' => 'The processing period was already extended once on Nov 25, 2026. RA 11032 allows only one extension.']);

        $this->actingAs($this->engineer)->get("/documents/{$doc->document_id}/extension-notice")->assertOk();
    }

    public function test_an_extension_cannot_be_given_after_the_period_lapsed(): void
    {
        $doc = $this->fileExternal([$this->stop($this->engineer)]);
        Carbon::setTestNow(Carbon::parse('2026-12-02 08:00', 'Asia/Manila')->utc());

        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/extend", ['reason' => 'Site inspection needed'])
            ->assertSessionHasErrors(['reason' => 'The processing period has already lapsed; an extension must be given before the deadline.']);
    }

    // ── Deemed approval (RA 11032 Sec. 10) ───────────────────────────────────────────────────────────

    public function test_an_unacted_application_is_deemed_approved_and_sent_for_release(): void
    {
        $doc = $this->fileExternal([$this->stop($this->engineer), $this->stop($this->mayor)]);
        $service = app(DeemedApprovalService::class);

        // Still within the due day
        Carbon::setTestNow(Carbon::parse('2026-12-01 23:00', 'Asia/Manila')->utc());
        $this->assertSame(['arta' => 0, 'lgc' => 0], $service->run());

        Carbon::setTestNow(Carbon::parse('2026-12-02 08:00', 'Asia/Manila')->utc());
        $this->assertSame(['arta' => 1, 'lgc' => 0], $service->run());
        $this->assertSame(['arta' => 0, 'lgc' => 0], $service->run(), 'never deemed twice');

        $doc->refresh();
        $this->assertSame([Document::STATUS_DEEMED_APPROVED, $this->clerk->id, DeemedApprovalService::BASIS_ARTA], [$doc->status, $doc->current_holder_id, $doc->deemed_approval_basis]);
        $this->assertTrue(SmsNotification::where('document_id', $doc->document_id)->where('notification_type', 'deemed_approved')->exists());
        $this->assertSame([
            'Submitted:done', 'Skipped:skipped', 'Skipped:skipped', 'Release:current',
        ], collect(app(DocumentRoute::class)->steps($doc))->map(fn ($s) => "{$s['label']}:{$s['status']}")->all());

        // Released without the signatures that never came; it can no longer be returned
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/return", ['reason' => 'Try'])->assertSessionHasErrors('reason');
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasNoErrors();
        $this->assertSame('completed', $doc->refresh()->status);
    }

    public function test_internal_documents_and_documents_waiting_on_the_client_are_not_deemed_approved(): void
    {
        $doc = $this->fileExternal([$this->stop($this->engineer)]);
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/return", ['reason' => 'Missing lot plan'])->assertSessionHasNoErrors();
        $this->assertSame($this->clerk->id, $doc->refresh()->current_holder_id);

        Carbon::setTestNow(Carbon::parse('2026-12-10 08:00', 'Asia/Manila')->utc());
        $this->assertSame(['arta' => 0, 'lgc' => 0], app(DeemedApprovalService::class)->run());
    }

    // ── Ordinances / resolutions (LGC Sec. 54) ───────────────────────────────────────────────────────

    public function test_an_ordinance_must_go_to_the_mayor(): void
    {
        $this->actingAs($this->clerk)->post('/documents', [
            'title' => 'Ordinance No. 5', 'type_id' => $this->ordinance->type_id, 'department_id' => $this->clerk->department_id,
            'file' => UploadedFile::fake()->create('ord.pdf', 20, 'application/pdf'), 'classification' => 'normal',
            'route' => [$this->stop($this->engineer)],
            'client' => [
                'client_type' => 'Government', 'first_name' => 'Sangguniang', 'last_name' => 'Panlungsod',
                'barangay' => $this->barangay, 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
                'contact_number' => '09171234567', 'receipt_mode' => 'Walk-in', 'purpose' => 'For approval of the Mayor',
            ],
        ])->assertSessionHasErrors('route');
    }

    public function test_the_mayors_ten_calendar_days_start_on_receipt_and_the_mayor_can_veto(): void
    {
        $doc = $this->fileExternal([$this->stop($this->engineer, false), $this->stop($this->mayor)], $this->ordinance);
        $this->assertNull($doc->mayor_received_at);
        $this->assertSame('2026-12-05', $doc->arta_due_date->toDateString(), 'calendar days for legislative types');

        Carbon::setTestNow(Carbon::parse('2026-11-27 10:00', 'Asia/Manila')->utc());
        $this->approve($this->engineer, $doc);
        $doc->refresh();
        $this->assertSame('2026-12-07', $doc->mayor_action_due_date->toDateString());
        $this->assertSame('2026-12-07', $doc->arta_due_date->toDateString());

        // Only the Mayor vetoes, and must give reasons
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/veto", ['reasons' => 'Not mine to veto at all'])->assertForbidden();
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/veto", ['reasons' => ''])->assertSessionHasErrors('reasons');
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/veto", ['reasons' => 'Conflicts with the Revenue Code'])->assertSessionHasNoErrors();

        $doc->refresh();
        $this->assertSame([Document::STATUS_VETOED, null], [$doc->status, $doc->current_holder_id]);
        $this->assertSame(MayoralAction::VETOED, MayoralAction::where('document_id', $doc->document_id)->sole()->action);
        $this->assertTrue(SystemNotification::where('document_id', $doc->document_id)->where('user_id', $this->clerk->id)->where('title', 'Document Vetoed by the Mayor')->exists());
        $this->assertSame(['Submitted', 'Approved', 'Vetoed', 'Closed'], array_column(app(DocumentRoute::class)->steps($doc), 'label'));
        $this->assertSame(['arta' => 0, 'lgc' => 0], app(DeemedApprovalService::class)->run());
    }

    public function test_an_ordinance_the_mayor_does_not_act_on_is_deemed_approved_after_ten_days(): void
    {
        $doc = $this->fileExternal([$this->stop($this->mayor)], $this->ordinance);
        $this->assertSame('2026-12-05', $doc->mayor_action_due_date->toDateString()); // filed straight to the Mayor

        Carbon::setTestNow(Carbon::parse('2026-12-06 00:30', 'Asia/Manila')->utc());
        $this->assertSame(['arta' => 0, 'lgc' => 1], app(DeemedApprovalService::class)->run());

        $doc->refresh();
        $this->assertSame([Document::STATUS_DEEMED_APPROVED, DeemedApprovalService::BASIS_LGC], [$doc->status, $doc->deemed_approval_basis]);
        $this->assertSame(MayoralAction::DEEMED_APPROVED, MayoralAction::where('document_id', $doc->document_id)->sole()->action);
    }

    public function test_the_mayor_signing_an_ordinance_is_recorded(): void
    {
        $doc = $this->fileExternal([$this->stop($this->mayor)], $this->ordinance);
        $this->approve($this->mayor, $doc);

        $this->assertSame(MayoralAction::SIGNED, MayoralAction::where('document_id', $doc->document_id)->sole()->action);
        $this->assertSame('approved', $doc->refresh()->status);
    }

    // ── Officer-in-Charge (LGC Sec. 46) ──────────────────────────────────────────────────────────────

    public function test_documents_for_an_absent_mayor_go_to_the_acting_mayor_who_signs_with_the_designation(): void
    {
        $this->designate($this->mayor, $this->budget, '2026-11-25', '2026-11-27');
        $doc = $this->fileExternal([$this->stop($this->engineer), $this->stop($this->mayor)]);
        $this->approve($this->engineer, $doc);

        $doc->refresh();
        $this->assertSame([$this->budget->id, $this->mayor->id], [$doc->current_holder_id, $doc->held_for_user_id]);
        $current = collect(app(DocumentRoute::class)->steps($doc))->firstWhere('status', DocumentRoute::CURRENT);
        $this->assertSame('Michelle Tester', $current['actor']);
        $this->assertStringContainsString('Acting Mayor per Designation Order No. 12, s. 2026', $current['acting']);

        $this->approve($this->budget, $doc);
        $doc->refresh();
        $this->assertSame('approved', $doc->status);
        $signature = DigitalSignature::where('document_id', $doc->document_id)->where('signed_by_user_id', $this->budget->id)->sole();
        $this->assertSame('Acting Mayor per Designation Order No. 12, s. 2026', $signature->capacity);
        $this->assertTrue(AuditTrail::where('document_id', $doc->document_id)->where('action', 'Approve')
            ->where('user_id', $this->budget->id)->where('description', 'like', '%[Acting Mayor per Designation Order No. 12, s. 2026, for Michelle Tester]%')->exists());
    }

    public function test_waiting_documents_are_handed_over_and_given_back_with_the_designation(): void
    {
        $doc = $this->fileExternal([$this->stop($this->mayor)]);
        $this->assertSame($this->mayor->id, $doc->current_holder_id);

        $this->designate($this->mayor, $this->engineer, '2026-11-25', '2026-11-26');
        $this->assertSame([$this->engineer->id, $this->mayor->id], [$doc->refresh()->current_holder_id, $doc->held_for_user_id]);

        // A second, overlapping designation is refused
        $this->actingAs($this->admin)->post('/admin/oic', [
            'designating_user_id' => $this->mayor->id, 'designated_user_id' => $this->budget->id,
            'start_date' => '2026-11-26', 'end_date' => '2026-11-28', 'designation_order_number' => '13',
        ])->assertSessionHasErrors('start_date');

        // The designation lapses: the next sync gives the document back to the Mayor
        Carbon::setTestNow(Carbon::parse('2026-11-27 08:00', 'Asia/Manila')->utc());
        app(OicService::class)->sync();
        $this->assertSame([$this->mayor->id, null], [$doc->refresh()->current_holder_id, $doc->held_for_user_id]);
        $this->assertSame('expired', OicDesignation::sole()->status());
    }

    public function test_a_return_by_the_acting_mayor_comes_back_to_the_acting_mayor_after_correction(): void
    {
        $this->designate($this->mayor, $this->budget, '2026-11-25', '2026-11-30');
        $doc = $this->fileExternal([$this->stop($this->engineer), $this->stop($this->mayor)]);
        $this->approve($this->engineer, $doc);

        $this->actingAs($this->budget)->post("/documents/{$doc->document_id}/return", ['reason' => 'Unsigned plan'])->assertSessionHasNoErrors();
        $this->assertSame($this->engineer->id, $doc->refresh()->current_holder_id);

        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/resubmit", [
            'files' => [UploadedFile::fake()->create('plan.pdf', 10, 'application/pdf')],
        ])->assertSessionHasNoErrors();
        $this->assertSame([$this->budget->id, $this->mayor->id], [$doc->refresh()->current_holder_id, $doc->held_for_user_id]);
    }

    // ── Public tracking (QR code) ────────────────────────────────────────────────────────────────────

    public function test_the_public_page_shows_the_same_steps_as_the_app_and_the_applicant_by_initials(): void
    {
        $doc = $this->fileExternal([$this->stop($this->engineer)]);

        // External documents are public: no sign-in needed
        auth()->logout();
        $this->assertGuest();
        $json = $this->getJson("/api/track/{$doc->tracking_number}")->assertOk()->json('document');
        $this->assertSame(app(DocumentRoute::class)->steps($doc), $json['route_info']['steps']);
        $this->assertNotContains('Michelle Tester', array_column($json['route_info']['steps'], 'actor'), 'the Mayor is not on this route');
        $this->assertSame('A. M. R.', $json['submitter_name']);
        $this->assertSame('2026-12-01', $json['due_date']);

        // Slips printed before registration carry PENDING-<reference>
        $this->getJson('/api/track/PENDING-' . $doc->reference_number)->assertOk();
    }

    // ── HR leave ─────────────────────────────────────────────────────────────────────────────────────

    public function test_hr_records_leave_in_working_days_and_designates_the_oic_on_approval(): void
    {
        $this->actingAs($this->hr)->post('/hr/leave', [
            'user_id' => $this->mayor->id, 'leave_type' => 'Vacation Leave', 'start_date' => '2026-11-27', 'end_date' => '2026-12-01',
        ])->assertSessionHasNoErrors();
        $leave = LeaveRequest::sole();
        $this->assertSame(2, $leave->working_days); // Fri 27 and Tue 1 Dec (weekend and Bonifacio Day not counted)

        $this->actingAs($this->hr)->post("/hr/leave/{$leave->id}/approve", ['designated_user_id' => $this->engineer->id, 'designation_order_number' => '15, s. 2026'])
            ->assertSessionHasNoErrors();
        $leave->refresh();
        $this->assertSame(LeaveRequest::APPROVED, $leave->status);
        $this->assertSame([$this->mayor->id, $this->engineer->id, '2026-11-27'], [$leave->designation->designating_user_id, $leave->designation->designated_user_id, $leave->designation->start_date->toDateString()]);

        // HR does not record leave for Administrator accounts
        $this->actingAs($this->hr)->post('/hr/leave', [
            'user_id' => $this->admin->id, 'leave_type' => 'Sick Leave', 'start_date' => '2026-11-26', 'end_date' => '2026-11-26',
        ])->assertSessionHasErrors('user_id');
    }
}

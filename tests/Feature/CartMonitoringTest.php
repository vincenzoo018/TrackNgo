<?php

namespace Tests\Feature;

use App\Models\ArtaEscalation;
use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\ReportLog;
use App\Models\Role;
use App\Models\RoutingSlip;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Cart\ArtaClock;
use App\Services\Cart\ArtaMonitor;
use App\Services\Cart\CartAlerts;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * CART is a read-only monitoring layer: the ARTA monitor escalates overdue documents (Smart Escalation
 * Algorithm), CART follows up and resolves escalations, and CART can never process a document.
 */
class CartMonitoringTest extends TestCase
{
    use RefreshDatabase;

    private User $cart;
    private User $handler;
    private User $clerk;
    private Department $office;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();

        $this->office = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);

        $this->cart = $this->makeUser('Maria', 'CART', $records);
        $this->handler = $this->makeUser('Ricardo', 'Department Head', $this->office);
        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $records);

        // Office day boundaries: "today" is 5 June 2026, 10:00 in Manila
        Carbon::setTestNow(Carbon::parse('2026-06-05 10:00', 'Asia/Manila')->utc());
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeUser(string $firstName, string $roleName, Department $department): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['position' => $roleName]);

        return User::forceCreate([
            'first_name'    => $firstName,
            'last_name'     => 'Tester',
            'email'         => strtolower($firstName) . '@example.test',
            'password'      => Hash::make('password'),
            'role_id'       => $role->role_id,
            'department_id' => $department->department_id,
            'is_active'     => true,
        ]);
    }

    /** A document assigned on $assignedOn (office date) with an L-day processing period, held by the handler */
    private function document(string $assignedOn, int $allowedDays, array $overrides = []): Document
    {
        static $sequence = 0;
        $sequence++;
        $type = DocumentType::firstOrCreate(['type_name' => "Type {$allowedDays}d"], ['arta_processing_days' => $allowedDays, 'is_active' => true]);
        $filed = Carbon::parse("{$assignedOn} 09:00", 'Asia/Manila')->utc();

        $document = Document::forceCreate(array_merge([
            'reference_number'             => sprintf('CEO-2026-%04d', $sequence),
            'tracking_number'              => sprintf('TNG-2026-%04d', $sequence),
            'title'                        => "Road repair request {$sequence}",
            'submitted_by'                 => $this->clerk->id,
            'department_id'                => $this->office->department_id,
            'type_id'                      => $type->type_id,
            'classification'               => 'normal',
            'status'                       => 'Accepted',
            'current_step_index'           => 2,
            'total_steps'                  => 7,
            'current_holder_id'            => $this->handler->id,
            'current_holder_department_id' => $this->office->department_id,
            'date_filed'                   => $filed,
            'created_at'                   => $filed,
            'updated_at'                   => $filed,
        ], $overrides));

        RoutingSlip::forceCreate([
            'document_id'          => $document->document_id,
            'tracking_number'      => $document->tracking_number,
            'from_user_id'         => $this->clerk->id,
            'to_user_id'           => $this->handler->id,
            'target_department_id' => $this->office->department_id,
            'sender_name'          => $this->clerk->name,
            'action'               => 'register',
            'status'               => 'pending',
            'date_received'        => $filed,
        ]);

        return $document->fresh(['type']);
    }

    // ── Smart Escalation Algorithm (documentation, Tables 6 and 7) ─────────────────────────────────

    public function test_escalation_decision_and_severity_follow_the_documented_table(): void
    {
        // [WD, L] => expected severity (null = not escalated)
        $table = [
            1001 => [4, 3, ArtaEscalation::LEVEL_WARNING],
            1002 => [7, 7, null],
            1003 => [10, 7, ArtaEscalation::LEVEL_CRITICAL],
            1004 => [27, 20, ArtaEscalation::LEVEL_OVERDUE],
            1005 => [2, 3, null],
        ];

        foreach ($table as $documentId => [$wd, $l, $severity]) {
            $escalated = $wd > $l;                              // E = 1 when WD > L
            $this->assertSame($severity !== null, $escalated, "E for document {$documentId}");
            $this->assertSame($severity, ArtaClock::severityFor(max(0, $wd - $l)), "SL for document {$documentId}");
        }
    }

    public function test_clock_computes_elapsed_overdue_days_and_status_from_the_assigned_date(): void
    {
        $clock = app(ArtaClock::class);

        // Sample computation: assigned 1 June, today 5 June, L = 3 → WD 4, OD 1, Warning
        $timing = $clock->evaluate($this->document('2026-06-01', 3));
        $this->assertSame(4, $timing['elapsed_days']);
        $this->assertSame(1, $timing['overdue_days']);
        $this->assertSame(ArtaClock::OVERDUE, $timing['status']);
        $this->assertSame(ArtaEscalation::LEVEL_WARNING, $timing['severity']);
        $this->assertSame('2026-06-04', $timing['deadline']->toDateString());

        $this->assertSame(ArtaClock::DUE, $clock->evaluate($this->document('2026-06-02', 3))['status']);          // deadline day
        $this->assertSame(ArtaClock::APPROACHING, $clock->evaluate($this->document('2026-06-03', 3))['status']);  // 1 day left
        $this->assertSame(ArtaClock::WITHIN_TIME, $clock->evaluate($this->document('2026-06-04', 7))['status']);
    }

    public function test_working_day_mode_skips_weekends(): void
    {
        config(['arta.count_working_days' => true]);
        $clock = app(ArtaClock::class);

        // Mon 1 June → Mon 8 June: 5 working days
        Carbon::setTestNow(Carbon::parse('2026-06-08 10:00', 'Asia/Manila')->utc());
        $timing = $clock->evaluate($this->document('2026-06-01', 3));

        $this->assertSame(5, $timing['elapsed_days']);
        $this->assertSame(2, $timing['overdue_days']);
        $this->assertSame('2026-06-04', $timing['deadline']->toDateString());
    }

    // ── ARTA monitor ───────────────────────────────────────────────────────────────────────────────

    public function test_monitor_records_each_escalation_level_once_and_alerts_cart(): void
    {
        $document = $this->document('2026-06-01', 3);
        $monitor = app(ArtaMonitor::class);

        $monitor->run();
        $monitor->run(); // a second pass must not repeat the event or the alert

        $escalation = ArtaEscalation::where('document_id', $document->document_id)->sole();
        $this->assertSame(ArtaEscalation::LEVEL_WARNING, $escalation->escalation_level);
        $this->assertSame(3, $escalation->arta_threshold);
        $this->assertSame(4, $escalation->days_elapsed);
        $this->assertSame(1, $escalation->overdue_days);
        $this->assertSame($this->handler->id, $escalation->notified_user_id);
        // Escalated on the first day past the deadline (5 June, office time), not when the monitor ran
        $this->assertSame('2026-06-05 00:00', $escalation->escalated_at->setTimezone('Asia/Manila')->format('Y-m-d H:i'));

        $this->assertTrue($document->fresh()->is_escalated);
        $this->assertSame('Accepted', $document->fresh()->status, 'the workflow status is never changed');
        $this->assertSame(1, SystemNotification::where('target_role', 'CART')->where('type', CartAlerts::ESCALATED)->count());
        $this->assertSame(1, AuditTrail::where('document_id', $document->document_id)->where('action', 'ARTA Escalation')->count());

        // Two days later OD = 3: the Critical level is recorded once as well
        Carbon::setTestNow(Carbon::parse('2026-06-07 10:00', 'Asia/Manila')->utc());
        $monitor->run();
        $monitor->run();
        $this->assertSame(
            [ArtaEscalation::LEVEL_WARNING, ArtaEscalation::LEVEL_CRITICAL],
            ArtaEscalation::where('document_id', $document->document_id)->orderBy('escalation_id')->pluck('escalation_level')->all()
        );
    }

    public function test_monitor_raises_deadline_alerts_and_closes_escalations_of_completed_documents(): void
    {
        $approaching = $this->document('2026-06-03', 3);
        $overdue = $this->document('2026-06-01', 3);
        $monitor = app(ArtaMonitor::class);
        $monitor->run();

        $this->assertDatabaseHas('system_notifications', ['document_id' => $approaching->document_id, 'type' => CartAlerts::APPROACHING, 'target_role' => 'CART']);

        $overdue->update(['status' => 'completed', 'completed_at' => now()]);
        $monitor->run();

        $escalation = ArtaEscalation::where('document_id', $overdue->document_id)->sole();
        $this->assertTrue($escalation->resolved);
        $this->assertFalse($overdue->fresh()->is_escalated);
    }

    public function test_inactivity_alert_waits_for_full_days_without_action(): void
    {
        // Received 4 June 09:00; at 5 June 10:00 only 25 hours have passed (two calendar dates, not two days)
        $document = $this->document('2026-06-04', 7);
        $monitor = app(ArtaMonitor::class);

        $monitor->run();
        $this->assertDatabaseMissing('system_notifications', ['document_id' => $document->document_id, 'type' => CartAlerts::INACTIVE]);

        Carbon::setTestNow(Carbon::parse('2026-06-06 10:00', 'Asia/Manila')->utc()); // 49 hours
        $monitor->run();
        $monitor->run();
        $this->assertSame(1, SystemNotification::where('document_id', $document->document_id)->where('type', CartAlerts::INACTIVE)->count());
    }

    public function test_a_handler_escalation_to_cart_is_recorded_as_a_manual_escalation(): void
    {
        $document = $this->document('2026-06-04', 7);
        $this->actingAs($this->handler)
            ->post("/documents/{$document->document_id}/escalate", ['justification' => 'Missing signatures from the client'])
            ->assertRedirect();

        app(ArtaMonitor::class)->run();

        $escalation = ArtaEscalation::where('document_id', $document->document_id)->sole();
        $this->assertSame(ArtaEscalation::LEVEL_MANUAL, $escalation->escalation_level);
        $this->assertStringContainsString('Missing signatures from the client', $escalation->reason);
    }

    // ── CART actions ───────────────────────────────────────────────────────────────────────────────

    public function test_cart_can_follow_up_once_per_cooldown_and_the_handler_is_notified(): void
    {
        $document = $this->document('2026-06-01', 3);

        $this->actingAs($this->cart)
            ->post("/cart/documents/{$document->document_id}/follow-up", ['message' => 'Please forward this today.'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('system_notifications', [
            'document_id' => $document->document_id,
            'user_id'     => $this->handler->id,
            'type'        => CartAlerts::FOLLOW_UP,
        ]);
        $this->assertDatabaseHas('audit_trail', ['document_id' => $document->document_id, 'action' => 'CART Follow-up', 'user_id' => $this->cart->id]);

        // A second follow-up within 24 hours is refused
        $this->actingAs($this->cart)
            ->post("/cart/documents/{$document->document_id}/follow-up", ['message' => 'Again'])
            ->assertSessionHasErrors('message');

        // The handler sees it in their notifications
        $this->actingAs($this->handler)->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonFragment(['type' => CartAlerts::FOLLOW_UP]);
    }

    public function test_cart_resolves_an_escalation_without_touching_the_document(): void
    {
        $document = $this->document('2026-06-01', 3);
        app(ArtaMonitor::class)->run();

        $this->actingAs($this->cart)
            ->post("/cart/escalations/{$document->document_id}/resolve", ['notes' => 'Handler committed to forward it today.'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $escalation = ArtaEscalation::where('document_id', $document->document_id)->sole();
        $this->assertTrue($escalation->resolved);
        $this->assertSame($this->cart->id, $escalation->resolved_by);
        $this->assertSame('Handler committed to forward it today.', $escalation->resolution_notes);

        $fresh = $document->fresh();
        $this->assertFalse($fresh->is_escalated);
        $this->assertSame('Accepted', $fresh->status);
        $this->assertSame($this->handler->id, $fresh->current_holder_id);
        $this->assertDatabaseHas('audit_trail', ['document_id' => $document->document_id, 'action' => 'Resolve Escalation']);
    }

    public function test_cart_cannot_file_route_or_comment_on_documents(): void
    {
        // Even when CART's office holds the document, it cannot act on it
        $document = $this->document('2026-06-04', 7, ['current_holder_id' => null, 'current_holder_department_id' => $this->cart->department_id]);

        $this->actingAs($this->cart);
        $this->post('/documents', ['title' => 'x'])->assertForbidden();
        $this->post("/documents/{$document->document_id}/accept")->assertForbidden();
        $this->post("/documents/{$document->document_id}/endorse", ['destination_type' => 'department', 'destination_id' => 1])->assertForbidden();
        $this->post("/documents/{$document->document_id}/return", ['reason' => 'x'])->assertForbidden();
        $this->post("/documents/{$document->document_id}/comments", ['comment' => 'x'])->assertForbidden();
        $this->post("/documents/{$document->document_id}/archive")->assertForbidden();

        $this->assertSame('Accepted', $document->fresh()->status);
    }

    // ── Pages ──────────────────────────────────────────────────────────────────────────────────────

    public function test_cart_pages_render_with_monitoring_data(): void
    {
        $document = $this->document('2026-06-01', 3);
        app(ArtaMonitor::class)->run();
        $this->actingAs($this->cart);

        $this->get('/cart')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('cart/Dashboard')
            ->where('summary.escalated', 1)
            ->has('recentEscalations', 1));

        $this->get('/cart/monitoring')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('cart/monitoring/Index')
            ->has('rows', 1)
            ->where('rows.0.monitor_status', 'escalated')
            ->where('rows.0.current_handler', $this->handler->name)
            ->where('rows.0.allowed_days', 3)
            ->where('rows.0.elapsed_days', 4));

        $this->get("/cart/monitoring/{$document->document_id}")->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('cart/monitoring/Show')
            ->where('document.escalation.level', 'Warning')
            ->has('timeline', 2)
            ->has('escalations', 1));

        $this->get('/cart/escalations')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('cart/escalations/Board')->has('rows', 1));
        $this->get('/cart/alerts')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('cart/alerts/Index')->where('unreadTotal', 1));
        $this->get('/cart/audit-trail')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('cart/audit-trail/Index')->has('entries'));
        $this->get('/cart/search?doc=' . $document->document_id)->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('cart/search/Index')
            ->where('selected.id', $document->document_id));

        foreach (['processing', 'delayed', 'escalations', 'departments', 'processing_time', 'compliance'] as $report) {
            $this->get("/cart/reports?report={$report}")->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
                ->component('cart/reports/Index')
                ->where('filters.report', $report)
                ->has('report.columns'));
        }

        // Old addresses still land somewhere sensible
        $this->get('/cart/documents')->assertRedirect('/cart/monitoring');
        $this->get("/cart/documents/{$document->document_id}")->assertRedirect("/cart/monitoring/{$document->document_id}");
    }

    public function test_cart_bell_lists_cart_alerts_instead_of_every_receipt(): void
    {
        $this->document('2026-06-01', 3);
        app(ArtaMonitor::class)->run();

        $this->actingAs($this->cart)->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('counts.active_escalations', 1)
            ->assertJsonPath('items.0.type', CartAlerts::ESCALATED);
    }

    public function test_report_export_downloads_csv_and_is_logged(): void
    {
        $this->document('2026-06-01', 3);
        app(ArtaMonitor::class)->run();

        $response = $this->actingAs($this->cart)->get('/cart/reports/export?report=escalations');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('Tracking #', $csv);
        $this->assertStringContainsString('TNG-2026-', $csv);
        $this->assertSame(1, ReportLog::where('generated_by', $this->cart->id)->count());
    }

    public function test_other_roles_cannot_open_cart_pages(): void
    {
        $this->actingAs($this->handler)->get('/cart/monitoring')->assertRedirect('/department-head');
    }
}

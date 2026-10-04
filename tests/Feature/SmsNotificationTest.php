<?php

namespace Tests\Feature;

use App\Models\ArtaEscalation;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentClient;
use App\Models\DocumentType;
use App\Models\Role;
use App\Models\SmsNotification;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Cart\ArtaMonitor;
use App\Services\Sms\DocumentSmsNotifier;
use App\Services\SmsService;
use App\Support\PhilippineMobile;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Semaphore SMS: switches, idempotency, limits, retries, failure handling and the events that text people.
 * No test ever reaches the real Semaphore API (stray HTTP requests fail the test).
 */
class SmsNotificationTest extends TestCase
{
    use RefreshDatabase;

    private const FAKE_KEY = 'fake-semaphore-key-0123456789abcdef';

    private const MESSAGES_URL = 'https://api.semaphore.co/api/v4/messages';

    private User $clerk;
    private User $handler;
    private User $mayor;
    private Department $office;
    private DocumentType $type;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->withoutDefer(); // run "after the response" sends immediately so they can be asserted
        Http::preventStrayRequests();

        config([
            'services.semaphore.api_key'     => self::FAKE_KEY,
            'services.semaphore.sender_name' => null,
            'services.sms.enabled'           => false,
            'services.sms.dry_run'           => true,
            'services.sms.max_per_user_per_day' => 10,
            'services.sms.max_per_document' => 10,
            'services.sms.min_interval_seconds' => 60,
            'services.sms.max_per_day'      => 200,
            'services.sms.max_attempts'     => 3,
        ]);

        $this->office = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $mayorOffice = Department::create(['department_name' => 'Office of the City Mayor', 'code' => 'OCM', 'is_active' => true]);
        $this->type = DocumentType::create(['type_name' => 'Permit', 'arta_processing_days' => 3, 'is_active' => true]);

        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $records, '09170000001');
        $this->handler = $this->makeUser('Ricardo', 'Department Head', $this->office, '09170000002');
        $this->mayor = $this->makeUser('Michelle', 'Mayor', $mayorOffice, '09170000003');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function live(): void
    {
        config(['services.sms.enabled' => true, 'services.sms.dry_run' => false]);
    }

    private function accepted(int $messageId = 98765, string $status = 'Pending'): array
    {
        return [self::MESSAGES_URL => Http::response([[
            'message_id' => $messageId, 'user_id' => 1, 'user' => 'LGU', 'account_id' => 1, 'account' => 'LGU',
            'recipient' => '639171234567', 'message' => 'x', 'sender_name' => 'SEMAPHORE', 'network' => 'Globe',
            'status' => $status, 'type' => 'Single', 'source' => 'Api',
        ]], 200)];
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
        ]);
    }

    /** External document waiting for the Mayor's approval, filed for a client with $contact */
    private function externalDocument(string $contact = '09171234567'): Document
    {
        static $n = 0;
        $n++;
        $doc = Document::forceCreate([
            'reference_number'             => sprintf('CEO-2026-%04d', $n),
            'tracking_number'              => sprintf('RS-2026-%04d', $n),
            'title'                        => 'Confidential land dispute',
            'type_id'                      => $this->type->type_id,
            'department_id'                => $this->office->department_id,
            'submitted_by'                 => $this->clerk->id,
            'classification'               => 'normal',
            'status'                       => 'Ongoing',
            'current_step_index'           => 6,
            'total_steps'                  => 7,
            'current_holder_id'            => $this->mayor->id,
            'current_holder_department_id' => $this->mayor->department_id,
            'is_internal'                  => false,
            'contact_number'               => $contact,
            'date_filed'                   => now(),
        ]);
        DocumentClient::forceCreate([
            'document_id' => $doc->document_id, 'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes',
            'barangay' => 'Central', 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
            'contact_number' => $contact, 'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
        ]);

        return $doc;
    }

    /** Internal document the handler sent, now with the Mayor for final approval */
    private function internalDocument(): Document
    {
        return Document::forceCreate([
            'reference_number'             => 'CEO-2026-0900',
            'tracking_number'              => 'RS-2026-0900',
            'title'                        => 'Budget realignment',
            'type_id'                      => $this->type->type_id,
            'department_id'                => $this->office->department_id,
            'submitted_by'                 => $this->handler->id,
            'classification'               => 'normal',
            'status'                       => 'Ongoing',
            'current_step_index'           => 6,
            'total_steps'                  => 6,
            'current_holder_id'            => $this->mayor->id,
            'current_holder_department_id' => $this->mayor->department_id,
            'is_internal'                  => true,
            'date_filed'                   => now(),
        ]);
    }

    private function approveAndRelease(Document $doc): void
    {
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasNoErrors();
    }

    // ── 1-3: switches ───────────────────────────────────────────────────────────────────────────────

    public function test_sms_disabled_logs_simulated_sms_and_never_calls_semaphore(): void
    {
        Http::fake();
        $doc = $this->externalDocument();

        $this->approveAndRelease($doc);

        Http::assertNothingSent();
        $this->assertSame(2, SmsNotification::where('document_id', $doc->document_id)->where('status', 'simulated')->where('simulation', true)->count());
        $this->assertSame('completed', $doc->refresh()->status);
    }

    public function test_dry_run_wins_over_enabled(): void
    {
        config(['services.sms.enabled' => true, 'services.sms.dry_run' => true]);
        Http::fake();

        $this->approveAndRelease($this->externalDocument());

        Http::assertNothingSent();
        $this->assertSame(2, SmsNotification::where('status', 'simulated')->count());
    }

    public function test_enabled_sends_through_semaphore_and_stores_the_provider_message_id(): void
    {
        $this->live();
        Http::fake($this->accepted(98765));
        $doc = $this->externalDocument('+63 917 123 4567');

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $sms = SmsNotification::where('document_id', $doc->document_id)->sole();
        $this->assertSame(DocumentSmsNotifier::READY_FOR_PICKUP, $sms->notification_type);
        $this->assertSame('pending', $sms->status);
        $this->assertSame('98765', $sms->provider_message_id);
        $this->assertSame('09171234567', $sms->mobile_number);
        $this->assertSame(1, $sms->attempts);
        $this->assertFalse($sms->simulation);
        Http::assertSent(fn (Request $request) => $request->url() === self::MESSAGES_URL
            && $request['number'] === '639171234567'
            && $request['apikey'] === self::FAKE_KEY
            && !isset($request['sendername'])
            && str_contains($request['message'], 'RS-2026-'));
    }

    // ── 4-5, 12-13: numbers ─────────────────────────────────────────────────────────────────────────

    public function test_philippine_mobile_numbers_are_normalized_and_junk_is_rejected(): void
    {
        foreach (['09171234567', '9171234567', '639171234567', '+639171234567', '+63 917 123 4567', '0917-123-4567'] as $valid) {
            $this->assertSame('09171234567', PhilippineMobile::normalize($valid), $valid);
        }
        foreach (['123', '00000000000', 'abcdefghijk', '0917', '09999999999', '09123456789', '099123129123', '08171234567', '', null] as $invalid) {
            $this->assertNull(PhilippineMobile::normalize($invalid), (string) $invalid);
        }
        $this->assertSame('639171234567', PhilippineMobile::toInternational('09171234567'));
    }

    public function test_recipient_without_or_with_invalid_number_is_logged_and_not_sent(): void
    {
        $this->live();
        Http::fake();
        $this->handler->forceFill(['mobile_number' => null])->save();
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $this->assertDatabaseHas('sms_notifications', ['document_id' => $doc->document_id, 'status' => 'invalid_number', 'user_id' => $this->handler->id]);

        $other = $this->externalDocument('12345');
        $this->actingAs($this->mayor)->post("/documents/{$other->document_id}/approve-route")->assertSessionHasNoErrors();
        $this->assertDatabaseHas('sms_notifications', ['document_id' => $other->document_id, 'status' => 'invalid_number']);
        Http::assertNothingSent();
    }

    // ── 6-8, 11: no duplicates, no loops ────────────────────────────────────────────────────────────

    public function test_the_same_event_is_texted_only_once(): void
    {
        $this->live();
        Http::fake($this->accepted());
        $doc = $this->externalDocument();
        $this->approveAndRelease($doc);

        // Released again (double click / resubmitted request) and the notifier called directly again
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release");
        app(DocumentSmsNotifier::class)->documentReleased($doc->refresh());

        $this->assertSame(1, SmsNotification::where('document_id', $doc->document_id)->where('notification_type', DocumentSmsNotifier::RELEASED)->count());

        // The release SMS waits SMS_MIN_INTERVAL_SECONDS after the pickup SMS to the same number
        Http::assertSentCount(1);
        $this->travel(61)->seconds();
        app(SmsService::class)->sendDue();
        app(SmsService::class)->sendDue();
        Http::assertSentCount(2); // ready for pickup + released, never more
    }

    public function test_a_duplicate_send_job_cannot_send_twice(): void
    {
        $this->live();
        Http::fake($this->accepted());
        $this->withDefer(); // keep the first attempt for us to run by hand
        $doc = $this->externalDocument();
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route");
        $sms = SmsNotification::where('document_id', $doc->document_id)->sole();

        $service = app(SmsService::class);
        $service->attempt($sms->id);
        $service->attempt($sms->id);
        $service->sendDue();

        Http::assertSentCount(1);
        $this->assertSame(1, $sms->refresh()->attempts);
    }

    public function test_arta_monitor_runs_text_the_handler_once_per_escalation_level(): void
    {
        $this->live();
        Http::fake($this->accepted());
        Carbon::setTestNow(Carbon::parse('2026-06-05 10:00', 'Asia/Manila')->utc());
        $doc = Document::forceCreate([
            'reference_number' => 'CEO-2026-0500', 'tracking_number' => 'RS-2026-0500', 'title' => 'Overdue request',
            'type_id' => $this->type->type_id, 'department_id' => $this->office->department_id, 'submitted_by' => $this->clerk->id,
            'classification' => 'normal', 'status' => 'Accepted', 'current_step_index' => 2, 'total_steps' => 7,
            'current_holder_id' => $this->handler->id, 'current_holder_department_id' => $this->office->department_id,
            'date_filed' => Carbon::parse('2026-06-01 09:00', 'Asia/Manila')->utc(),
        ]);

        $monitor = app(ArtaMonitor::class);
        $monitor->run();
        $monitor->run();
        $monitor->run();

        $sms = SmsNotification::where('document_id', $doc->document_id)->get();
        $this->assertCount(1, $sms);
        $this->assertSame(DocumentSmsNotifier::ESCALATED, $sms[0]->notification_type);
        $this->assertSame($this->handler->id, $sms[0]->user_id);
        $this->assertStringContainsString('CEO-2026-0500', $sms[0]->message);
        $this->assertStringNotContainsString('Overdue request', $sms[0]->message); // no titles in SMS

        // A later, higher level is a new event: exactly one more SMS
        Carbon::setTestNow(Carbon::parse('2026-06-10 10:00', 'Asia/Manila')->utc());
        $monitor->run();
        $monitor->run();
        $this->assertSame(
            ArtaEscalation::where('document_id', $doc->document_id)->count(),
            SmsNotification::where('document_id', $doc->document_id)->count()
        );
        $this->assertSame(2, SmsNotification::where('document_id', $doc->document_id)->count());
    }

    public function test_safety_limits_stop_bulk_sends(): void
    {
        config(['services.sms.max_per_user_per_day' => 2, 'services.sms.min_interval_seconds' => 0]);
        $sms = app(SmsService::class);

        foreach (range(1, 5) as $i) {
            $sms->notify('test', "loop:{$i}", '09171234567', 'Loop', 'TrackNGo: loop check');
        }

        $this->assertSame(2, SmsNotification::where('status', 'simulated')->count());
        $this->assertSame(3, SmsNotification::where('status', 'skipped')->count());
        $this->assertStringContainsString('SMS_MAX_PER_USER_PER_DAY', SmsNotification::where('status', 'skipped')->first()->error_message);
    }

    public function test_messages_to_the_same_number_are_spaced_out(): void
    {
        $this->live();
        Http::fake($this->accepted());
        $sms = app(SmsService::class);

        $first = $sms->notify('test', 'space:1', '09171234567', 'A', 'TrackNGo: first');
        $second = $sms->notify('test', 'space:2', '09171234567', 'A', 'TrackNGo: second');

        $this->assertSame('pending', $first->refresh()->status);
        $this->assertSame('queued', $second->refresh()->status);
        Http::assertSentCount(1);

        $this->travel(61)->seconds();
        $sms->sendDue();
        $this->assertSame('pending', $second->refresh()->status);
        Http::assertSentCount(2);
    }

    // ── 9-10: events ────────────────────────────────────────────────────────────────────────────────

    public function test_completed_internal_document_texts_the_sender(): void
    {
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $sms = SmsNotification::where('document_id', $doc->document_id)->sole();
        $this->assertSame(DocumentSmsNotifier::COMPLETED, $sms->notification_type);
        $this->assertSame($this->handler->id, $sms->user_id);
        $this->assertSame('09170000002', $sms->mobile_number);
        $this->assertStringContainsString('CEO-2026-0900', $sms->message);
    }

    public function test_external_document_texts_the_applicant_when_ready_and_when_released(): void
    {
        $doc = $this->externalDocument();

        $this->approveAndRelease($doc);

        $this->assertSame(
            [DocumentSmsNotifier::READY_FOR_PICKUP, DocumentSmsNotifier::RELEASED],
            SmsNotification::where('document_id', $doc->document_id)->orderBy('id')->pluck('notification_type')->all()
        );
        $this->assertSame(['Ana Reyes'], SmsNotification::where('document_id', $doc->document_id)->distinct()->pluck('recipient_name')->all());
    }

    // ── 14-20: provider failures ────────────────────────────────────────────────────────────────────

    public function test_timeouts_are_retried_with_backoff_then_marked_failed(): void
    {
        $this->live();
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out'));
        $doc = $this->externalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        $sms = SmsNotification::where('document_id', $doc->document_id)->sole();
        $this->assertSame('queued', $sms->status);
        $this->assertSame(1, $sms->attempts);
        $this->assertTrue($sms->next_attempt_at->isFuture());

        app(SmsService::class)->sendDue(); // not due yet
        $this->assertSame(1, $sms->refresh()->attempts);

        foreach ([2, 6, 20] as $minutes) {
            $this->travel($minutes)->minutes();
            app(SmsService::class)->sendDue();
        }

        $sms->refresh();
        $this->assertSame('failed', $sms->status);
        $this->assertSame(3, $sms->attempts);
        $this->assertStringContainsString('gave up after 3 attempts', $sms->error_message);
        $this->assertSame(1, SmsNotification::count()); // retries reuse the same record
    }

    public function test_rate_limited_and_server_errors_are_retried(): void
    {
        $this->live();
        Http::fake([self::MESSAGES_URL => Http::sequence()
            ->push(['message' => 'Too many requests'], 429)
            ->push('Service Unavailable', 503)
            ->push([['message_id' => 555, 'status' => 'Queued']], 200)]);
        $sms = app(SmsService::class)->notify('test', 'retry:1', '09171234567', 'A', 'TrackNGo: retry');

        $this->assertSame('queued', $sms->refresh()->status);
        $this->travel(2)->minutes();
        app(SmsService::class)->sendDue();
        $this->assertSame('queued', $sms->refresh()->status);
        $this->assertStringContainsString('HTTP 503', $sms->error_message);
        $this->travel(6)->minutes();
        app(SmsService::class)->sendDue();
        $this->assertSame('pending', $sms->refresh()->status);
        $this->assertSame(3, $sms->attempts);
        $this->assertNull($sms->error_message);
    }

    public function test_insufficient_credits_and_invalid_key_fail_without_retrying_and_without_leaking_the_key(): void
    {
        $this->live();
        Http::fake([self::MESSAGES_URL => Http::sequence()
            ->push(['Your current balance is insufficient to send this message.'], 200)
            ->push(['apikey' => ['The selected apikey ' . self::FAKE_KEY . ' is invalid.']], 422)]);
        $service = app(SmsService::class);

        $credits = $service->notify('test', 'credits:1', '09171234567', 'A', 'TrackNGo: credits');
        $key = $service->notify('test', 'key:1', '09181234567', 'B', 'TrackNGo: key');

        $this->assertSame('failed', $credits->refresh()->status);
        $this->assertStringContainsString('insufficient', $credits->error_message);
        $this->assertSame('failed', $key->refresh()->status);
        $this->assertStringContainsString('invalid', $key->error_message);
        $this->assertStringNotContainsString(self::FAKE_KEY, $key->error_message);
        $this->assertSame(1, $credits->attempts);
    }

    public function test_workflow_and_in_app_notification_succeed_when_sms_fails(): void
    {
        $this->live();
        Http::fake([self::MESSAGES_URL => Http::response('Internal Server Error', 500)]);
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $this->assertSame('completed', $doc->refresh()->status);
        $this->assertDatabaseHas('system_notifications', ['document_id' => $doc->document_id, 'user_id' => $this->handler->id, 'title' => 'Document Approved & Completed']);
        $sms = SmsNotification::where('document_id', $doc->document_id)->sole();
        $this->assertSame('queued', $sms->status); // will be retried
        $this->assertStringContainsString('HTTP 500', $sms->error_message);
    }

    // ── 21-24: message safety, secrets, no public send endpoint ─────────────────────────────────────

    public function test_messages_are_one_plain_sms_and_never_start_with_test(): void
    {
        $sms = app(SmsService::class);

        $plain = $sms->notify('test', 'msg:1', '09171234567', 'A', 'TEST message ✅ for José ' . str_repeat('x', 300));
        $this->assertStringStartsWith('TrackNGo: TEST message for Jose', $plain->message);
        $this->assertLessThanOrEqual(160, strlen($plain->message));
        $this->assertMatchesRegularExpression('/^[\x20-\x7E]+$/', $plain->message);

        $doc = $this->externalDocument();
        $doc->forceFill(['tracking_number' => 'RS-2026-99999', 'reference_number' => 'ADACS-2026-99999'])->save();
        $this->approveAndRelease($doc);
        $this->actingAs($this->mayor)->post("/documents/{$this->internalDocument()->document_id}/approve-route");
        foreach (SmsNotification::where('notification_type', '!=', 'test')->get() as $row) {
            $this->assertLessThanOrEqual(160, strlen($row->message), $row->message);
            $this->assertStringStartsWith('TrackNGo:', $row->message);
        }
    }

    public function test_the_api_key_never_reaches_logs_or_the_database(): void
    {
        $this->live();
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $e) use (&$logged) {
            $logged[] = $e->message . json_encode($e->context);
        });
        Http::fake([self::MESSAGES_URL => fn () => throw new ConnectionException('Failed to connect, apikey=' . self::FAKE_KEY)]);

        app(SmsService::class)->notify('test', 'secret:1', '09171234567', 'A', 'TrackNGo: secret');

        $this->assertNotEmpty($logged);
        foreach ($logged as $line) {
            $this->assertStringNotContainsString(self::FAKE_KEY, $line);
        }
        $this->assertStringNotContainsString(self::FAKE_KEY, json_encode(SmsNotification::all()->toArray()));
        $this->assertStringContainsString('.env', file_get_contents(base_path('.gitignore')));
    }

    public function test_there_is_no_web_endpoint_that_sends_arbitrary_sms(): void
    {
        $smsRoutes = collect(Route::getRoutes())->filter(fn ($route) => str_contains($route->uri(), 'sms'));

        $this->assertSame(['admin/notifications/sms'], $smsRoutes->map->uri()->values()->all());
        $this->assertSame(['GET', 'HEAD'], $smsRoutes->first()->methods());
        // Other roles are sent back to their own dashboard
        $this->actingAs($this->clerk)->get('/admin/notifications/sms')->assertRedirect('/receiving');
    }

    public function test_the_test_command_validates_the_number_and_caps_test_sends(): void
    {
        $this->artisan('sms:test', ['number' => '0917'])->assertFailed();

        foreach (range(1, 5) as $i) {
            $this->artisan('sms:test', ['number' => "0917123456{$i}"])->assertSuccessful();
        }
        $this->artisan('sms:test', ['number' => '09171234569'])->assertFailed();
        $this->assertSame(5, SmsNotification::where('notification_type', 'test')->where('status', 'simulated')->count());
    }

    // ── Contact numbers on accounts and external registrations ──────────────────────────────────────

    public function test_hr_must_give_each_account_a_valid_unique_mobile_number(): void
    {
        $hr = $this->makeUser('Ana', 'HR', $this->office, '09170000004');
        $role = Role::firstOrCreate(['role_name' => 'Department Head'], ['position' => 'Department Head']);
        $payload = [
            'first_name' => 'Pedro', 'last_name' => 'Cruz', 'email' => 'pedro@example.test', 'password' => 'password123',
            'department_id' => $this->office->department_id, 'role_id' => $role->role_id, 'signature' => 'data:image/png;base64,AAAA',
        ];

        $this->actingAs($hr)->post('/hr/employees', $payload)->assertSessionHasErrors(['mobile_number' => 'The mobile number is required.']);
        $this->post('/hr/employees', $payload + ['mobile_number' => '0917'])->assertSessionHasErrors(['mobile_number' => 'Please enter a valid Philippine mobile number.']);
        // Same number as Ricardo's account, typed in another format
        $this->post('/hr/employees', $payload + ['mobile_number' => '+639170000002'])->assertSessionHasErrors(['mobile_number' => 'This mobile number is already used by another account.']);

        $this->post('/hr/employees', $payload + ['mobile_number' => '+63 918 765 4321'])->assertSessionHasNoErrors();
        $this->assertSame('09187654321', User::where('email', 'pedro@example.test')->value('mobile_number'));
    }

    public function test_admin_account_forms_validate_mobile_numbers_too(): void
    {
        $admin = $this->makeUser('Root', 'Admin', $this->office, '09170000005');
        $role = Role::firstOrCreate(['role_name' => 'HR'], ['position' => 'HR']);

        $this->actingAs($admin)->post('/admin/users', [
            'first_name' => 'Lia', 'last_name' => 'Uy', 'email' => 'lia@example.test', 'password' => 'secret12',
            'department_id' => $this->office->department_id, 'role_id' => $role->role_id, 'mobile_number' => '09170000003',
        ])->assertSessionHasErrors(['mobile_number' => 'This mobile number is already used by another account.']);

        // Keeping one's own number on edit is not a duplicate
        $this->put("/admin/users/{$this->handler->id}", [
            'first_name' => 'Ricardo', 'last_name' => 'Tester', 'email' => 'ricardo@example.test',
            'department_id' => $this->office->department_id, 'role_id' => $this->handler->role_id,
            'mobile_number' => '639170000002', 'is_active' => true,
        ])->assertSessionHasNoErrors();
    }

    public function test_external_registration_requires_a_valid_client_mobile_number(): void
    {
        $this->actingAs($this->clerk)
            ->post('/documents', ['client' => ['contact_number' => '0917-123']])
            ->assertSessionHasErrors(['client.contact_number' => 'Please enter a valid Philippine mobile number.']);

        $this->post('/documents', ['client' => ['contact_number' => '+63 917 123 4567']])
            ->assertSessionDoesntHaveErrors('client.contact_number');
    }
}

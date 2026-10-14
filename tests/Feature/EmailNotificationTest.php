<?php

namespace Tests\Feature;

use App\Jobs\SendEmailNotification;
use App\Models\ArtaEscalation;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentClient;
use App\Models\DocumentType;
use App\Models\EmailNotification;
use App\Models\Role;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Cart\ArtaMonitor;
use App\Services\Document\DeemedApprovalService;
use App\Services\Email\DocumentEmailNotifier;
use App\Services\Email\EmailService;
use App\Support\EmailAddress;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Tests\TestCase;
use Throwable;

/**
 * Email notifications: the switch, who is emailed for which event and what they are told, idempotency, the daily
 * cap and per-recipient limit, retries and permanent failures, and the admin dashboard. Mail goes to Laravel's
 * array mailer or to a scripted transport that fails on purpose; nothing ever leaves the machine.
 */
class EmailNotificationTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private const APPLICANT_EMAIL = 'ana.reyes@example.test';

    private User $clerk;
    private User $handler;
    private User $mayor;
    private User $admin;
    private Department $office;
    private DocumentType $type;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        $this->withoutVite();
        $this->withoutDefer();
        Http::preventStrayRequests();

        config([
            'services.sms.enabled'                     => false,
            'services.sms.dry_run'                     => true,
            'services.email.enabled'                   => true,
            'services.email.max_per_day'               => 50,
            'services.email.max_per_recipient_per_day' => 10,
            'services.email.max_attempts'              => 3,
            'services.email.blocked_domains'           => [],
            'mail.default'                             => 'array',
            'mail.mailers.smtp.username'               => 'sender.account@gmail.com',
            'mail.mailers.smtp.password'               => 'secret-app-password',
            'app.url'                                  => 'http://trackngo.test',
            'app.tracking_url'                         => null,
        ]);

        $records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $mayorOffice = Department::create(['department_name' => 'Office of the City Mayor', 'code' => 'OCM', 'is_active' => true]);
        $this->office = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $this->type = DocumentType::create(['type_name' => 'Permit', 'arta_processing_days' => 3, 'service_category' => 'simple', 'is_active' => true]);

        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $records, '09170000001');
        $this->handler = $this->makeUser('Ricardo', 'Department Head', $this->office, '09170000002');
        $this->mayor = $this->makeUser('Michelle', 'Mayor', $mayorOffice, '09170000003');
        $this->admin = $this->makeUser('Ada', 'Admin', $records, '09170000004');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────────

    private function makeUser(string $firstName, string $roleName, Department $department, string $mobile): User
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

    /** External document waiting for the Mayor's approval, filed for a client with $email */
    private function externalDocument(?string $email = self::APPLICANT_EMAIL, string $classification = 'normal'): Document
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
            'classification'               => $classification,
            'status'                       => 'Ongoing',
            'current_step_index'           => 6,
            'total_steps'                  => 7,
            'current_holder_id'            => $this->mayor->id,
            'current_holder_department_id' => $this->mayor->department_id,
            'is_internal'                  => false,
            'contact_number'               => '09171234567',
            'date_filed'                   => now(),
        ]);
        DocumentClient::forceCreate([
            'document_id' => $doc->document_id, 'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes',
            'barangay' => 'Central', 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
            'contact_number' => '09171234567', 'email' => $email, 'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
        ]);

        return $doc;
    }

    /** Internal document the handler sent, now with the Mayor for final approval */
    private function internalDocument(string $classification = 'normal'): Document
    {
        return Document::forceCreate([
            'reference_number'             => 'CEO-2026-0900',
            'tracking_number'              => 'RS-2026-0900',
            'title'                        => 'Budget realignment',
            'type_id'                      => $this->type->type_id,
            'department_id'                => $this->office->department_id,
            'submitted_by'                 => $this->handler->id,
            'classification'               => $classification,
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

    /** @return Collection<int, SentMessage> what the array mailer accepted, optionally only for $address */
    private function sent(?string $address = null): Collection
    {
        return app('mail.manager')->mailer('array')->getSymfonyTransport()->messages()
            ->filter(fn (SentMessage $m) => $address === null
                || collect($m->getEnvelope()->getRecipients())->contains(fn ($r) => $r->getAddress() === $address))
            ->values();
    }

    private function html(SentMessage $message): string
    {
        return (string) $message->getOriginalMessage()->getHtmlBody();
    }

    private function text(SentMessage $message): string
    {
        return (string) $message->getOriginalMessage()->getTextBody();
    }

    /**
     * Makes a transport that plays $outcomes in order (an exception is thrown, null succeeds) the default mailer.
     *
     * @param  array<int, Throwable|null>  $outcomes
     */
    private function scriptedMailer(array $outcomes): object
    {
        $transport = new class($outcomes) extends AbstractTransport {
            public int $sends = 0;

            public function __construct(private array $outcomes)
            {
                parent::__construct();
            }

            protected function doSend(SentMessage $message): void
            {
                $this->sends++;
                $outcome = array_shift($this->outcomes);
                if ($outcome instanceof Throwable) {
                    throw $outcome;
                }
            }

            public function __toString(): string
            {
                return 'scripted://';
            }
        };

        Mail::extend('scripted', fn () => $transport);
        Mail::purge('scripted');
        config(['mail.mailers.scripted' => ['transport' => 'scripted'], 'mail.default' => 'scripted']);

        return $transport;
    }

    private function useArrayMailer(): void
    {
        config(['mail.default' => 'array']);
    }

    private function locationBarangay(): string
    {
        $province = DB::table('ph_provinces')->where('name', 'Davao Oriental')->first();
        if (!$province) {
            DB::table('ph_provinces')->insert(['code' => '112500000', 'name' => 'Davao Oriental']);
            DB::table('ph_cities')->insert(['code' => '112505000', 'name' => 'City of Mati', 'province_code' => '112500000', 'is_city' => true]);
            DB::table('ph_barangays')->insert(['code' => '1125050001', 'name' => 'Central', 'city_code' => '112505000']);
            $province = DB::table('ph_provinces')->where('name', 'Davao Oriental')->first();
        }
        $city = DB::table('ph_cities')->where('province_code', $province->code)->where('name', 'City of Mati')->first();

        return DB::table('ph_barangays')->where('city_code', $city->code)->value('name');
    }

    /** The Receiving Clerk registers an external document through the intake form */
    private function fileExternal(?string $email, array $route): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->clerk)->post('/documents', [
            'title'          => 'Building Permit Application',
            'type_id'        => $this->type->type_id,
            'department_id'  => $this->clerk->department_id,
            'file'           => UploadedFile::fake()->create('permit.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'route'          => $route,
            'client'         => [
                'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes',
                'barangay' => $this->locationBarangay(), 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
                'contact_number' => '09171234567', 'email' => $email, 'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
            ],
        ]);
    }

    // ── recipients and wording ──────────────────────────────────────────────────────────────────────

    public function test_completed_internal_document_emails_the_sender_with_its_title_and_a_link(): void
    {
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $email = EmailNotification::sole();
        $this->assertSame([DocumentEmailNotifier::COMPLETED, 'sent', $this->handler->id, 'ricardo@example.test', 1],
            [$email->notification_type, $email->status, $email->user_id, $email->recipient_email, $email->attempts]);

        $message = $this->sent('ricardo@example.test')->sole();
        $this->assertSame('TrackNGo: Document Completed — CEO-2026-0900', $message->getOriginalMessage()->getSubject());
        $this->assertStringContainsString('Budget realignment', $this->html($message));
        $this->assertStringContainsString("http://trackngo.test/documents/{$doc->document_id}", $this->html($message));
        $this->assertStringContainsString('received its final approval', $this->text($message));
    }

    public function test_external_applicant_is_emailed_when_ready_and_when_released_with_minimal_details(): void
    {
        $doc = $this->externalDocument();

        $this->approveAndRelease($doc);

        $this->assertSame(
            [DocumentEmailNotifier::READY_FOR_PICKUP, DocumentEmailNotifier::RELEASED],
            EmailNotification::where('document_id', $doc->document_id)->orderBy('id')->pluck('notification_type')->all()
        );
        $messages = $this->sent(self::APPLICANT_EMAIL);
        $this->assertCount(2, $messages);
        $this->assertSame('TrackNGo: Document Ready for Release — RS-2026-0001', $messages[0]->getOriginalMessage()->getSubject());
        foreach ($messages as $message) {
            $this->assertStringContainsString('Good day, Ana Reyes.', $this->html($message));
            $this->assertStringContainsString('http://trackngo.test/track?tn=RS-2026-0001', $this->html($message));
            // Never the title, internal remarks or the staff page
            $this->assertStringNotContainsString('land dispute', $this->html($message) . $this->text($message));
            $this->assertStringNotContainsString('/documents/', $this->html($message));
        }
        // Applicants are not staff: no other email went out for this document
        $this->assertCount(2, $this->sent());
    }

    public function test_confidential_documents_never_show_their_title_in_email(): void
    {
        $doc = $this->internalDocument('Confidential');

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $message = $this->sent('ricardo@example.test')->sole();
        $this->assertStringContainsString('CEO-2026-0900', $this->html($message));
        $this->assertStringNotContainsString('Budget realignment', $this->html($message) . $this->text($message));
    }

    public function test_external_document_without_an_email_is_processed_without_email(): void
    {
        $doc = $this->externalDocument(null);

        $this->approveAndRelease($doc);

        $this->assertSame('completed', $doc->refresh()->status);
        $this->assertSame(0, EmailNotification::count());
        $this->assertCount(0, $this->sent());
    }

    public function test_returned_document_emails_the_person_who_must_correct_it_without_the_reason(): void
    {
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/return", ['reason' => 'Fix the amounts in item 4'])->assertSessionHasNoErrors();

        $email = EmailNotification::sole();
        $this->assertSame([DocumentEmailNotifier::RETURNED, $this->handler->id, 'sent'], [$email->notification_type, $email->user_id, $email->status]);
        $message = $this->sent('ricardo@example.test')->sole();
        $this->assertSame('TrackNGo: Document Returned for Correction — CEO-2026-0900', $message->getOriginalMessage()->getSubject());
        $this->assertStringContainsString('returned to you for correction by Michelle Tester', $this->text($message));
        $this->assertStringNotContainsString('Fix the amounts', $this->html($message) . $this->text($message));
    }

    public function test_arta_escalation_emails_the_handler_per_level_and_the_applicant_once_when_overdue(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-05 10:00', 'Asia/Manila')->utc());
        $doc = Document::forceCreate([
            'reference_number' => 'CEO-2026-0500', 'tracking_number' => 'RS-2026-0500', 'title' => 'Overdue request',
            'type_id' => $this->type->type_id, 'department_id' => $this->office->department_id, 'submitted_by' => $this->clerk->id,
            'classification' => 'normal', 'status' => 'Accepted', 'current_step_index' => 2, 'total_steps' => 7, 'is_internal' => false,
            'current_holder_id' => $this->handler->id, 'current_holder_department_id' => $this->office->department_id,
            'date_filed' => Carbon::parse('2026-06-01 09:00', 'Asia/Manila')->utc(),
        ]);
        DocumentClient::forceCreate([
            'document_id' => $doc->document_id, 'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes',
            'barangay' => 'Central', 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
            'contact_number' => '09171234567', 'email' => self::APPLICANT_EMAIL, 'receipt_mode' => 'Walk-in', 'purpose' => 'Permit',
        ]);
        $monitor = app(ArtaMonitor::class);

        $monitor->run();
        $monitor->run();
        $this->assertSame(ArtaEscalation::LEVEL_WARNING, ArtaEscalation::where('document_id', $doc->document_id)->value('escalation_level'));
        $this->assertCount(1, $this->sent('ricardo@example.test'));
        $this->assertCount(0, $this->sent(self::APPLICANT_EMAIL), 'applicants are not emailed at Warning');
        $this->assertStringContainsString('escalated (Warning)', $this->text($this->sent('ricardo@example.test')[0]));

        Carbon::setTestNow(Carbon::parse('2026-06-30 10:00', 'Asia/Manila')->utc());
        $monitor->run();
        $monitor->run();

        $this->assertTrue(ArtaEscalation::where('document_id', $doc->document_id)->where('escalation_level', ArtaEscalation::LEVEL_OVERDUE)->exists());
        $this->assertCount(ArtaEscalation::where('document_id', $doc->document_id)->count(), $this->sent('ricardo@example.test'), 'one email per escalation level');
        $applicant = $this->sent(self::APPLICANT_EMAIL)->sole();
        $this->assertSame('TrackNGo: Update on Your Document — RS-2026-0500', $applicant->getOriginalMessage()->getSubject());
        $this->assertStringNotContainsString('Overdue request', $this->html($applicant) . $this->text($applicant));
    }

    public function test_deemed_approval_emails_the_applicant_and_the_receiving_clerk(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-25 09:00', 'Asia/Manila')->utc());
        $this->fileExternal(self::APPLICANT_EMAIL, [['user_id' => $this->handler->id, 'signs' => true], ['user_id' => $this->mayor->id, 'signs' => true]])
            ->assertSessionHasNoErrors();
        $doc = Document::latest('document_id')->firstOrFail();

        Carbon::setTestNow(Carbon::parse('2026-12-02 08:00', 'Asia/Manila')->utc());
        $this->assertSame(['arta' => 1, 'lgc' => 0], app(DeemedApprovalService::class)->run());

        $this->assertSame('TrackNGo: Document Deemed Approved — ' . $doc->tracking_number, $this->sent(self::APPLICANT_EMAIL)->sole()->getOriginalMessage()->getSubject());
        $clerkMail = $this->sent('juan@example.test')->sole();
        $this->assertStringContainsString('waiting for you to release it', $this->text($clerkMail));
        $this->assertSame(1, EmailNotification::where('user_id', $this->clerk->id)->where('notification_type', DocumentEmailNotifier::DEEMED_APPROVED)->count());
    }

    // ── validation and normalization ────────────────────────────────────────────────────────────────

    public function test_email_addresses_are_normalized_and_malformed_ones_rejected(): void
    {
        $this->assertSame('juan.dela-cruz+x@gmail.com', EmailAddress::normalize('  Juan.Dela-Cruz+x@Gmail.COM '));
        foreach (['juan@@mati.gov.ph', 'juan @mati.gov.ph', 'juan@localhost', 'juan', 'juan@mati..ph', '', null] as $bad) {
            $this->assertNull(EmailAddress::normalize($bad), (string) $bad);
        }
        $this->assertSame('ju•••@gmail.com', EmailAddress::mask('juan.delacruz@gmail.com'));
    }

    public function test_the_receiving_clerk_registers_a_normalized_client_email_and_a_malformed_one_is_refused(): void
    {
        $route = [['user_id' => $this->handler->id, 'signs' => false]];

        $this->fileExternal('ana.reyes@@example', $route)->assertSessionHasErrors('client.email');
        $this->assertSame(0, Document::count());

        $this->fileExternal('  Ana.Reyes@Example.TEST ', $route)->assertSessionHasNoErrors();
        $this->assertSame(self::APPLICANT_EMAIL, DocumentClient::sole()->email);

        // The email is optional
        $this->fileExternal(null, $route)->assertSessionHasNoErrors();
        $this->assertSame(2, Document::count());
    }

    public function test_account_emails_are_normalized_and_malformed_ones_refused(): void
    {
        $hr = $this->makeUser('Hana', 'HR', $this->office, '09170000009');
        $payload = [
            'first_name' => 'New', 'last_name' => 'Person', 'password' => 'password123',
            'department_id' => $this->office->department_id, 'role_id' => $this->handler->role_id,
            'mobile_number' => '09171112222', 'signature' => self::SIGNATURE_PNG,
            'document_pin' => '246810', 'document_pin_confirmation' => '246810',
        ];

        $this->actingAs($hr)->post('/hr/employees', $payload + ['email' => 'new.person@@example'])->assertSessionHasErrors('email');
        $this->actingAs($this->admin)->post('/admin/users', $payload + ['email' => 'new person@example.test'])->assertSessionHasErrors('email');

        $this->actingAs($hr)->post('/hr/employees', $payload + ['email' => ' New.Person@Example.TEST '])->assertSessionHasNoErrors();
        $this->assertTrue(User::where('email', 'new.person@example.test')->exists());

        // The same mailbox in another spelling is a duplicate
        $this->actingAs($hr)->post('/hr/employees', $payload + ['email' => 'NEW.PERSON@example.test', 'mobile_number' => '09171113333'])
            ->assertSessionHasErrors('email');
    }

    // ── switch, idempotency, limits ─────────────────────────────────────────────────────────────────

    public function test_email_disabled_records_the_events_and_sends_nothing_while_in_app_notifications_still_work(): void
    {
        config(['services.email.enabled' => false]);
        $doc = $this->externalDocument();

        $this->approveAndRelease($doc);

        $this->assertCount(0, $this->sent());
        $this->assertSame(2, EmailNotification::where('status', EmailNotification::DISABLED)->count());
        $this->assertSame('completed', $doc->refresh()->status);
        $this->assertTrue(SystemNotification::where('document_id', $doc->document_id)->where('user_id', $this->clerk->id)->exists());
    }

    public function test_the_same_event_is_emailed_only_once(): void
    {
        $doc = $this->externalDocument();
        $this->approveAndRelease($doc);

        // Released again (double click) and the notifier called directly again
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release");
        app(DocumentEmailNotifier::class)->documentReleased($doc->refresh());
        app(DocumentEmailNotifier::class)->readyForPickup($doc);

        $this->assertSame(2, EmailNotification::count());
        $this->assertCount(2, $this->sent(self::APPLICANT_EMAIL));
    }

    public function test_a_send_job_that_runs_twice_sends_once(): void
    {
        Queue::fake();
        $email = app(EmailService::class)->notify('test', 'twice', 'someone@example.test', 'Someone', EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);

        // Sending happens in a queued job, never inside the request that caused the event
        Queue::assertPushed(SendEmailNotification::class, fn ($job) => $job->emailId === $email->id);
        $this->assertSame(EmailNotification::QUEUED, $email->refresh()->status);
        $this->assertCount(0, $this->sent());

        app(EmailService::class)->attempt($email->id);
        app(EmailService::class)->attempt($email->id);

        $this->assertCount(1, $this->sent());
        $this->assertSame([EmailNotification::SENT, 1], [$email->refresh()->status, $email->attempts]);
    }

    public function test_the_daily_cap_defers_emails_and_sends_them_when_the_cap_allows(): void
    {
        config(['services.email.max_per_day' => 2]);
        $service = app(EmailService::class);

        foreach (range(1, 3) as $i) {
            $service->notify('test', "cap:{$i}", "person{$i}@example.test", "Person {$i}", EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);
        }

        $this->assertCount(2, $this->sent());
        $deferred = EmailNotification::where('status', EmailNotification::DEFERRED)->sole();
        $this->assertStringContainsString('TRACKNGO_EMAIL_MAX_PER_DAY', $deferred->error_message);

        $this->assertSame(0, $service->sendDeferred(), 'still the same day');
        $this->artisan('email:send-pending')->assertSuccessful();
        $this->assertCount(2, $this->sent());

        $this->travel(1)->days();
        $this->assertSame(1, $service->sendDeferred());
        $this->assertSame(EmailNotification::SENT, $deferred->refresh()->status);
        $this->assertCount(3, $this->sent());
    }

    public function test_the_per_recipient_limit_stops_bulk_sends(): void
    {
        config(['services.email.max_per_recipient_per_day' => 2]);
        $service = app(EmailService::class);

        foreach (range(1, 4) as $i) {
            $service->notify('test', "loop:{$i}", 'same@example.test', 'Same', EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);
        }

        $this->assertCount(2, $this->sent());
        $this->assertSame(2, EmailNotification::where('status', EmailNotification::SKIPPED)->count());
        $this->assertStringContainsString('TRACKNGO_EMAIL_MAX_PER_RECIPIENT_PER_DAY', EmailNotification::where('status', 'skipped')->first()->error_message);
    }

    public function test_placeholder_domains_are_never_emailed_but_real_addresses_are(): void
    {
        config(['services.email.blocked_domains' => ['example.test']]);
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        $this->assertSame(EmailNotification::SKIPPED, EmailNotification::sole()->status);

        // An account moved to a real mailbox gets its email; it does not have to be the sending account
        $this->handler->forceFill(['email' => 'real.person@gmail.com'])->save();
        app(DocumentEmailNotifier::class)->documentReturned($doc, $this->handler, $this->mayor, 999);

        $this->assertCount(1, $this->sent('real.person@gmail.com'));
        $this->assertCount(1, $this->sent());
    }

    // ── mail server failures ────────────────────────────────────────────────────────────────────────

    public function test_missing_smtp_credentials_fail_the_email_without_connecting_and_the_workflow_continues(): void
    {
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => 'smtp.gmail.com', 'mail.mailers.smtp.username' => null, 'mail.mailers.smtp.password' => null]);
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $this->assertSame('completed', $doc->refresh()->status);
        $email = EmailNotification::sole();
        $this->assertSame(EmailNotification::FAILED, $email->status);
        $this->assertStringContainsString('MAIL_USERNAME and MAIL_PASSWORD', $email->error_message);
    }

    public function test_a_wrong_smtp_login_fails_once_and_never_reveals_the_credentials(): void
    {
        $transport = $this->scriptedMailer([new TransportException(
            'Failed to authenticate on SMTP server with username "sender.account@gmail.com" using the following authenticators: "LOGIN". '
            . 'Authenticator "LOGIN" returned "Expected response code "235" but got code "535", with message "535-5.7.8 Username and Password not accepted secret-app-password".',
            535
        )]);
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        app(EmailService::class)->attempt(EmailNotification::sole()->id);

        $email = EmailNotification::sole();
        $this->assertSame([EmailNotification::FAILED, 1], [$email->status, $email->attempts]);
        $this->assertStringContainsString('rejected the SMTP login', $email->error_message);
        $this->assertStringNotContainsString('secret-app-password', $email->error_message);
        $this->assertStringNotContainsString('sender.account@gmail.com', $email->error_message);
        $this->assertSame(1, $transport->sends, 'a wrong login is not retried');
    }

    public function test_a_refused_recipient_is_not_retried_and_the_address_is_not_echoed(): void
    {
        $transport = $this->scriptedMailer([new TransportException(
            'Expected response code "250/251/252" but got code "550", with message "550 5.1.1 The email account ricardo@example.test does not exist".',
            550
        )]);
        $doc = $this->internalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        app(EmailService::class)->attempt(EmailNotification::sole()->id);
        app(EmailService::class)->sendDeferred();

        $email = EmailNotification::sole();
        $this->assertSame(EmailNotification::FAILED, $email->status);
        $this->assertStringContainsString('SMTP 550', $email->error_message);
        $this->assertStringNotContainsString('ricardo@example.test', $email->error_message);
        $this->assertSame(1, $transport->sends);
    }

    public function test_temporary_failures_are_retried_with_backoff_on_the_same_record(): void
    {
        $transport = $this->scriptedMailer([
            new TransportException('Connection could not be established with host "smtp.gmail.com:587": timed out'),
            new TransportException('Expected response code "250" but got code "421", with message "421 4.7.0 Try again later".', 421),
            null,
        ]);
        $service = app(EmailService::class);

        $email = $service->notify('test', 'retry', 'someone@example.test', 'Someone', EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);

        $email->refresh();
        $this->assertSame([EmailNotification::QUEUED, 1], [$email->status, $email->attempts]);
        $this->assertTrue($email->next_attempt_at->isFuture());
        $this->assertStringContainsString('Could not reach the mail server', $email->error_message);

        $this->assertSame(300, $service->attempt($email->id), 'second failure waits 5 minutes');
        $this->assertNull($service->attempt($email->id));

        $email->refresh();
        $this->assertSame([EmailNotification::SENT, 3, null], [$email->status, $email->attempts, $email->error_message]);
        $this->assertSame(3, $transport->sends);
        $this->assertSame(1, EmailNotification::count());
    }

    public function test_it_gives_up_after_the_maximum_attempts(): void
    {
        $this->scriptedMailer(array_fill(0, 5, new TransportException('Connection reset by peer')));
        $service = app(EmailService::class);

        $email = $service->notify('test', 'give-up', 'someone@example.test', 'Someone', EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);
        $service->attempt($email->id);
        $service->attempt($email->id);
        $service->attempt($email->id);

        $email->refresh();
        $this->assertSame([EmailNotification::FAILED, 3], [$email->status, $email->attempts]);
        $this->assertStringContainsString('gave up after 3 attempts', $email->error_message);
    }

    public function test_the_providers_daily_sending_limit_defers_instead_of_failing(): void
    {
        $this->scriptedMailer([new TransportException(
            'Expected response code "250" but got code "550", with message "550 5.4.5 Daily user sending limit exceeded.".',
            550
        )]);

        $email = app(EmailService::class)->notify('test', 'quota', 'someone@example.test', 'Someone', EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);

        $email->refresh();
        $this->assertSame(EmailNotification::DEFERRED, $email->status);
        $this->assertTrue($email->next_attempt_at->greaterThan(now()->addHours(23)));
        $this->assertSame(0, app(EmailService::class)->sendDeferred(), 'not retried before the limit resets');
    }

    public function test_the_workflow_and_in_app_notifications_survive_any_email_failure(): void
    {
        $this->scriptedMailer(array_fill(0, 3, new \RuntimeException('Mailer exploded')));
        $doc = $this->externalDocument();

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();

        $this->assertSame('approved', $doc->refresh()->status);
        $this->assertTrue(SystemNotification::where('document_id', $doc->document_id)->where('user_id', $this->clerk->id)->exists());
        $this->assertSame(EmailNotification::FAILED, EmailNotification::sole()->status);
    }

    public function test_an_interrupted_send_is_marked_failed_and_not_resent(): void
    {
        Queue::fake();
        $email = app(EmailService::class)->notify('test', 'stuck', 'someone@example.test', 'Someone', EmailNotification::RECIPIENT_TEST, 'Subject', ['lines' => ['Hi']]);
        $email->forceFill(['status' => EmailNotification::SENDING, 'attempts' => 1])->save();

        $this->travel(11)->minutes();
        app(EmailService::class)->sendDeferred();

        $this->assertSame(EmailNotification::FAILED, $email->refresh()->status);
        $this->assertStringContainsString('Interrupted while sending', $email->error_message);
        $this->assertCount(0, $this->sent());
    }

    // ── administrator ───────────────────────────────────────────────────────────────────────────────

    public function test_the_admin_retries_a_failed_email_after_the_address_is_corrected(): void
    {
        $this->scriptedMailer([new TransportException('550 5.1.1 Recipient address rejected', 550)]);
        $doc = $this->internalDocument();
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        $email = EmailNotification::sole();
        $this->assertSame(EmailNotification::FAILED, $email->status);

        $this->useArrayMailer();
        $this->handler->forceFill(['email' => 'ricardo.new@example.test'])->save();
        $this->actingAs($this->admin)->post("/admin/notifications/email/{$email->id}/retry")->assertSessionHas('success');

        $email->refresh();
        $this->assertSame([EmailNotification::SENT, 'ricardo.new@example.test', 1], [$email->status, $email->recipient_email, $email->attempts]);
        $this->assertCount(1, $this->sent('ricardo.new@example.test'));

        // A sent email cannot be retried
        $this->actingAs($this->admin)->post("/admin/notifications/email/{$email->id}/retry")->assertSessionHas('error');
        $this->assertCount(1, $this->sent());
    }

    public function test_the_dashboard_masks_addresses_and_is_for_the_admin_only(): void
    {
        $this->approveAndRelease($this->externalDocument());

        $this->actingAs($this->admin)->get('/admin/notifications/email')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('admin/notifications/EmailDashboard')
                ->where('emailLogs.0.recipient_email', 'an•••@example.test')
                ->where('emailStatus.enabled', true)
                ->where('today.sent', 2)
                ->where('today.cap', 50)
                ->missing('emailStatus.password'));
        $this->assertStringNotContainsString(self::APPLICANT_EMAIL, $this->actingAs($this->admin)->get('/admin/notifications/email')->getContent());
        $this->assertStringNotContainsString('secret-app-password', $this->actingAs($this->admin)->get('/admin/notifications/email')->getContent());

        $this->actingAs($this->clerk)->get('/admin/notifications/email')->assertRedirect();
        $this->actingAs($this->clerk)->post('/admin/notifications/email/1/retry')->assertRedirect();
    }

    public function test_the_email_test_command_sends_through_the_same_log(): void
    {
        $this->artisan('email:test', ['address' => ' Real.Person@Gmail.com '])->assertSuccessful();
        $this->artisan('email:test', ['address' => 'not-an-email'])->assertFailed();

        $this->assertCount(1, $this->sent('real.person@gmail.com'));
        $this->assertSame(DocumentEmailNotifier::TEST, EmailNotification::sole()->notification_type);
    }
}

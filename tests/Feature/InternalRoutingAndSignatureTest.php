<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Internal documents pass through the Receiving Clerk (register only) to the person the sender chose;
 * confidential contents never reach the clerk; required signatories must sign and the final signed copy
 * must exist before the document can be completed.
 */
class InternalRoutingAndSignatureTest extends TestCase
{
    use RefreshDatabase;

    /** 1x1 transparent PNG */
    private const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $clerk;
    private User $sender;
    private User $colleague;
    private User $recipient;
    private User $mayor;
    private DocumentType $type;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->withoutVite();

        $records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $engineering = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $health = Department::create(['department_name' => 'City Health Office', 'code' => 'CHO', 'is_active' => true]);
        $mayorOffice = Department::create(['department_name' => 'Office of the City Mayor', 'code' => 'OCM', 'is_active' => true]);

        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $records);
        $this->sender = $this->makeUser('Ricardo', 'Department Head', $engineering);
        $this->colleague = $this->makeUser('Lea', 'HR', $engineering);
        $this->recipient = $this->makeUser('Elena', 'Department Head', $health);
        $this->mayor = $this->makeUser('Michelle', 'Mayor', $mayorOffice);
        $this->type = DocumentType::create(['type_name' => 'Memorandum', 'arta_processing_days' => 3, 'is_active' => true]);
    }

    /** Signatures are registered by HR when the account is created */
    private function makeUser(string $firstName, string $roleName, Department $department, ?string $signature = self::SIGNATURE_PNG): User
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
            'signature'     => $signature,
        ]);
    }

    private function fileDocument(User $sender, array $overrides = []): Document
    {
        $this->actingAs($sender)->post('/documents', array_merge([
            'title'          => 'Salary Adjustment Memo',
            'type_id'        => $this->type->type_id,
            'department_id'  => $sender->department_id,
            'file'           => UploadedFile::fake()->create('memo.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'forward_to'     => $this->recipient->department_id,
            'forward_to_user' => $this->recipient->id,
            'instruction'    => 'Please review the attached adjustments.',
        ], $overrides))->assertSessionHasNoErrors();

        return Document::latest('document_id')->firstOrFail();
    }

    public function test_staff_documents_always_pass_through_the_clerk_to_the_chosen_person(): void
    {
        // Ticking nothing still makes it internal: it goes to the clerk first
        $doc = $this->fileDocument($this->sender, ['is_internal' => false, 'forward_to' => $this->sender->department_id, 'forward_to_user' => $this->colleague->id]);

        $this->assertTrue($doc->is_internal);
        $this->assertSame($this->clerk->id, $doc->current_holder_id);
        $this->assertSame($this->colleague->id, $doc->destination_user_id);

        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/register")->assertSessionHasNoErrors();
        $doc->refresh();

        // Same office: lands on the colleague, not back on the sender
        $this->assertSame($this->colleague->id, $doc->current_holder_id);
        $this->assertSame('registered', $doc->status);
        $this->assertNotNull($doc->tracking_number);
        $this->assertSame('Please review the attached adjustments.', $doc->routingSlips()->where('action', 'register')->value('instruction'));
    }

    public function test_same_office_document_requires_a_named_person(): void
    {
        $this->actingAs($this->sender)->post('/documents', [
            'title'          => 'Internal Memo',
            'type_id'        => $this->type->type_id,
            'department_id'  => $this->sender->department_id,
            'file'           => UploadedFile::fake()->create('memo.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'forward_to'     => $this->sender->department_id,
        ])->assertSessionHasErrors('forward_to_user');
    }

    public function test_receiving_clerk_cannot_be_a_signatory(): void
    {
        $this->actingAs($this->sender)->post('/documents', [
            'title'          => 'Internal Memo',
            'type_id'        => $this->type->type_id,
            'department_id'  => $this->sender->department_id,
            'file'           => UploadedFile::fake()->create('memo.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'forward_to'     => $this->recipient->department_id,
            'signatories'    => [$this->clerk->id],
        ])->assertSessionHasErrors('signatories');
    }

    public function test_confidential_contents_are_hidden_from_the_clerk_but_not_the_route(): void
    {
        $doc = $this->fileDocument($this->sender, ['classification' => 'Confidential']);
        $id = $doc->document_id;
        $this->actingAs($this->sender)->post("/documents/{$id}/comments", ['comment' => 'Budget lines 4-7 are final.'])->assertSessionHasNoErrors();

        // Clerk: metadata and trail only
        $this->actingAs($this->clerk)->get("/receiving/documents/{$id}")
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('dbDocument.title', 'Confidential Document')
                ->where('dbDocument.attachment_path', null)
                ->where('dbDocument.ocr_text', null)
                ->where('dbDocument.is_confidential_hidden', true)
                ->where('dbDocument.reference_number', $doc->reference_number)
                ->where('dbComments', [])
                ->where('dbAttachments', [])
                ->where('dbAuditTrail', fn ($trail) => collect($trail)->every(fn ($row) => !str_contains($row['description'], 'Budget lines'))));

        $this->get('/receiving/documents')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('dbDocuments.0.title', 'Confidential Document')
            ->where('dbDocuments.0.attachment_path', null));

        $this->getJson("/documents/{$id}/comments")->assertExactJson([]);
        $this->postJson("/documents/{$id}/export", ['password' => 'password'])->assertForbidden();
        $this->post("/documents/{$id}/comments", ['comment' => 'peek'])->assertForbidden();

        // The clerk still registers it for the record
        $this->post("/documents/{$id}/register")->assertSessionHasNoErrors();
        $this->assertSame($this->recipient->id, $doc->refresh()->current_holder_id);

        // Sender and recipient open it
        foreach ([$this->sender, $this->recipient] as $viewer) {
            $this->actingAs($viewer)->get("/department-head/documents/{$id}")
                ->assertInertia(fn (AssertableInertia $page) => $page
                    ->where('dbDocument.title', 'Salary Adjustment Memo')
                    ->where('dbDocument.is_confidential_hidden', false)
                    ->has('dbComments', 1));
        }

        // Someone outside the route does not
        $this->assertFalse($doc->refresh()->contentsVisibleTo($this->mayor));
    }

    public function test_registered_signatures_are_stamped_automatically_when_signatories_approve(): void
    {
        // The sender lists themself first: signing happens by submitting it
        $doc = $this->fileDocument($this->sender, ['signatories' => [$this->sender->id, $this->recipient->id, $this->mayor->id]]);
        $id = $doc->document_id;
        $this->assertTrue($doc->requires_signature);
        $this->assertSame([$this->sender->id, $this->recipient->id, $this->mayor->id], $doc->signatories->pluck('user_id')->all());
        $this->assertNotNull($doc->signatories()->where('user_id', $this->sender->id)->value('signed_at'));

        $this->actingAs($this->clerk)->post("/documents/{$id}/register")->assertSessionHasNoErrors();

        // Recipient: forwarding is their approval, so their HR signature is stamped with it
        $this->actingAs($this->recipient)->post("/documents/{$id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$id}/review")->assertSessionHasNoErrors();
        $this->post("/documents/{$id}/endorse", ['destination_type' => 'user', 'destination_id' => $this->mayor->id])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('signature_stamped', true);

        $stamp = $doc->signatories()->where('user_id', $this->recipient->id)->first()->signature;
        $this->assertNotNull($stamp);
        $this->assertSame(self::SIGNATURE_PNG, $stamp->signature_image, 'The HR-registered signature is the one stamped');

        // Once forwarded, the recipient can no longer act on it
        $this->post("/documents/{$id}/review")->assertForbidden();
        $this->post("/documents/{$id}/link", ['tracking_number' => $doc->refresh()->tracking_number])->assertForbidden();

        // Mayor: the final approval stamps the last signature and completes the internal document right away
        $this->actingAs($this->mayor)->post("/documents/{$id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$id}/review")->assertSessionHasNoErrors();
        $this->post("/documents/{$id}/approve-route")->assertSessionHasNoErrors()->assertSessionHas('signature_stamped', true);
        $doc->refresh();
        $this->assertSame('completed', $doc->status);
        $this->assertNull($doc->current_holder_id, 'No release by the Receiving Clerk is needed');
        $this->assertNotNull($doc->completed_at);
        $this->assertSame(0, $doc->signatories()->whereNull('signed_at')->count());
        $this->assertSame(3, $doc->signatures()->count());

        // The finished document goes back to the sender, who is notified
        $this->assertSame($this->sender->id, $doc->routingSlips()->where('action', 'approve')->value('to_user_id'));
        $this->assertTrue(\App\Models\SystemNotification::where('user_id', $this->sender->id)->where('title', 'Document Approved & Completed')->exists());

        // The first signed copy attached is kept (other open browsers building it too are ignored)
        $this->postJson("/documents/{$id}/signed-copy", ['file' => UploadedFile::fake()->create('signed.pdf', 30, 'application/pdf')])->assertOk();
        $signedPath = $doc->refresh()->signed_file_path;
        Storage::disk('public')->assertExists($signedPath);
        $this->actingAs($this->sender)->postJson("/documents/{$id}/signed-copy", ['file' => UploadedFile::fake()->create('again.pdf', 30, 'application/pdf')])->assertOk();
        $this->assertSame($signedPath, $doc->refresh()->signed_file_path);
        $this->assertSame(1, \App\Models\AuditTrail::where('document_id', $id)->where('action', 'Final Signed Copy Generated')->count());

        // Sender, recipient and Mayor still find the finished document in their own lists
        $this->actingAs($this->sender)->get('/department-head/documents')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('dbDocuments', fn ($docs) => collect($docs)->contains(fn ($d) => $d['document_id'] === $id && $d['status'] === 'completed')));
        $this->actingAs($this->recipient)->get('/department-head/documents')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('dbDocuments', fn ($docs) => collect($docs)->contains('document_id', $id)));
        $this->actingAs($this->mayor)->get('/mayor/documents')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('dbDocuments', fn ($docs) => collect($docs)->contains('document_id', $id)));

        // ...and the sender opens it on the signed copy
        $this->actingAs($this->sender)->get("/department-head/documents/{$id}")->assertInertia(fn (AssertableInertia $page) => $page
            ->where('dbDocument.signed_file_path', $signedPath)
            ->where('dbDocument.status', 'completed'));
    }

    public function test_external_documents_still_go_to_the_clerk_for_release(): void
    {
        $doc = Document::forceCreate([
            'reference_number'             => 'CHO-2026-0001',
            'tracking_number'              => 'RS-2026-0001',
            'title'                        => 'Business Permit Request',
            'type_id'                      => $this->type->type_id,
            'department_id'                => $this->recipient->department_id,
            'submitted_by'                 => $this->clerk->id,
            'classification'               => 'normal',
            'status'                       => 'Ongoing',
            'current_step_index'           => 6,
            'total_steps'                  => 7,
            'current_holder_id'            => $this->mayor->id,
            'current_holder_department_id' => $this->mayor->department_id,
            'is_internal'                  => false,
            'date_filed'                   => now(),
        ]);

        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-route")->assertSessionHasNoErrors();
        $doc->refresh();
        $this->assertSame('approved', $doc->status);
        $this->assertSame($this->clerk->id, $doc->current_holder_id);

        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasNoErrors();
        $this->assertSame('completed', $doc->refresh()->status);
    }

    public function test_public_tracking_shows_progress_without_personal_details(): void
    {
        $doc = $this->fileDocument($this->sender);
        $this->actingAs($this->sender)->post("/documents/{$doc->document_id}/comments", ['comment' => 'Private note about salaries'])->assertSessionHasNoErrors();
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/register")->assertSessionHasNoErrors();
        $tracking = $doc->refresh()->tracking_number;

        auth()->logout();
        $response = $this->getJson('/api/track/' . strtolower($tracking))->assertOk();

        $response->assertJsonPath('document.tracking_number', $tracking);
        $body = $response->getContent();
        $this->assertStringNotContainsString('@example.test', $body, 'No staff e-mail addresses');
        $this->assertStringNotContainsString('Private note', $body, 'No comments');
        $this->assertStringNotContainsString('ip_address', $body);
        $this->assertSame(['Register', 'Submit'], collect($response->json('auditTrail'))->pluck('action')->all());
    }

    public function test_qr_codes_point_to_the_configured_tracking_address(): void
    {
        config(['app.tracking_url' => 'http://192.168.1.50:8000/']);

        $this->actingAs($this->sender)->get('/department-head/documents')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('tracking.base_url', 'http://192.168.1.50:8000'));
    }

    public function test_route_to_clerk_waits_for_other_signatories(): void
    {
        $doc = $this->fileDocument($this->sender, ['signatories' => [$this->mayor->id]]);
        $id = $doc->document_id;
        $this->actingAs($this->clerk)->post("/documents/{$id}/register")->assertSessionHasNoErrors();

        $this->actingAs($this->recipient)->post("/documents/{$id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$id}/review")->assertSessionHasNoErrors();
        // The recipient is not a signatory, and the Mayor has not signed yet
        $this->post("/documents/{$id}/approve-route")->assertSessionHasErrors('signature');
    }

    public function test_signatories_need_a_registered_signature(): void
    {
        $unsigned = $this->makeUser('Nora', 'Department Head', Department::where('code', 'CHO')->first(), null);

        $this->actingAs($this->sender)->post('/documents', [
            'title'          => 'Internal Memo',
            'type_id'        => $this->type->type_id,
            'department_id'  => $this->sender->department_id,
            'file'           => UploadedFile::fake()->create('memo.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'forward_to'     => $this->recipient->department_id,
            'signatories'    => [$unsigned->id],
        ])->assertSessionHasErrors('signatories');
    }

    public function test_return_goes_one_step_back_and_lets_that_person_act_again(): void
    {
        $doc = $this->fileDocument($this->sender);
        $id = $doc->document_id;
        $this->actingAs($this->clerk)->post("/documents/{$id}/register")->assertSessionHasNoErrors();
        $this->actingAs($this->recipient)->post("/documents/{$id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$id}/endorse", ['destination_type' => 'user', 'destination_id' => $this->mayor->id])->assertSessionHasNoErrors();
        $this->actingAs($this->mayor)->post("/documents/{$id}/accept")->assertSessionHasNoErrors();

        // Mayor returns it: back to the recipient who forwarded it, not the original sender
        $this->post("/documents/{$id}/return", ['reason' => 'Missing budget annex'])->assertSessionHasNoErrors();
        $this->assertSame($this->recipient->id, $doc->refresh()->current_holder_id);
        $this->assertSame('Returned', $doc->status);

        // The recipient holds it again and may return it further back (the clerk's registration is skipped)
        $this->actingAs($this->recipient)->post("/documents/{$id}/return", ['reason' => 'Please attach the annex'])->assertSessionHasNoErrors();
        $this->assertSame($this->sender->id, $doc->refresh()->current_holder_id);

        // The sender is where it started, so there is no one further back
        $this->actingAs($this->sender)->post("/documents/{$id}/return", ['reason' => 'x'])->assertSessionHasErrors('reason');
    }

    public function test_staff_always_file_from_their_own_office(): void
    {
        $doc = $this->fileDocument($this->sender, ['department_id' => $this->recipient->department_id]);

        $this->assertSame($this->sender->department_id, $doc->department_id);
        $this->assertStringStartsWith('CEO-', $doc->reference_number);
    }

    public function test_only_viewable_file_types_are_accepted(): void
    {
        $this->actingAs($this->sender)->post('/documents', [
            'title'          => 'Old Word File',
            'type_id'        => $this->type->type_id,
            'department_id'  => $this->sender->department_id,
            'file'           => UploadedFile::fake()->create('memo.doc', 20, 'application/msword'),
            'classification' => 'normal',
            'forward_to'     => $this->recipient->department_id,
        ])->assertSessionHasErrors('file');
    }
}

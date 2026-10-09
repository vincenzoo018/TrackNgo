<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\DigitalSignature;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentRevision;
use App\Models\DocumentType;
use App\Models\Role;
use App\Models\User;
use App\Services\Document\DocumentRoute;
use App\Services\Document\DocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Edit Metadata and document versions: who may do it (role, holder, status) checked on direct requests, which
 * fields can change, that no file is ever overwritten, that signatures stay with the version they were made on
 * (a new version is signed again) and that every change is in the audit trail.
 */
class DocumentRevisionTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $clerk;
    private User $mayor;
    private User $engineer;
    private User $cart;
    private DocumentType $permit;
    private DocumentType $license;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local'); // document files are private
        $this->withoutVite();
        $this->withoutDefer();

        foreach ([
            'clerk'    => ['Receiving Clerk', 'Records Office'],
            'mayor'    => ['Mayor', 'Office of the City Mayor'],
            'engineer' => ['Department Head', "City Engineer's Office"],
            'cart'     => ['CART', 'CART Monitoring Unit'],
        ] as $key => [$roleName, $office]) {
            $role = Role::firstOrCreate(['role_name' => $roleName], ['position' => $roleName]);
            $department = Department::create(['department_name' => $office, 'code' => strtoupper($key), 'is_active' => true]);
            $this->{$key} = User::forceCreate([
                'first_name' => ucfirst($key), 'last_name' => 'Staff', 'email' => "{$key}@example.test", 'password' => Hash::make('password'),
                'role_id' => $role->role_id, 'department_id' => $department->department_id, 'is_active' => true, 'signature' => self::SIGNATURE_PNG,
            ]);
        }
        $this->permit = DocumentType::create(['type_name' => 'Permit', 'arta_processing_days' => 5, 'is_active' => true]);
        $this->license = DocumentType::create(['type_name' => 'License', 'arta_processing_days' => 7, 'is_active' => true]);
    }

    /** The clerk files an external document routed to $route, in order, every one of them signing */
    private function fileDocument(User ...$route): Document
    {
        return app(DocumentService::class)->createDocument([
            'title' => 'Building Permit Application', 'type_id' => $this->permit->type_id, 'classification' => 'normal',
            'department_id' => $route[0]->department_id, 'forward_to' => $route[0]->department_id, 'forward_to_user' => $route[0]->id,
            'signatories' => array_map(fn (User $user) => $user->id, $route),
            'route' => array_map(fn (User $user) => ['user_id' => $user->id, 'signs' => true], $route),
            'client' => [
                'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes', 'barangay' => 'Central',
                'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental', 'contact_number' => '09171234567',
                'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
            ],
        ], UploadedFile::fake()->createWithContent('permit.pdf', '%PDF-1.4 original permit'), $this->clerk);
    }

    private function approve(User $user, Document $doc): void
    {
        $this->actingAs($user)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$doc->document_id}/approve-next")->assertSessionHasNoErrors();
    }

    private function editDetails(User $user, Document $doc, array $data): TestResponse
    {
        return $this->actingAs($user)->putJson("/documents/{$doc->document_id}/metadata", $data);
    }

    private function uploadVersion(User $user, Document $doc, string $content = '%PDF-1.4 corrected permit', ?string $reason = 'Corrected the lot number'): TestResponse
    {
        return $this->actingAs($user)->postJson("/documents/{$doc->document_id}/revisions", array_filter([
            'file'   => UploadedFile::fake()->createWithContent('permit-corrected.pdf', $content),
            'reason' => $reason,
        ]));
    }

    public function test_details_are_edited_by_whoever_handles_the_document_and_every_change_is_audited(): void
    {
        $doc = $this->fileDocument($this->mayor, $this->engineer);
        $original = $doc->only(['tracking_number', 'reference_number', 'submitted_by', 'date_filed']);

        // The clerk filed it and the Mayor has not received it yet: the clerk can still fix what was entered
        $this->editDetails($this->clerk, $doc, [
            'title'            => 'Building Permit Application (Lot 12)',
            'type_id'          => $this->license->type_id,
            'client'           => ['contact_number' => '0918 765 4321'],
            // Protected fields are ignored
            'tracking_number'  => 'HACKED-0001',
            'reference_number' => 'HACKED',
            'submitted_by'     => $this->mayor->id,
        ])->assertOk()->assertJson(['message' => '3 details updated.']);

        $doc->refresh();
        $this->assertSame('Building Permit Application (Lot 12)', $doc->title);
        $this->assertSame($this->license->type_id, $doc->type_id);
        $this->assertSame('09187654321', $doc->client->contact_number);
        $this->assertSame('09187654321', $doc->contact_number); // the SMS number follows
        $this->assertEquals($original, $doc->only(['tracking_number', 'reference_number', 'submitted_by', 'date_filed']));

        $audit = AuditTrail::where('document_id', $doc->document_id)->where('action', 'Metadata Updated')->sole();
        $this->assertSame($this->clerk->id, $audit->user_id);
        $this->assertStringContainsString('Title: "Building Permit Application" → "Building Permit Application (Lot 12)"', $audit->description);
        $this->assertStringContainsString('Document Type: Permit → License', $audit->description);
        $this->assertStringContainsString('Contact Number: "09171234567" → "09187654321"', $audit->description);

        $this->editDetails($this->clerk, $doc, ['title' => $doc->title])->assertStatus(422)->assertJsonValidationErrors('metadata');
        $this->editDetails($this->clerk, $doc, ['client' => ['contact_number' => '12345']])->assertStatus(422);

        // Once the Mayor receives it, it is out of the clerk's hands
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->editDetails($this->clerk, $doc, ['title' => 'Changed'])->assertForbidden();
        $this->editDetails($this->mayor, $doc, ['title' => 'Changed'])->assertForbidden();    // the Mayor's role does not edit details
        $this->editDetails($this->engineer, $doc, ['title' => 'Changed'])->assertForbidden(); // not holding it
        $this->editDetails($this->cart, $doc, ['title' => 'Changed'])->assertForbidden();     // CART only monitors
        $this->assertSame('Building Permit Application (Lot 12)', $doc->refresh()->title);
    }

    public function test_a_signed_version_keeps_its_content_but_contact_details_stay_editable(): void
    {
        $doc = $this->fileDocument($this->engineer, $this->mayor);
        $this->approve($this->engineer, $doc); // the engineer signs
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/return", ['reason' => 'Wrong contact number'])->assertSessionHasNoErrors();
        $this->assertSame($this->engineer->id, $doc->refresh()->current_holder_id);

        $this->editDetails($this->engineer, $doc, ['title' => 'Another title'])
            ->assertForbidden()
            ->assertJson(['message' => 'This version has been signed, so only the contact details can still be changed.']);
        $this->editDetails($this->engineer, $doc, ['client' => ['contact_number' => '09998887777', 'email' => 'ana@example.test']])->assertOk();
        $this->assertSame('09998887777', $doc->refresh()->client->contact_number);

        $doc->forceFill(['status' => 'completed'])->save();
        $this->editDetails($this->engineer, $doc, ['client' => ['email' => 'other@example.test']])->assertForbidden();
    }

    public function test_a_new_version_never_overwrites_an_earlier_file_and_does_not_move_the_document(): void
    {
        $doc = $this->fileDocument($this->engineer, $this->mayor);
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $before = $doc->refresh()->only(['status', 'current_holder_id', 'current_step_index', 'tracking_number']);
        $originalPath = $doc->attachment_path;

        $this->uploadVersion($this->engineer, $doc, '%PDF-1.4 corrected', null)->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->actingAs($this->engineer)->postJson("/documents/{$doc->document_id}/revisions", ['reason' => 'No file attached'])
            ->assertStatus(422)->assertJsonValidationErrors('file');
        $this->uploadVersion($this->engineer, $doc)->assertOk()->assertJson(['version_number' => 2]);
        $this->uploadVersion($this->engineer, $doc, '%PDF-1.4 third', 'Added the missing page')->assertOk()->assertJson(['version_number' => 3]);

        $doc->refresh();
        $versions = DocumentRevision::where('document_id', $doc->document_id)->orderBy('version_number')->get();
        $this->assertSame([1, 2, 3], $versions->pluck('version_number')->all());
        $this->assertSame(['Original submission', 'Corrected the lot number', 'Added the missing page'], $versions->pluck('revision_reason')->all());
        $this->assertSame([$this->clerk->id, $this->engineer->id, $this->engineer->id], $versions->pluck('created_by')->all());

        // Every version is its own file; the original is untouched
        $this->assertSame($originalPath, $versions[0]->file_path);
        $this->assertSame('%PDF-1.4 original permit', Storage::disk('local')->get($versions[0]->file_path));
        $this->assertSame('%PDF-1.4 corrected permit', Storage::disk('local')->get($versions[1]->file_path));
        $this->assertSame($versions[2]->file_path, $doc->attachment_path);
        $this->assertSame('v3.0', $doc->version);
        $this->assertSame(hash('sha256', '%PDF-1.4 original permit'), $versions[0]->file_hash);

        // Uploading a version approves nothing and moves nothing
        $this->assertEquals($before, $doc->only(['status', 'current_holder_id', 'current_step_index', 'tracking_number']));
        $this->assertSame(2, AuditTrail::where('document_id', $doc->document_id)->where('action', 'Revision Created')->count());

        // Earlier versions stay downloadable (document PIN checked)
        $this->engineer->forceFill(['document_pin' => Hash::make('135790')])->save();
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/export", ['pin' => '135790', 'revision_id' => $versions[0]->revision_id])
            ->assertOk()->assertDownload("Document_{$doc->reference_number}_v1.pdf");
        $page = $this->actingAs($this->engineer)->get("/department-head/documents/{$doc->document_id}/versions")->assertOk();
        $this->assertSame(3, $page->viewData('page')['props']['revisions']['current']);
    }

    public function test_only_the_holder_with_a_permitted_role_can_upload_a_new_version(): void
    {
        $doc = $this->fileDocument($this->engineer, $this->mayor); // with the engineer

        $this->uploadVersion($this->mayor, $doc)->assertForbidden(); // not holding it
        $this->uploadVersion($this->clerk, $doc)->assertForbidden(); // the clerk only for documents returned to them
        $this->uploadVersion($this->cart, $doc)->assertForbidden();
        $this->assertSame(1, DocumentRevision::where('document_id', $doc->document_id)->count());

        // Returned to the clerk (the client brings a corrected file): now the clerk may
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/return", ['reason' => 'Unsigned application form'])->assertSessionHasNoErrors();
        $this->assertSame($this->clerk->id, $doc->refresh()->current_holder_id);
        $this->uploadVersion($this->clerk, $doc)->assertOk();

        $doc->forceFill(['status' => 'completed'])->save();
        $this->uploadVersion($this->clerk, $doc)->assertForbidden();
        $this->assertSame(2, DocumentRevision::where('document_id', $doc->document_id)->count());
    }

    public function test_signatures_stay_with_their_version_and_the_new_version_is_signed_again(): void
    {
        $doc = $this->fileDocument($this->mayor, $this->engineer);
        $this->approve($this->mayor, $doc); // the Mayor signs Version 1
        Storage::disk('local')->put('documents/signed/v1.pdf', '%PDF signed v1');
        $doc->forceFill(['signed_file_path' => 'documents/signed/v1.pdf', 'signed_copy_signatures' => 1])->save();

        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->uploadVersion($this->engineer, $doc)->assertOk()
            ->assertJson(['message' => 'Version 2 is now the current file. The signatories sign this version again as it reaches them.']);

        $doc->refresh();
        [$v1, $v2] = DocumentRevision::where('document_id', $doc->document_id)->orderBy('version_number')->get()->all();
        $this->assertSame(['documents/signed/v1.pdf', 1], [$v1->signed_file_path, $v1->signed_copy_signatures]); // kept with Version 1
        $this->assertNull($doc->signed_file_path);
        $this->assertSame(0, $doc->signatories()->whereNotNull('signed_at')->count());
        $this->assertSame($v1->revision_id, DigitalSignature::where('signed_by_user_id', $this->mayor->id)->sole()->revision_id);
        $this->assertTrue(Storage::disk('local')->exists('documents/signed/v1.pdf'));

        // The engineer signs Version 2, and the route takes it back to the Mayor to sign it too
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/approve-next")->assertSessionHasNoErrors();
        $this->assertSame($this->mayor->id, $doc->refresh()->current_holder_id);
        $this->approve($this->mayor, $doc);
        $doc->refresh();
        $this->assertSame(['approved', $this->clerk->id], [$doc->status, $doc->current_holder_id]);
        $this->assertSame(2, DigitalSignature::where('revision_id', $v2->revision_id)->count());

        // The progress bar keeps one step per person: signing the new version again does not add steps
        $steps = collect(app(DocumentRoute::class)->steps($doc))->map(fn ($s) => "{$s['label']}:{$s['actor']}")->all();
        $this->assertSame(['Submitted:Clerk Staff', 'Signed:Mayor Staff', 'Signed:Engineer Staff', 'Release:Clerk Staff'], $steps);

        // A copy stamped on Version 1 is refused; the copy of Version 2 is the final one
        $copy = fn (int $version) => $this->actingAs($this->clerk)->postJson("/documents/{$doc->document_id}/signed-copy", [
            'file' => UploadedFile::fake()->createWithContent('signed.pdf', '%PDF signed'), 'signatures' => 2, 'version' => $version,
        ]);
        $copy(1)->assertStatus(422)->assertJsonValidationErrors('file');
        $copy(2)->assertOk();
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasNoErrors();
        $this->assertSame('completed', $doc->refresh()->status);
    }

    public function test_a_returned_document_is_corrected_with_a_new_version_and_its_holder_signs_it(): void
    {
        $doc = $this->fileDocument($this->mayor, $this->engineer);
        $this->approve($this->mayor, $doc);
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$doc->document_id}/return", ['reason' => 'Wrong lot number'])->assertSessionHasNoErrors();
        $this->assertSame($this->mayor->id, $doc->refresh()->current_holder_id);

        $correction = fn (array $data) => $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/resubmit", $data + [
            'mode' => 'version', 'main_file' => UploadedFile::fake()->createWithContent('permit-fixed.pdf', '%PDF-1.4 fixed'),
        ]);
        $correction([])->assertSessionHasErrors('note');
        $correction(['note' => 'Corrected the lot number'])->assertSessionHasNoErrors();

        $doc->refresh();
        $this->assertSame(['Sent', $this->engineer->id, 'v2.0'], [$doc->status, $doc->current_holder_id, $doc->version]);
        $v2 = DocumentRevision::where('document_id', $doc->document_id)->where('version_number', 2)->sole();
        $this->assertSame($v2->file_path, $doc->attachment_path);
        // The Mayor signed Version 1, so sending the corrected version on signs it
        $mayorSignature = DigitalSignature::where('signed_by_user_id', $this->mayor->id)->latest('signature_id')->first();
        $this->assertSame($v2->revision_id, $mayorSignature->revision_id);
        $this->assertStringContainsString('as Version 2', $doc->routingSlips()->where('action', 'resubmit')->sole()->instruction);

        // Nobody has to go back to the Mayor: the engineer's approval is the last one
        $this->approve($this->engineer, $doc);
        $this->assertSame('approved', $doc->refresh()->status);
    }
}

<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DocumentType;
use App\Models\Role;
use App\Models\User;
use App\Services\Document\DocumentNumberGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Who may manage which account (only an Administrator creates or changes Administrator accounts; nobody changes
 * their own role, office or status), deactivation instead of deletion, private document files, involved-only
 * visibility, and an audit trail the browser cannot forge.
 */
class AccountAndAccessTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $admin;
    private User $hr;
    private User $clerk;
    private User $engineer;
    private User $health;
    private Role $adminRole;
    private Role $headRole;
    private Department $records;
    private Department $engineering;
    private string $barangay;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->withoutVite();
        $this->withoutDefer();

        $this->records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $this->engineering = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $healthOffice = Department::create(['department_name' => 'City Health Office', 'code' => 'CHO', 'is_active' => true]);
        $hrOffice = Department::create(['department_name' => 'Human Resource Office', 'code' => 'CHRMO', 'is_active' => true]);

        $this->adminRole = Role::firstOrCreate(['role_name' => 'Admin'], ['position' => 'Admin']);
        $this->headRole = Role::firstOrCreate(['role_name' => 'Department Head'], ['position' => 'Department Head']);
        $this->admin = $this->makeUser('Ada', 'Admin', $this->records);
        $this->hr = $this->makeUser('Hana', 'HR', $hrOffice);
        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $this->records);
        $this->engineer = $this->makeUser('Ricardo', 'Department Head', $this->engineering);
        $this->health = $this->makeUser('Elena', 'Department Head', $healthOffice);
        DocumentType::create(['type_name' => 'Permit', 'arta_processing_days' => 3, 'service_category' => 'simple', 'is_active' => true]);

        if (!DB::table('ph_provinces')->where('name', 'Davao Oriental')->exists()) {
            DB::table('ph_provinces')->insert(['code' => '112500000', 'name' => 'Davao Oriental']);
            DB::table('ph_cities')->insert(['code' => '112505000', 'name' => 'City of Mati', 'province_code' => '112500000', 'is_city' => true]);
            DB::table('ph_barangays')->insert(['code' => '1125050001', 'name' => 'Central', 'city_code' => '112505000']);
        }
        $province = DB::table('ph_provinces')->where('name', 'Davao Oriental')->first();
        $city = DB::table('ph_cities')->where('province_code', $province->code)->where('name', 'City of Mati')->first();
        $this->barangay = DB::table('ph_barangays')->where('city_code', $city->code)->value('name');
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
            'signature'     => self::SIGNATURE_PNG,
        ]);
    }

    private function employeePayload(array $overrides = []): array
    {
        return array_merge([
            'first_name'    => 'New',
            'last_name'     => 'Person',
            'email'         => 'new.person@example.test',
            'password'      => 'password123',
            'department_id' => $this->engineering->department_id,
            'role_id'       => $this->headRole->role_id,
            'mobile_number' => '09171112222',
            'signature'     => self::SIGNATURE_PNG,
            'document_pin'  => '246810',
            'document_pin_confirmation' => '246810',
        ], $overrides);
    }

    private function filingPayload(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'Building Permit', 'type_id' => DocumentType::first()->type_id, 'department_id' => $this->clerk->department_id,
            'file' => UploadedFile::fake()->create('permit.pdf', 20, 'application/pdf'), 'classification' => 'normal',
            'route' => [['user_id' => $this->engineer->id, 'signs' => false]],
            'client' => [
                'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes',
                'barangay' => $this->barangay, 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
                'contact_number' => '09171234567', 'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
            ],
        ];
    }

    private function fileDocument(array $overrides = []): Document
    {
        $this->actingAs($this->clerk)->post('/documents', $this->filingPayload($overrides))->assertSessionHasNoErrors();

        return Document::latest('document_id')->firstOrFail();
    }

    // ── Accounts ─────────────────────────────────────────────────────────────────────────────────────

    public function test_hr_cannot_create_an_administrator_account(): void
    {
        $this->actingAs($this->hr)->post('/hr/employees', $this->employeePayload(['role_id' => $this->adminRole->role_id]))
            ->assertSessionHasErrors('role_id');
        $this->assertDatabaseMissing('users', ['email' => 'new.person@example.test']);

        // Any other role is fine
        $this->actingAs($this->hr)->post('/hr/employees', $this->employeePayload())->assertSessionHasNoErrors();
        $this->assertSame($this->headRole->role_id, User::where('email', 'new.person@example.test')->value('role_id'));

        // The Admin role is not even offered to HR
        $roles = $this->actingAs($this->hr)->get('/hr/employees/create')->viewData('page')['props']['dbRoles'];
        $this->assertNotContains('Admin', array_column($roles, 'role_name'));
    }

    public function test_hr_cannot_take_over_or_promote_to_an_administrator_account(): void
    {
        // Re-using a registered e-mail (here the Admin's) is refused instead of overwriting that account
        $this->actingAs($this->hr)->post('/hr/employees', $this->employeePayload(['email' => $this->admin->email]))
            ->assertSessionHasErrors(['email' => 'This email address is already registered to another account.']);
        $this->assertTrue(Hash::check('password', $this->admin->refresh()->password));

        $this->actingAs($this->hr)->put("/hr/employees/{$this->engineer->id}", $this->employeePayload([
            'email' => $this->engineer->email, 'role_id' => $this->adminRole->role_id, 'is_active' => true, 'mobile_number' => '09173334444',
        ]))->assertSessionHasErrors('role_id');
        $this->assertSame($this->headRole->role_id, $this->engineer->refresh()->role_id);

        $this->actingAs($this->hr)->put("/hr/employees/{$this->admin->id}", $this->employeePayload(['email' => $this->admin->email, 'is_active' => false]))->assertForbidden();
        $this->actingAs($this->hr)->delete("/hr/employees/{$this->admin->id}")->assertForbidden();
        $this->actingAs($this->hr)->post("/hr/users/{$this->admin->id}/override-role", ['department_id' => $this->engineering->department_id])->assertForbidden();
        $this->assertTrue((bool) $this->admin->refresh()->is_active);
    }

    public function test_hr_cannot_overwrite_an_employee_by_reusing_their_email_and_names_are_letters_only(): void
    {
        $before = $this->engineer->only(['first_name', 'role_id', 'password']);
        $this->actingAs($this->hr)->post('/hr/employees', $this->employeePayload(['email' => $this->engineer->email, 'first_name' => 'Impostor']))
            ->assertSessionHasErrors('email');
        $this->assertSame($before, $this->engineer->refresh()->only(['first_name', 'role_id', 'password']));

        $this->post('/hr/employees', $this->employeePayload(['first_name' => 'J0hn', 'last_name' => 'Smith<b>']))
            ->assertSessionHasErrors(['first_name', 'last_name']);
        $this->post('/hr/employees', $this->employeePayload(['first_name' => 'Ma. Niña', 'last_name' => "O'Brien-Santos"]))
            ->assertSessionHasNoErrors();
    }

    public function test_supporting_files_uploaded_with_a_document_are_kept_as_its_private_attachments(): void
    {
        $document = $this->fileDocument(['attachments' => [
            UploadedFile::fake()->create('barangay-clearance.pdf', 20, 'application/pdf'),
            UploadedFile::fake()->image('valid-id.jpg'),
        ]]);

        $attachments = DocumentAttachment::where('document_id', $document->document_id)->get();
        $this->assertEqualsCanonicalizing(['barangay-clearance.pdf', 'valid-id.jpg'], $attachments->pluck('file_name')->all());
        $attachments->each(fn (DocumentAttachment $attachment) => Storage::disk(Document::FILE_DISK)->assertExists($attachment->file_path));
        $this->assertStringEndsWith('with 2 supporting files', AuditTrail::where('document_id', $document->document_id)->where('action', 'Submit')->sole()->description);

        // At most 5 files per document (the main file and 4 supporting files), and only formats the viewer can show
        $documents = Document::count();
        $this->post('/documents', $this->filingPayload(['attachments' => array_map(
            fn ($i) => UploadedFile::fake()->create("page-{$i}.pdf", 5, 'application/pdf'), range(1, 5),
        )]))->assertSessionHasErrors('attachments');
        $this->post('/documents', $this->filingPayload(['attachments' => [UploadedFile::fake()->create('old.doc', 5, 'application/msword')]]))
            ->assertSessionHasErrors('attachments.0');
        $this->assertSame($documents, Document::count());
    }

    public function test_nobody_changes_their_own_role_office_or_status(): void
    {
        $this->actingAs($this->admin)->post("/admin/users/{$this->admin->id}/override-role", ['role_id' => $this->headRole->role_id])
            ->assertSessionHasErrors('role_id');
        $this->actingAs($this->hr)->post("/hr/users/{$this->hr->id}/override-role", ['department_id' => $this->engineering->department_id])
            ->assertSessionHasErrors('role_id');
        $this->assertSame($this->adminRole->role_id, $this->admin->refresh()->role_id);
    }

    public function test_deleting_an_account_deactivates_it_and_keeps_its_records(): void
    {
        $doc = $this->fileDocument();
        $this->actingAs($this->admin)->delete("/admin/users/{$this->clerk->id}")->assertSessionHasNoErrors();

        $this->assertDatabaseHas('users', ['id' => $this->clerk->id, 'is_active' => false]);
        $this->assertTrue(Document::whereKey($doc->document_id)->exists());
        $this->assertTrue(AuditTrail::where('document_id', $doc->document_id)->exists());

        // An office with documents is deactivated, not deleted
        $this->clerk->forceFill(['department_id' => null])->save();
        $this->engineer->forceFill(['department_id' => null])->save();
        $this->actingAs($this->hr)->delete("/hr/departments/{$this->engineering->department_id}")->assertSessionHasNoErrors();
        $this->assertDatabaseHas('departments', ['department_id' => $this->engineering->department_id, 'is_active' => false]);
    }

    // ── Files and visibility ─────────────────────────────────────────────────────────────────────────

    public function test_document_files_are_private_and_shown_only_to_involved_people(): void
    {
        $doc = $this->fileDocument();
        Storage::disk('local')->assertExists($doc->attachment_path);
        $this->assertFalse(Storage::disk('public')->exists($doc->attachment_path));
        $url = '/documents/' . $doc->document_id . '/files/main/' . basename($doc->attachment_path);

        $this->actingAs($this->engineer)->get($url)->assertOk();      // on its route
        $this->actingAs($this->clerk)->get($url)->assertOk();         // filed it
        $this->actingAs($this->health)->get($url)->assertForbidden(); // another office, not involved
    }

    public function test_people_outside_a_document_see_only_a_summary(): void
    {
        $doc = $this->fileDocument();

        $outsider = $this->actingAs($this->health)->get("/department-head/documents/{$doc->document_id}")->viewData('page')['props']['dbDocument'];
        $this->assertSame('Restricted Document', $outsider['title']);
        $this->assertNull($outsider['client']);
        $this->assertNull($outsider['attachment_path']);
        $this->assertSame('Applicant', $outsider['sender']);

        $insider = $this->actingAs($this->engineer)->get("/department-head/documents/{$doc->document_id}")->viewData('page')['props']['dbDocument'];
        $this->assertSame('Building Permit', $insider['title']);
    }

    public function test_the_browser_cannot_write_its_own_audit_trail_entries(): void
    {
        $doc = $this->fileDocument();

        $this->actingAs($this->engineer)->postJson("/documents/{$doc->document_id}/log-action", ['action' => 'Approve', 'description' => 'Approved by the Mayor'])
            ->assertUnprocessable();
        $this->actingAs($this->engineer)->postJson("/documents/{$doc->document_id}/log-action", ['event' => 'ocr_txt'])->assertOk();

        $this->assertFalse(AuditTrail::where('description', 'Approved by the Mayor')->exists());
        $this->assertTrue(AuditTrail::where('document_id', $doc->document_id)->where('description', 'OCR text exported as a .txt file.')->exists());
    }

    public function test_reference_numbers_never_repeat(): void
    {
        $first = $this->fileDocument();
        // A document moved to another office no longer counts for its first office
        $first->forceFill(['department_id' => $this->records->department_id])->saveQuietly();

        $next = app(DocumentNumberGenerator::class)->generateReferenceNumber($this->engineering->department_id);
        $this->assertNotSame($first->reference_number, $next);
        $this->assertFalse(Document::where('reference_number', $next)->exists());
    }
}

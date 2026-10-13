<?php

namespace Tests\Feature;

use App\Models\DigitalSignature;
use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Role;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Document\DocumentRoute;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Flexible routes: the people chosen at filing are visited in order, the document moves on automatically,
 * the progress bar is sized by the route, and every return adds two steps.
 */
class DocumentRouteTest extends TestCase
{
    use RefreshDatabase;

    private const SIGNATURE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $clerk;
    private User $mayor;
    private User $engineer;
    private User $budget;
    private User $healthHead;
    private DocumentType $type;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local'); // document files are private
        $this->withoutVite();
        $this->withoutDefer();

        $records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $mayorOffice = Department::create(['department_name' => 'Office of the City Mayor', 'code' => 'OCM', 'is_active' => true]);
        $engineering = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
        $budgetOffice = Department::create(['department_name' => 'City Budget Office', 'code' => 'CBO', 'is_active' => true]);
        $health = Department::create(['department_name' => 'City Health Office', 'code' => 'CHO', 'is_active' => true]);

        $this->clerk = $this->makeUser('Juan', 'Receiving Clerk', $records);
        $this->mayor = $this->makeUser('Michelle', 'Mayor', $mayorOffice);
        $this->engineer = $this->makeUser('Ricardo', 'Department Head', $engineering);
        $this->budget = $this->makeUser('Bea', 'Department Head', $budgetOffice, null);
        $this->healthHead = $this->makeUser('Elena', 'Department Head', $health);
        $this->type = DocumentType::create(['type_name' => 'Permit', 'arta_processing_days' => 5, 'is_active' => true]);

        // The client's address must exist in the PSA tables (seeded by migration; created here if empty)
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

    private string $barangay;

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
            'mobile_number' => null,
            'is_active'     => true,
            'signature'     => $signature,
        ]);
    }

    private function stop(User $user, bool $signs): array
    {
        return ['user_id' => $user->id, 'signs' => $signs];
    }

    /** The Receiving Clerk files an external document with the given route */
    private function fileExternal(array $route, array $overrides = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->clerk)->post('/documents', array_merge([
            'title'          => 'Building Permit Application',
            'type_id'        => $this->type->type_id,
            'department_id'  => $this->clerk->department_id,
            'file'           => UploadedFile::fake()->create('permit.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'route'          => $route,
            'client'         => [
                'client_type' => 'Citizen', 'first_name' => 'Ana', 'last_name' => 'Reyes',
                'barangay' => $this->barangay, 'city_municipality' => 'City of Mati', 'province' => 'Davao Oriental',
                'contact_number' => '09171234567', 'receipt_mode' => 'Walk-in', 'purpose' => 'Building permit',
            ],
        ], $overrides));
    }

    private function fileInternal(User $sender, array $route): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($sender)->post('/documents', [
            'title'          => 'Budget Realignment Memo',
            'type_id'        => $this->type->type_id,
            'department_id'  => $sender->department_id,
            'file'           => UploadedFile::fake()->create('memo.pdf', 20, 'application/pdf'),
            'classification' => 'normal',
            'route'          => $route,
        ]);
    }

    private function latest(): Document
    {
        return Document::latest('document_id')->firstOrFail();
    }

    private function approve(User $user, Document $doc): void
    {
        $this->actingAs($user)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->post("/documents/{$doc->document_id}/approve-next")->assertSessionHasNoErrors();
    }

    private function labels(Document $doc): array
    {
        return collect(app(DocumentRoute::class)->steps($doc->refresh()))->map(fn ($s) => "{$s['label']}:{$s['actor']}:{$s['status']}")->all();
    }

    public function test_external_route_follows_the_chosen_order_and_sizes_the_progress_bar(): void
    {
        // The Mayor first and a department last: the order is whatever the clerk chose
        $this->fileExternal([$this->stop($this->mayor, true), $this->stop($this->engineer, true), $this->stop($this->budget, false)])
            ->assertSessionHasNoErrors();
        $doc = $this->latest();

        $this->assertTrue($doc->route_based);
        $this->assertSame($this->mayor->id, $doc->current_holder_id);
        $this->assertSame([5, 2], [$doc->total_steps, $doc->current_step_index]);

        $this->approve($this->mayor, $doc);
        $doc->refresh();
        $this->assertSame($this->engineer->id, $doc->current_holder_id); // nobody had to pick the next person
        $this->assertSame(3, $doc->current_step_index);
        $this->assertTrue(DigitalSignature::where('document_id', $doc->document_id)->where('signed_by_user_id', $this->mayor->id)->exists());

        $this->approve($this->engineer, $doc);
        $this->assertSame($this->budget->id, $doc->refresh()->current_holder_id);

        $this->approve($this->budget, $doc); // review only: no signature needed
        $doc->refresh();
        $this->assertSame('approved', $doc->status);
        $this->assertSame($this->clerk->id, $doc->current_holder_id);
        $this->assertSame([5, 5], [$doc->total_steps, $doc->current_step_index]);

        $doc->forceFill(['signed_file_path' => 'signed/permit.pdf', 'signed_copy_signatures' => 2])->save();
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasNoErrors();

        $this->assertSame([
            'Submitted:Juan Tester:done',
            'Signed:Michelle Tester:done',
            'Signed:Ricardo Tester:done',
            'Approved:Bea Tester:done',
            'Released:Juan Tester:done',
        ], $this->labels($doc));
        $this->assertSame('completed', $doc->refresh()->status);
    }

    /** Live status of the waiting step: "label:detail:returns" */
    private function current(Document $doc): string
    {
        $step = collect(app(DocumentRoute::class)->steps($doc->refresh()))->firstWhere('status', DocumentRoute::CURRENT);

        return "{$step['label']}:{$step['actor']}:{$step['detail']}:{$step['returns']}";
    }

    public function test_a_return_keeps_the_steps_and_shows_what_is_happening_on_the_waiting_step(): void
    {
        $this->fileExternal([$this->stop($this->mayor, true), $this->stop($this->engineer, true), $this->stop($this->budget, false)]);
        $doc = $this->latest();
        $this->assertSame('Signature:Michelle Tester:Forwarded · awaiting receipt:0', $this->current($doc));
        $this->approve($this->mayor, $doc);
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/accept")->assertSessionHasNoErrors();
        $this->assertSame('Signature:Ricardo Tester:Under review:0', $this->current($doc));

        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/return", ['reason' => 'Missing site plan'])->assertSessionHasNoErrors();
        $doc->refresh();
        $this->assertSame($this->mayor->id, $doc->current_holder_id); // one stop back
        $this->assertSame([5, 3], [$doc->total_steps, $doc->current_step_index]); // no extra steps
        $this->assertSame('Signature:Ricardo Tester:Returned to Michelle Tester for correction:1', $this->current($doc));

        // The returned holder corrects it; it comes straight back to whoever returned it
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/resubmit", [
            'files' => [UploadedFile::fake()->create('site-plan.pdf', 10, 'application/pdf')],
        ])->assertSessionHasNoErrors();
        $doc->refresh();
        $this->assertSame($this->engineer->id, $doc->current_holder_id);
        $this->assertSame([5, 3], [$doc->total_steps, $doc->current_step_index]);
        $this->assertSame('Signature:Ricardo Tester:Corrected · back for review:1', $this->current($doc));

        $this->approve($this->engineer, $doc);
        $this->approve($this->budget, $doc);

        $this->assertSame([
            'Submitted:Juan Tester:done',
            'Signed:Michelle Tester:done',
            'Signed:Ricardo Tester:done',
            'Approved:Bea Tester:done',
            'Release:Juan Tester:current',
        ], $this->labels($doc));
        // The return stays visible on the step of whoever returned it
        $this->assertSame([0, 0, 1, 0, 0], array_column(app(DocumentRoute::class)->steps($doc), 'returns'));
    }

    public function test_internal_route_is_registered_automatically_then_follows_the_route_and_completes_back_to_the_sender(): void
    {
        $this->fileInternal($this->healthHead, [$this->stop($this->engineer, true), $this->stop($this->mayor, true)])->assertSessionHasNoErrors();
        $doc = $this->latest();
        // Registered on filing and straight to the first person on the route; the clerk is not a step
        $this->assertNotNull($doc->tracking_number);
        $this->assertSame($this->engineer->id, $doc->current_holder_id);
        $this->assertSame([4, 2], [$doc->total_steps, $doc->current_step_index]);
        $this->assertSame('Signature:Ricardo Tester:current', $this->labels($doc)[1]);
        $this->assertFalse(SystemNotification::where('document_id', $doc->document_id)->where('user_id', $this->clerk->id)->exists());

        $this->approve($this->engineer, $doc);
        $this->assertSame($this->mayor->id, $doc->refresh()->current_holder_id);
        $this->approve($this->mayor, $doc);

        $doc->refresh();
        $this->assertSame('completed', $doc->status);
        $this->assertSame([4, 4], [$doc->total_steps, $doc->current_step_index]);
        $this->assertSame([
            'Submitted:Elena Tester:done',
            'Signed:Ricardo Tester:done',
            'Signed:Michelle Tester:done',
            'Completed:Elena Tester:done',
        ], $this->labels($doc));
        $this->assertTrue(SystemNotification::where('document_id', $doc->document_id)->where('user_id', $this->healthHead->id)->where('title', 'Document Approved & Completed')->exists());
    }

    public function test_a_sender_heading_their_own_route_signs_on_submit(): void
    {
        $this->fileInternal($this->healthHead, [$this->stop($this->healthHead, true), $this->stop($this->mayor, true)])->assertSessionHasNoErrors();
        $doc = $this->latest();
        $this->assertTrue(DigitalSignature::where('document_id', $doc->document_id)->where('signed_by_user_id', $this->healthHead->id)->exists());

        $this->assertSame($this->mayor->id, $doc->current_holder_id);
        $this->assertSame([
            'Submitted:Elena Tester:done',
            'Signed:Elena Tester:done',
            'Signature:Michelle Tester:current',
            'Completion:Elena Tester:pending',
        ], $this->labels($doc));
    }

    public function test_the_route_is_fixed(): void
    {
        $this->fileExternal([$this->stop($this->mayor, true), $this->stop($this->engineer, false)]);
        $doc = $this->latest();

        // No hand-picked forwarding on a routed document
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/endorse", ['destination_type' => 'user', 'destination_id' => $this->budget->id])
            ->assertSessionHasErrors('route');
        $this->assertSame($this->mayor->id, $doc->refresh()->current_holder_id);

        // Only the current holder may approve
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/approve-next")->assertForbidden();

        // A returned document is corrected, not approved
        $this->approve($this->mayor, $doc);
        $this->actingAs($this->engineer)->post("/documents/{$doc->document_id}/return", ['reason' => 'Wrong form']);
        $this->actingAs($this->mayor)->post("/documents/{$doc->document_id}/approve-next")->assertSessionHasErrors('route');
    }

    public function test_the_signed_copy_is_rebuilt_after_every_signature(): void
    {
        $this->fileExternal([$this->stop($this->mayor, true), $this->stop($this->engineer, true)]);
        $doc = $this->latest();
        $copy = fn (User $who, int $count, string $name = 'signed.pdf', string $mime = 'application/pdf') => $this->actingAs($who)
            ->postJson("/documents/{$doc->document_id}/signed-copy", ['file' => UploadedFile::fake()->create($name, 20, $mime), 'signatures' => $count]);

        // Nothing to stamp before the first signature
        $copy($this->mayor, 1)->assertStatus(422);

        $this->approve($this->mayor, $doc);
        $copy($this->mayor, 1)->assertOk()->assertJson(['signed_copy_signatures' => 1, 'message' => 'Signed copy updated.']);
        $first = $doc->refresh()->signed_file_path;
        $this->assertFalse($doc->hasFinalSignedCopy());
        // A copy claiming more signatures than were given is refused
        $copy($this->mayor, 2)->assertStatus(422);

        $this->approve($this->engineer, $doc);
        $this->assertSame('approved', $doc->refresh()->status);
        // Release waits for the copy carrying every signature
        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasErrors('signature');

        $copy($this->engineer, 2)->assertOk()->assertJson(['signed_copy_signatures' => 2, 'message' => 'Final signed copy attached to the document.']);
        $doc->refresh();
        Storage::disk('local')->assertMissing($first); // the newer copy replaces the older one
        $this->assertTrue($doc->hasFinalSignedCopy());

        // A late copy built from fewer signatures never replaces the final one
        $copy($this->mayor, 1)->assertOk();
        $this->assertSame(2, $doc->refresh()->signed_copy_signatures);

        $this->actingAs($this->clerk)->post("/documents/{$doc->document_id}/release")->assertSessionHasNoErrors();
        $this->assertSame('completed', $doc->refresh()->status);
    }

    public function test_word_documents_keep_their_format_when_signed(): void
    {
        $this->fileExternal([$this->stop($this->mayor, true)], [
            'file' => UploadedFile::fake()->create('request.docx', 20, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        ])->assertSessionHasNoErrors();
        $doc = $this->latest();
        $this->approve($this->mayor, $doc);

        $this->actingAs($this->mayor)->postJson("/documents/{$doc->document_id}/signed-copy", [
            'file'       => UploadedFile::fake()->create('Signed_request.docx', 20, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
            'signatures' => 1,
        ])->assertOk();

        $this->assertStringEndsWith('.docx', $doc->refresh()->signed_file_path);
        $this->assertTrue($doc->hasFinalSignedCopy());
    }

    public function test_route_validation(): void
    {
        $inactive = $this->makeUser('Old', 'Department Head', Department::first());
        $inactive->forceFill(['is_active' => false])->save();

        $otherClerk = $this->makeUser('Pia', 'Receiving Clerk', Department::first());
        $this->fileExternal([$this->stop($otherClerk, false)])->assertSessionHasErrors('route');
        // Only the filer on the route: nobody receives it
        $this->fileExternal([$this->stop($this->clerk, false)])->assertSessionHasErrors(['forward_to' => 'Add at least one person after yourself.']);
        $this->fileExternal([$this->stop($inactive, false)])->assertSessionHasErrors('route');
        $this->fileExternal([$this->stop($this->mayor, true), $this->stop($this->mayor, false)])->assertSessionHasErrors('route.1.user_id');
        // Signers need a signature registered by HR
        $this->fileExternal([$this->stop($this->budget, true)])->assertSessionHasErrors(['route' => 'Bea Tester has no registered signature yet. Ask HR to add it first.']);
        // A sender may only head their own route (to sign as they submit), never sit in the middle
        $this->fileInternal($this->healthHead, [$this->stop($this->mayor, true), $this->stop($this->healthHead, true)])->assertSessionHasErrors('route');
        $this->fileInternal($this->healthHead, [$this->stop($this->healthHead, true)])->assertSessionHasErrors(['forward_to' => 'Add at least one person after yourself.']);

        $this->assertSame(0, Document::count());
    }
}

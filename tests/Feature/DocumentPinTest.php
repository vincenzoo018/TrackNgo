<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The document PIN asked before downloads and exports (set by HR / Admin at registration, changed in Profile,
 * reset by HR / Admin), and Profile no longer changing anyone's department or role.
 */
class DocumentPinTest extends TestCase
{
    use RefreshDatabase;

    private Department $records;
    private Department $engineering;
    private int $nextMobile = 1;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->records = Department::create(['department_name' => 'Records Office', 'code' => 'REC', 'is_active' => true]);
        $this->engineering = Department::create(['department_name' => "City Engineer's Office", 'code' => 'CEO', 'is_active' => true]);
    }

    private function role(string $name): Role
    {
        return Role::firstOrCreate(['role_name' => $name], ['position' => $name]);
    }

    private function makeUser(string $firstName, string $roleName, ?string $pin = null): User
    {
        $user = User::forceCreate([
            'first_name' => $firstName, 'last_name' => 'Staff', 'email' => strtolower($firstName) . '@example.test',
            'password' => Hash::make('password'), 'role_id' => $this->role($roleName)->role_id,
            'department_id' => $this->records->department_id, 'is_active' => true, 'mobile_number' => $this->mobile(),
        ]);
        if ($pin) {
            $user->forceFill(['document_pin' => Hash::make($pin)])->save();
        }

        return $user;
    }

    private function mobile(): string
    {
        return sprintf('0917%07d', $this->nextMobile++);
    }

    private function exportList(User $user, string $pin): TestResponse
    {
        // Document id 0: list exports, which only need the PIN check
        return $this->actingAs($user)->postJson('/documents/0/export', ['pin' => $pin]);
    }

    private function newEmployee(string $roleName, array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Pedro', 'last_name' => 'Cruz', 'email' => 'pedro@example.test', 'password' => 'password123',
            'department_id' => $this->engineering->department_id, 'role_id' => $this->role($roleName)->role_id,
            'mobile_number' => $this->mobile(), 'signature' => 'data:image/png;base64,AAAA',
        ], $overrides);
    }

    public function test_profile_cannot_change_the_users_own_department_or_role(): void
    {
        $clerk = $this->makeUser('Juan', 'Receiving Clerk');

        $this->actingAs($clerk)->put('/profile', [
            'first_name' => 'Juanito', 'last_name' => 'Staff', 'email' => 'juan@example.test', 'mobile_number' => $clerk->mobile_number,
            'role_id' => $this->role('Admin')->role_id, 'department_id' => $this->engineering->department_id,
        ])->assertSessionHasNoErrors();

        $clerk->refresh();
        $this->assertSame('Juanito', $clerk->first_name);
        $this->assertSame('Receiving Clerk', $clerk->role->role_name);
        $this->assertSame($this->records->department_id, $clerk->department_id);
    }

    public function test_the_pin_is_set_with_the_login_password_and_changed_with_the_current_pin(): void
    {
        $head = $this->makeUser('Ricardo', 'Department Head');
        $this->actingAs($head)->get('/profile')->assertInertia(fn ($page) => $page->where('documentPin', ['required' => true, 'is_set' => false, 'updated_at' => null]));

        $set = fn (array $data) => $this->actingAs($head)->put('/profile/document-pin', $data);
        $set(['pin' => '135790', 'pin_confirmation' => '135790'])->assertSessionHasErrors('current_password');
        $set(['current_password' => 'password', 'pin' => '123456', 'pin_confirmation' => '123456'])->assertSessionHasErrors('pin');
        $set(['current_password' => 'password', 'pin' => '111111', 'pin_confirmation' => '111111'])->assertSessionHasErrors('pin');
        $set(['current_password' => 'password', 'pin' => '13579', 'pin_confirmation' => '13579'])->assertSessionHasErrors('pin');
        $set(['current_password' => 'password', 'pin' => '135790', 'pin_confirmation' => '135791'])->assertSessionHasErrors('pin');
        $set(['current_password' => 'password', 'pin' => '135790', 'pin_confirmation' => '135790'])->assertSessionHasNoErrors();

        $head->refresh();
        $this->assertTrue(Hash::check('135790', $head->document_pin));
        $this->assertTrue($head->has_document_pin);
        $this->assertArrayNotHasKey('document_pin', $head->toArray()); // never serialized

        // Changing it needs the current PIN; the login password is not enough
        $set(['current_password' => 'password', 'pin' => '246813', 'pin_confirmation' => '246813'])->assertSessionHasErrors('current_pin');
        $set(['current_pin' => '000000', 'pin' => '246813', 'pin_confirmation' => '246813'])->assertSessionHasErrors('current_pin');
        $set(['current_pin' => '135790', 'pin' => '135790', 'pin_confirmation' => '135790'])->assertSessionHasErrors('pin');
        $set(['current_pin' => '135790', 'pin' => '246813', 'pin_confirmation' => '246813'])->assertSessionHasNoErrors();
        $this->assertTrue(Hash::check('246813', $head->refresh()->document_pin));
        $this->assertSame(['Document PIN Set', 'Document PIN Changed'], AuditTrail::where('user_id', $head->id)->orderBy('audit_id')->pluck('action')->all());
    }

    public function test_downloads_need_the_document_pin_and_lock_after_five_wrong_tries(): void
    {
        $mayor = $this->makeUser('Michelle', 'Mayor');

        // No PIN yet: blocked, with the way to set one; the login password does not open downloads any more
        $this->exportList($mayor, 'password')->assertForbidden()->assertJson(['code' => 'pin_not_set']);

        $mayor->forceFill(['document_pin' => Hash::make('135790')])->save();
        $this->exportList($mayor, '135790')->assertOk()->assertJson(['verified' => true]);

        foreach (range(4, 1) as $left) {
            $this->exportList($mayor, '000000')->assertForbidden()
                ->assertJson(['code' => 'pin_wrong', 'message' => "Incorrect document PIN. {$left} " . ($left === 1 ? 'try' : 'tries') . ' left before it is locked.']);
        }
        $this->exportList($mayor, '000000')->assertStatus(429)->assertJson(['code' => 'pin_locked']);
        $this->exportList($mayor, '135790')->assertStatus(429); // even the right PIN while locked
        $this->assertSame(1, AuditTrail::where('action', 'Document PIN Locked')->count());

        $this->travel(16)->minutes();
        $this->exportList($mayor, '135790')->assertOk();
    }

    public function test_hr_registration_requires_a_pin_for_accounts_that_handle_documents(): void
    {
        $hr = $this->makeUser('Ana', 'HR', '135790');

        $this->actingAs($hr)->post('/hr/employees', $this->newEmployee('Department Head'))->assertSessionHasErrors('document_pin');
        $this->post('/hr/employees', $this->newEmployee('Department Head', ['document_pin' => '123456', 'document_pin_confirmation' => '123456']))
            ->assertSessionHasErrors('document_pin');
        $this->assertNull(User::where('email', 'pedro@example.test')->first());

        $this->post('/hr/employees', $this->newEmployee('Department Head', ['document_pin' => '480516', 'document_pin_confirmation' => '480516']))
            ->assertSessionHasNoErrors();
        $pedro = User::where('email', 'pedro@example.test')->sole();
        $this->assertTrue(Hash::check('480516', $pedro->document_pin));
        $this->assertSame("HR Ana Staff set the document PIN of {$pedro->name}.", AuditTrail::where('action', 'Document PIN Set')->sole()->description);

        // CART only monitors: no PIN needed
        $this->post('/hr/employees', $this->newEmployee('CART', ['email' => 'monitor@example.test']))->assertSessionHasNoErrors();
        $this->assertNull(User::where('email', 'monitor@example.test')->sole()->document_pin);
    }

    public function test_a_forgotten_pin_is_reset_by_hr_or_admin_but_never_their_own(): void
    {
        $hr = $this->makeUser('Ana', 'HR', '135790');
        $admin = $this->makeUser('Ada', 'Admin', '135790');
        $clerk = $this->makeUser('Juan', 'Receiving Clerk', '135790');
        $edit = fn (User $user, array $extra) => [
            'first_name' => $user->first_name, 'last_name' => $user->last_name, 'email' => $user->email, 'department_id' => $user->department_id,
            'role_id' => $user->role_id, 'mobile_number' => $user->mobile_number, 'is_active' => 1,
        ] + $extra;

        $this->actingAs($hr)->put("/hr/employees/{$clerk->id}", $edit($clerk, ['document_pin' => '246813', 'document_pin_confirmation' => '246813']))
            ->assertSessionHasNoErrors();
        $this->assertTrue(Hash::check('246813', $clerk->refresh()->document_pin));
        $this->assertSame("HR Ana Staff reset the document PIN of {$clerk->name}.", AuditTrail::where('action', 'Document PIN Reset')->sole()->description);

        // Their own PIN is changed in Profile Settings (with the current PIN), not from the management screens
        $this->put("/hr/employees/{$hr->id}", $edit($hr, ['document_pin' => '246813', 'document_pin_confirmation' => '246813']))
            ->assertSessionHasErrors('document_pin');
        $this->assertTrue(Hash::check('135790', $hr->refresh()->document_pin));

        $this->actingAs($admin)->put("/admin/users/{$clerk->id}", $edit($clerk, ['document_pin' => '357913', 'document_pin_confirmation' => '357913']))
            ->assertSessionHasNoErrors();
        $this->assertTrue(Hash::check('357913', $clerk->refresh()->document_pin));
        $this->put("/admin/users/{$admin->id}", $edit($admin, ['document_pin' => '357913', 'document_pin_confirmation' => '357913']))
            ->assertSessionHasErrors('document_pin');

        // Admin registrations need it too
        $this->post('/admin/users', $this->newEmployee('Mayor', ['email' => 'vice@example.test']))->assertSessionHasErrors('document_pin');
        $this->post('/admin/users', $this->newEmployee('Mayor', ['email' => 'vice@example.test', 'document_pin' => '480516', 'document_pin_confirmation' => '480516']))
            ->assertSessionHasNoErrors();
        $this->assertTrue(User::where('email', 'vice@example.test')->sole()->has_document_pin);
    }
}

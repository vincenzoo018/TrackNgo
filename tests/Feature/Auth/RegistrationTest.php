<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * TrackNGo has no public sign-up: HR (Employees) and the Admin (User Accounts) create every account, and an account
 * that is deactivated (or has no role) cannot use the system.
 */
class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_registration_is_disabled()
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'first_name' => 'Test', 'last_name' => 'User', 'email' => 'test@example.com',
            'password' => 'password', 'password_confirmation' => 'password',
        ]);

        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['email' => 'test@example.com']);
    }

    public function test_a_deactivated_account_cannot_sign_in_and_is_signed_out()
    {
        $role = Role::firstOrCreate(['role_name' => 'Receiving Clerk'], ['position' => 'Receiving Clerk']);
        $user = User::factory()->create(['role_id' => $role->role_id]);
        $user->forceFill(['is_active' => false])->save();

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();

        // Deactivated while signed in: the next request signs them out
        $this->actingAs($user)->get('/receiving')->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_an_account_without_a_role_is_signed_out()
    {
        $user = User::factory()->create(['role_id' => null]);

        $this->actingAs($user)->get('/receiving/documents')->assertRedirect(route('login'));
        $this->assertGuest();
    }
}

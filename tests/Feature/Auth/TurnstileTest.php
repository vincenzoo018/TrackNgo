<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use App\Services\Security\Turnstile;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Cloudflare Turnstile on the login and forgot-password forms: the token is confirmed by Cloudflare once, for that
 * form and this address, before the password is checked; anything that stops the check refuses the form.
 */
class TurnstileTest extends TestCase
{
    use RefreshDatabase;

    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'services.turnstile.enabled'    => true,
            'services.turnstile.site_key'   => 'test-site-key',
            'services.turnstile.secret_key' => 'test-secret-key',
        ]);

        $role = Role::firstOrCreate(['role_name' => 'Receiving Clerk'], ['position' => 'Receiving Clerk']);
        $this->user = User::factory()->create(['role_id' => $role->role_id]);
    }

    /** Cloudflare's answer for a token solved on this site (tests run on http://localhost) */
    private function cloudflareAnswers(array $overrides = []): void
    {
        Http::fake([self::VERIFY_URL => Http::response(array_merge([
            'success'     => true,
            'error-codes' => [],
            'hostname'    => 'localhost',
            'action'      => 'login',
        ], $overrides))]);
    }

    private function logIn(array $fields = [])
    {
        return $this->post(route('login.store'), array_merge([
            'email'           => $this->user->email,
            'password'        => 'password',
            'turnstile_token' => 'solved-token',
        ], $fields));
    }

    public function test_the_login_and_forgot_password_pages_get_the_site_key(): void
    {
        $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('turnstileSiteKey', 'test-site-key'));
        $this->get(route('password.request'))->assertInertia(fn (Assert $page) => $page->where('turnstileSiteKey', 'test-site-key'));

        config(['services.turnstile.enabled' => false]);
        $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('turnstileSiteKey', null));
    }

    public function test_a_confirmed_token_logs_in_and_the_secret_stays_on_the_server(): void
    {
        $this->cloudflareAnswers();

        $this->logIn()->assertRedirect('/receiving');

        $this->assertAuthenticatedAs($this->user);
        Http::assertSent(fn (HttpRequest $request) => $request->url() === self::VERIFY_URL
            && $request['secret'] === 'test-secret-key'
            && $request['response'] === 'solved-token');
        $this->get(route('login'))->assertDontSee('test-secret-key');
    }

    public function test_without_a_token_the_password_is_never_checked(): void
    {
        Event::fake([Failed::class]);

        $this->logIn(['turnstile_token' => '', 'password' => 'wrong-password'])
            ->assertSessionHasErrors(['turnstile_token' => 'Please complete the security check.']);

        $this->assertGuest();
        Event::assertNotDispatched(Failed::class);
        Http::assertNothingSent();
    }

    public function test_a_token_cloudflare_rejects_is_refused_even_with_the_right_password(): void
    {
        $this->cloudflareAnswers(['success' => false, 'error-codes' => ['invalid-input-response']]);

        $this->logIn()->assertSessionHasErrors(['turnstile_token' => 'The security check failed. Please try again.']);

        $this->assertGuest();
    }

    public function test_an_oversized_token_is_refused_without_asking_cloudflare(): void
    {
        $this->logIn(['turnstile_token' => str_repeat('a', 2049)])->assertSessionHasErrors('turnstile_token');

        $this->assertGuest();
        Http::assertNothingSent();
    }

    public static function tokensMadeElsewhere(): array
    {
        return [
            'made on the forgot-password form' => [['action' => 'password_reset']],
            'made on another website'          => [['hostname' => 'phishing.example']],
            'no action'                        => [['action' => null]],
        ];
    }

    #[DataProvider('tokensMadeElsewhere')]
    public function test_a_token_made_for_another_form_or_address_is_refused(array $answer): void
    {
        $this->cloudflareAnswers($answer);

        $this->logIn()->assertSessionHasErrors('turnstile_token');

        $this->assertGuest();
    }

    public function test_login_is_refused_when_cloudflare_cannot_be_reached(): void
    {
        Http::fake([self::VERIFY_URL => Http::failedConnection()]);

        $this->logIn()->assertSessionHasErrors('turnstile_token');

        $this->assertGuest();
    }

    public function test_login_is_refused_and_logged_when_the_keys_are_missing(): void
    {
        Log::spy();
        config(['services.turnstile.secret_key' => null]);
        $this->logIn()->assertSessionHasErrors('turnstile_token');

        config(['services.turnstile.site_key' => null]);
        $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('turnstileSiteKey', null));
        $this->logIn(['turnstile_token' => ''])->assertSessionHasErrors('turnstile_token');

        $this->assertGuest();
        Http::assertNothingSent();
        Log::shouldHaveReceived('error')->with(\Mockery::pattern('/TURNSTILE_SECRET_KEY is not set/'))->once();
        Log::shouldHaveReceived('error')->with(\Mockery::pattern('/TURNSTILE_SITE_KEY is not set/'))->atLeast()->once();
    }

    public function test_cloudflare_test_keys_work_locally_but_never_in_production(): void
    {
        // Cloudflare's test keys pass any token and carry no action or hostname
        $this->cloudflareAnswers(['hostname' => 'example.com', 'action' => null, 'metadata' => ['result_with_testing_key' => true]]);

        $this->logIn()->assertRedirect('/receiving');
        $this->assertAuthenticatedAs($this->user);

        // Checked on the service itself: outside the testing environment Laravel also enforces CSRF on the request
        $this->app->detectEnvironment(fn () => 'production');
        $this->assertFalse(app(Turnstile::class)->verify('another-token', Turnstile::ACTION_LOGIN, '127.0.0.1', 'localhost'));
        $this->app->detectEnvironment(fn () => 'testing');
    }

    public function test_two_factor_users_are_checked_once_because_tokens_pass_only_once(): void
    {
        $this->cloudflareAnswers();
        $user = User::factory()->withTwoFactor()->create();

        $this->logIn(['email' => $user->email])->assertRedirect(route('two-factor.login'));

        Http::assertSentCount(1);
    }

    public function test_too_many_checks_from_one_address_are_refused_without_asking_cloudflare(): void
    {
        config(['services.turnstile.max_checks_per_minute' => 2]);
        $this->cloudflareAnswers(['success' => false, 'error-codes' => ['invalid-input-response']]);

        foreach (range(1, 3) as $attempt) {
            $this->logIn(['email' => "bot{$attempt}@example.test"])->assertSessionHasErrors('turnstile_token');
        }

        Http::assertSentCount(2);
    }

    public function test_with_the_captcha_off_login_needs_no_token(): void
    {
        config(['services.turnstile.enabled' => false]);

        $this->logIn(['turnstile_token' => null])->assertRedirect('/receiving');

        $this->assertAuthenticatedAs($this->user);
        Http::assertNothingSent();
    }

    public function test_the_forgot_password_form_needs_its_own_token(): void
    {
        Notification::fake();

        $this->post(route('password.email'), ['email' => $this->user->email])
            ->assertSessionHasErrors(['turnstile_token' => 'Please complete the security check.']);
        Notification::assertNothingSent();

        // A token solved on the login form does not unlock the reset form
        $this->cloudflareAnswers(['action' => 'login']);
        $this->post(route('password.email'), ['email' => $this->user->email, 'turnstile_token' => 'solved-token'])
            ->assertSessionHasErrors('turnstile_token');
        Notification::assertNothingSent();
    }

    public function test_a_confirmed_token_sends_the_password_reset_link(): void
    {
        Notification::fake();
        $this->cloudflareAnswers(['action' => 'password_reset']);

        $this->post(route('password.email'), ['email' => $this->user->email, 'turnstile_token' => 'solved-token'])
            ->assertSessionHasNoErrors();

        Notification::assertSentTo($this->user, ResetPassword::class);
    }
}

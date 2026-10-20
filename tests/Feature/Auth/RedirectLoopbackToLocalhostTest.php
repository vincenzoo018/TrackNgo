<?php

namespace Tests\Feature\Auth;

use Tests\TestCase;

/** The login captcha cannot run on an IP address, so local development pages move from 127.0.0.1 to localhost. */
class RedirectLoopbackToLocalhostTest extends TestCase
{
    protected function tearDown(): void
    {
        $this->app->detectEnvironment(fn () => 'testing');
        parent::tearDown();
    }

    public function test_local_pages_opened_on_the_loopback_ip_move_to_localhost(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $this->get('http://127.0.0.1:8000/login')->assertRedirect('http://localhost:8000/login');
        $this->get('http://127.0.0.1:8000/track?tn=RS-2026-0042')->assertRedirect('http://localhost:8000/track?tn=RS-2026-0042');
        $this->get('http://[::1]:8000/login')->assertRedirect('http://localhost:8000/login');

        // An Inertia visit from a tab already open on 127.0.0.1 reloads the whole page at the new address
        $this->get('http://127.0.0.1:8000/login', ['X-Inertia' => 'true'])
            ->assertStatus(409)
            ->assertHeader('X-Inertia-Location', 'http://localhost:8000/login');

        $this->get('http://localhost:8000/login')->assertOk();
    }

    public function test_nothing_moves_outside_local_development(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->get('http://127.0.0.1:8000/login')->assertOk();
    }
}

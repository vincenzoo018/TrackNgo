<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_site_root_sends_visitors_to_the_login_page()
    {
        $this->get('/')->assertRedirect(route('login'));
    }
}

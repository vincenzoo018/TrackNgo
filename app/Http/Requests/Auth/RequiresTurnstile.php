<?php

namespace App\Http\Requests\Auth;

use App\Rules\PassesTurnstile;
use App\Services\Security\Turnstile;

/** Adds the Cloudflare Turnstile token to a Fortify form request (nothing is added while the captcha is off). */
trait RequiresTurnstile
{
    /** @return array<string, array<int, mixed>> */
    protected function turnstileRules(string $action): array
    {
        return app(Turnstile::class)->enabled()
            ? [Turnstile::FIELD => ['bail', 'required', new PassesTurnstile($action, $this)]]
            : [];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [Turnstile::FIELD . '.required' => 'Please complete the security check.'];
    }
}

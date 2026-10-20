<?php

namespace App\Rules;

use App\Services\Security\Turnstile;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Request;

/** The form's Cloudflare Turnstile token, confirmed by Cloudflare for this form (action) and this address. */
class PassesTurnstile implements ValidationRule
{
    public function __construct(
        private readonly string $action,
        private readonly Request $request,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $passed = is_string($value)
            && app(Turnstile::class)->verify($value, $this->action, (string) $this->request->ip(), $this->request->getHost());

        if (!$passed) {
            $fail('The security check failed. Please try again.');
        }
    }
}

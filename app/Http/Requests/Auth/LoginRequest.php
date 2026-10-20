<?php

namespace App\Http\Requests\Auth;

use App\Services\Security\Turnstile;
use Laravel\Fortify\Http\Requests\LoginRequest as FortifyLoginRequest;

/**
 * Fortify's login form plus the captcha. Bound in FortifyServiceProvider in place of Fortify's own request, so the
 * one-time token is confirmed exactly once, before the password is checked or two-factor login starts.
 */
class LoginRequest extends FortifyLoginRequest
{
    use RequiresTurnstile;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + $this->turnstileRules(Turnstile::ACTION_LOGIN);
    }
}

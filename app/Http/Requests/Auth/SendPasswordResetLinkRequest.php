<?php

namespace App\Http\Requests\Auth;

use App\Services\Security\Turnstile;
use Laravel\Fortify\Http\Requests\SendPasswordResetLinkRequest as FortifySendPasswordResetLinkRequest;

/**
 * Fortify's forgot-password form plus the captcha, so bots cannot use it to flood staff mailboxes. Bound in
 * FortifyServiceProvider in place of Fortify's own request.
 */
class SendPasswordResetLinkRequest extends FortifySendPasswordResetLinkRequest
{
    use RequiresTurnstile;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return parent::rules() + $this->turnstileRules(Turnstile::ACTION_PASSWORD_RESET);
    }
}

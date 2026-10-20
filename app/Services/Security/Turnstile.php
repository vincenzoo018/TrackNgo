<?php

namespace App\Services\Security;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

/**
 * Cloudflare Turnstile: the captcha on the login and forgot-password forms.
 *
 * The widget on the page gives the browser a one-time token; the form is accepted only after Cloudflare confirms that
 * token here, server side, with the secret key. A token passes once, for the form it was made for (its action) and
 * the address the page was opened on (its hostname). Anything that stops the check (missing keys, Cloudflare not
 * answering, too many checks from one address) refuses the form: it fails closed.
 */
class Turnstile
{
    /** Form field that carries the token */
    public const FIELD = 'turnstile_token';

    /** Actions the widgets are rendered with (letters, digits, "_" and "-", at most 32 characters) */
    public const ACTION_LOGIN = 'login';
    public const ACTION_PASSWORD_RESET = 'password_reset';

    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    /** Cloudflare's tokens are never longer */
    private const MAX_TOKEN_LENGTH = 2048;

    public function enabled(): bool
    {
        return (bool) config('services.turnstile.enabled');
    }

    /** Public key the page renders the widget with; null when the captcha is off or not configured */
    public function siteKey(): ?string
    {
        if (!$this->enabled()) {
            return null;
        }

        $siteKey = config('services.turnstile.site_key') ?: null;
        if (!$siteKey) {
            Log::error('Turnstile is enabled but TURNSTILE_SITE_KEY is not set: the login and forgot-password forms are refused');
        }

        return $siteKey;
    }

    /**
     * Asks Cloudflare whether the token is genuine, unused and was made for this action on this hostname.
     * "remoteip" is deliberately not sent: on a LAN or behind a proxy the server sees a different address than
     * Cloudflare does, and a mismatch would refuse real staff.
     */
    public function verify(string $token, string $action, string $ip, string $hostname): bool
    {
        if ($token === '' || strlen($token) > self::MAX_TOKEN_LENGTH) {
            return false;
        }

        $secret = (string) config('services.turnstile.secret_key');
        if ($secret === '') {
            Log::error('Turnstile is enabled but TURNSTILE_SECRET_KEY is not set: the login and forgot-password forms are refused');

            return false;
        }

        // Junk tokens from a bot must not turn this server into a flood of calls to Cloudflare
        $limiterKey = 'turnstile:' . $ip;
        if (RateLimiter::tooManyAttempts($limiterKey, max(1, (int) config('services.turnstile.max_checks_per_minute')))) {
            Log::warning('Turnstile check refused: too many checks from one address', ['ip' => $ip]);

            return false;
        }
        RateLimiter::hit($limiterKey, 60);

        try {
            $response = Http::asForm()
                ->acceptJson()
                ->connectTimeout((int) config('services.turnstile.connect_timeout', 5))
                ->timeout((int) config('services.turnstile.timeout', 10))
                ->post(self::VERIFY_URL, ['secret' => $secret, 'response' => $token]);
        } catch (Throwable $e) {
            Log::warning('Turnstile check failed: Cloudflare could not be reached', [
                'error' => str_replace($secret, '[redacted]', $e->getMessage()),
            ]);

            return false;
        }

        $result = $response->json();
        if (!$response->successful() || !is_array($result)) {
            Log::warning('Turnstile check failed: unexpected answer from Cloudflare', ['http_status' => $response->status()]);

            return false;
        }

        if (($result['success'] ?? false) !== true) {
            $codes = array_values(array_filter((array) ($result['error-codes'] ?? []), 'is_string'));
            // A wrong secret key refuses everyone: worth an error, unlike a visitor failing the challenge
            $misconfigured = array_intersect($codes, ['missing-input-secret', 'invalid-input-secret']) !== [];
            Log::log($misconfigured ? 'error' : 'info', 'Turnstile check failed', ['error_codes' => $codes]);

            return false;
        }

        // Cloudflare's test keys pass any token and carry no action or hostname: fine on a developer's machine only
        if (($result['metadata']['result_with_testing_key'] ?? false) === true) {
            if (app()->isProduction()) {
                Log::error('Turnstile is using Cloudflare test keys in production: the form is refused. Set the real keys in .env');

                return false;
            }

            return true;
        }

        if (($result['action'] ?? null) !== $action || strcasecmp((string) ($result['hostname'] ?? ''), $hostname) !== 0) {
            Log::warning('Turnstile check failed: token made for another form or address', [
                'expected_action'   => $action,
                'action'            => $result['action'] ?? null,
                'expected_hostname' => $hostname,
                'hostname'          => $result['hostname'] ?? null,
            ]);

            return false;
        }

        return true;
    }
}

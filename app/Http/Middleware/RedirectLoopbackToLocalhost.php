<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Local development only. The login captcha (Cloudflare Turnstile) runs on domain names, never on an IP address
 * (error 110200, "Unable to connect to website"), while `php artisan serve` prints http://127.0.0.1:8000. A page
 * opened on the loopback IP is sent to the same page on "localhost", which the Turnstile widget allows.
 */
class RedirectLoopbackToLocalhost
{
    private const LOOPBACK_HOSTS = ['127.0.0.1', '::1', '[::1]'];

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!app()->isLocal() || !$request->isMethodSafe() || !in_array($request->getHost(), self::LOOPBACK_HOSTS, true)) {
            return $next($request);
        }

        $port = $request->getPort();
        $defaultPort = ($request->getScheme() === 'http' && $port == 80) || ($request->getScheme() === 'https' && $port == 443);
        $url = $request->getScheme() . '://localhost' . ($defaultPort ? '' : ":{$port}") . $request->getRequestUri();

        // Inertia visits from a tab already open on 127.0.0.1 reload the whole page at the new address
        return Inertia::location($url);
    }
}

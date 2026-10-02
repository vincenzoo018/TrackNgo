<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Address of the public tracking page that QR codes point to, e.g. http://192.168.1.5:8000/track?tn=RS-2026-0042.
 *
 * Phones cannot open "localhost", so when the app is opened on the server machine itself (localhost / 127.0.0.1)
 * the machine's LAN IPv4 is used instead. Set TRACKING_URL in .env to pin the address (e.g. a domain).
 */
class TrackingLink
{
    private static ?string $lanAddress = null;

    public static function baseUrl(Request $request): string
    {
        if ($configured = config('app.tracking_url')) {
            return rtrim($configured, '/');
        }

        $host = $request->getHost();
        if (!in_array($host, ['localhost', '127.0.0.1', '::1', '[::1]'], true) || !($lan = self::lanAddress())) {
            return rtrim($request->getSchemeAndHttpHost(), '/');
        }

        $scheme = $request->getScheme();
        $port = (int) $request->getPort();
        $defaultPort = ($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443);

        return "{$scheme}://{$lan}" . ($defaultPort ? '' : ":{$port}");
    }

    public static function forNumber(string $trackingNumber, Request $request): string
    {
        return self::baseUrl($request) . '/track?tn=' . rawurlencode($trackingNumber);
    }

    /** First private IPv4 of this machine, preferring the usual Wi-Fi / LAN ranges over virtual adapters. */
    private static function lanAddress(): ?string
    {
        if (self::$lanAddress !== null) {
            return self::$lanAddress ?: null;
        }

        $addresses = @gethostbynamel(gethostname()) ?: [];
        $rank = static function (string $ip): int {
            return match (true) {
                str_starts_with($ip, '192.168.56.') => 4, // VirtualBox host-only adapter
                str_starts_with($ip, '192.168.')    => 1,
                str_starts_with($ip, '10.')         => 2,
                (bool) preg_match('/^172\.(1[6-9]|2\d|3[01])\./', $ip) => 3,
                default                              => 9,
            };
        };
        usort($addresses, fn ($a, $b) => $rank($a) <=> $rank($b));
        $best = collect($addresses)->first(fn ($ip) => $rank($ip) < 9);

        self::$lanAddress = $best ?: '';

        return $best ?: null;
    }
}

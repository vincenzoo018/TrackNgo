<?php

namespace App\Support;

/**
 * Philippine mobile numbers. TrackNGo stores them in one form, 09XXXXXXXXX (what the forms and existing
 * records already use), and converts to 639XXXXXXXXX only when talking to the SMS gateway.
 *
 * This checks the format only. It cannot tell whether a number is active or can receive SMS; only a
 * delivered message (or an OTP the owner types back) proves that.
 */
final class PhilippineMobile
{
    /**
     * 09171234567, 9171234567, 639171234567 or +639171234567 (spaces, dashes, dots and brackets allowed)
     * become 09171234567; anything else returns null.
     */
    public static function normalize(?string $input): ?string
    {
        $digits = preg_replace('/[\s\-().]/', '', trim((string) $input));

        if (preg_match('/^(?:\+?63|0)?(9\d{9})$/', $digits, $m) !== 1) {
            return null;
        }

        $local = '0' . $m[1];

        return self::isPlaceholder($local) ? null : $local;
    }

    /** The normalized number when the input is valid, otherwise the input unchanged (so validation reports it). */
    public static function normalizeInput(mixed $input): mixed
    {
        return is_string($input) ? (self::normalize($input) ?? $input) : $input;
    }

    public static function isValid(?string $input): bool
    {
        return self::normalize($input) !== null;
    }

    /** 09171234567 -> 639171234567 (the gateway's format). */
    public static function toInternational(string $local): string
    {
        return '63' . substr($local, 1);
    }

    /** Obvious filler such as 09000000000, 09999999999 or 09123456789. */
    private static function isPlaceholder(string $local): bool
    {
        $subscriber = substr($local, 2);

        return count(array_unique(str_split($subscriber))) === 1 || $subscriber === '123456789';
    }
}

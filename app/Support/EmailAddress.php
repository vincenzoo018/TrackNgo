<?php

namespace App\Support;

/**
 * Email addresses. TrackNGo stores them trimmed and lower-case (login lower-cases what is typed as well, see
 * config/fortify.php "lowercase_usernames"), so the same mailbox can never be registered twice in two spellings.
 *
 * This checks the format only. A well-formed address is no proof that the mailbox exists or accepts mail; only a
 * delivered message proves that, and a bounce may arrive long after the mail server accepted the message.
 */
final class EmailAddress
{
    /** Laravel rule used by every form that takes an email address (RFC syntax and PHP's stricter filter) */
    public const RULE = 'email:rfc,filter';

    /** The trimmed, lower-case address when it is well formed, otherwise null. */
    public static function normalize(?string $input): ?string
    {
        $address = mb_strtolower(trim((string) $input));

        return $address !== '' && mb_strlen($address) <= 100 && filter_var($address, FILTER_VALIDATE_EMAIL) !== false
            ? $address
            : null;
    }

    /** Trimmed and lower-cased for validation and saving (a malformed value is kept so validation reports it). */
    public static function normalizeInput(mixed $input): mixed
    {
        return is_string($input) ? mb_strtolower(trim($input)) : $input;
    }

    /** "na•••@gmail.com": enough to tell recipients apart in admin views without showing the whole address */
    public static function mask(?string $address): string
    {
        if (!$address || !str_contains($address, '@')) {
            return $address ? mb_substr($address, 0, 2) . '•••' : '—';
        }
        [$local, $domain] = explode('@', $address, 2);

        return mb_substr($local, 0, min(2, mb_strlen($local))) . '•••@' . $domain;
    }

    /** The domain part, lower-case ("" when there is none) */
    public static function domain(string $address): string
    {
        return mb_strtolower((string) substr(strrchr($address, '@') ?: '', 1));
    }
}

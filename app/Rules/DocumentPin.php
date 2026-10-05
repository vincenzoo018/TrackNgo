<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** A document PIN: exactly 6 digits that are not easy to guess (000000, 123456, 121212...). */
class DocumentPin implements ValidationRule
{
    private const COMMON = ['123123', '121212', '112233', '111222', '159753', '147258', '789456', '696969', '102030', '010203'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $pin = (string) $value;
        if (!preg_match('/^\d{6}$/', $pin)) {
            $fail('The document PIN must be exactly 6 digits.');

            return;
        }
        if (self::isEasyToGuess($pin)) {
            $fail('This PIN is too easy to guess. Avoid repeated digits, straight sequences and common patterns.');
        }
    }

    public static function isEasyToGuess(string $pin): bool
    {
        $digits = array_map('intval', str_split($pin));
        $steps = array_unique(array_map(fn ($a, $b) => $b - $a, array_slice($digits, 0, -1), array_slice($digits, 1)));

        // All one digit (000000) or a straight run up or down (123456, 987654)
        return count(array_unique($digits)) === 1
            || (count($steps) === 1 && in_array(reset($steps), [1, -1], true))
            || in_array($pin, self::COMMON, true);
    }
}

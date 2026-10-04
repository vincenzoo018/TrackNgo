<?php

namespace App\Rules;

use App\Support\PhilippineMobile;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/** A Philippine mobile number in a common format (09…, 9…, 63…, +63…); see PhilippineMobile. */
class PhilippineMobileNumber implements ValidationRule
{
    public const MESSAGE = 'Please enter a valid Philippine mobile number.';

    public const TAKEN_MESSAGE = 'This mobile number is already used by another account.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_string($value) || !PhilippineMobile::isValid($value)) {
            $fail(self::MESSAGE);
        }
    }

    /**
     * A staff account's mobile number: required, valid, and not used by another account. The input must be
     * normalized first (PhilippineMobile::normalizeInput) so 0917…, 63917… and +63917… count as the same number.
     */
    public static function forAccount(?int $ignoreUserId = null): array
    {
        return ['required', 'string', new self(), Rule::unique('users', 'mobile_number')->ignore($ignoreUserId)];
    }

    /** Validation messages to pair with forAccount() for the given field. */
    public static function accountMessages(string $field = 'mobile_number'): array
    {
        return [
            "{$field}.required" => 'The mobile number is required.',
            "{$field}.unique"   => self::TAKEN_MESSAGE,
        ];
    }
}

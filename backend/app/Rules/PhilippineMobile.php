<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates Philippine mobile numbers.
 *
 * Enforces exactly 11 digits in the local 09XXXXXXXXX format. Letters, spaces,
 * dashes, parentheses and the +63 country code are rejected outright so a
 * number can never be stored half-entered or in a mixed format.
 */
class PhilippineMobile implements ValidationRule
{
    /**
     * Number of digits a valid mobile number must contain.
     */
    public const LENGTH = 11;

    /**
     * Run the validation rule.
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_string($value) || !preg_match('/^09\d{9}$/', $value)) {
            $fail('The :attribute must be exactly 11 digits (e.g. 09171234567).');
        }
    }
}

import React from 'react';
import { PHONE_LENGTH, PHONE_PLACEHOLDER, sanitizePhoneDigits } from '../../services/phone';

/**
 * Numeric-only phone input shared by every module.
 *
 * - Strips anything that is not a digit and caps the value at 11 characters,
 *   so letters, spaces and special characters can never be entered and the
 *   user cannot type more than 11 digits.
 * - Calls onChange with the familiar { target: { name, value } } shape, so it
 *   slots into the existing form handlers unchanged.
 * - inputMode="numeric" shows the number keypad on mobile devices.
 */
export default function PhoneInput({ value, onChange, name, ...rest }) {
  const handleChange = (event) => {
    const digits = sanitizePhoneDigits(event.target.value);
    onChange?.({ target: { name: name ?? event.target.name, value: digits } });
  };

  return (
    <input
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={PHONE_LENGTH}
      placeholder={PHONE_PLACEHOLDER}
      name={name}
      value={value ?? ''}
      onChange={handleChange}
      {...rest}
    />
  );
}

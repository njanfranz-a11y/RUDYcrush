// Shared phone-number helpers for the RoadWatch forms.
//
// A valid mobile number is exactly 11 digits in the local 09XXXXXXXXX format.
// Letters, spaces and special characters are never accepted, and a value can
// never grow past 11 digits.

export const PHONE_LENGTH = 11;
export const PHONE_PATTERN = /^09\d{9}$/;

export const PHONE_ERROR_MESSAGE =
  'Enter a valid 11-digit mobile number (e.g. 09171234567).';

export const PHONE_PLACEHOLDER = '09171234567';

/** Keep digits only and cap the length while the user types. */
export const sanitizePhoneDigits = (value) =>
  String(value ?? '').replace(/\D/g, '').slice(0, PHONE_LENGTH);

/**
 * Normalise a stored value for display: a legacy +63/63 prefix is converted to
 * the local 0 form, then the value is capped at 11 digits.
 */
export const normalizePhoneDigits = (value) => {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.slice(0, PHONE_LENGTH);
};

/** True when the value is a complete, valid 11-digit mobile number. */
export const isValidPhoneNumber = (value) => PHONE_PATTERN.test(String(value ?? '').trim());

/** True when an optional phone field was left empty. */
export const isBlankPhone = (value) => String(value ?? '').trim() === '';

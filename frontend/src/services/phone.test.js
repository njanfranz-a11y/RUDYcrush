import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHONE_LENGTH,
  sanitizePhoneDigits,
  normalizePhoneDigits,
  isValidPhoneNumber,
  isBlankPhone,
} from './phone.js';

test('sanitizePhoneDigits keeps only digits', () => {
  assert.equal(sanitizePhoneDigits('0917 123 4567'), '09171234567');
  assert.equal(sanitizePhoneDigits('09ab17-123 4567'), '09171234567');
  assert.equal(sanitizePhoneDigits('+63 (917) 123-4567'), '63917123456');
  assert.equal(sanitizePhoneDigits('not a phone'), '');
});

test('sanitizePhoneDigits never exceeds 11 digits', () => {
  assert.equal(sanitizePhoneDigits('09171234567890').length, PHONE_LENGTH);
  assert.equal(sanitizePhoneDigits('09171234567890'), '09171234567');
});

test('normalizePhoneDigits converts a legacy +63 prefix to the local form', () => {
  assert.equal(normalizePhoneDigits('+63 917 000 0000'), '09170000000');
  assert.equal(normalizePhoneDigits('639170000000'), '09170000000');
  assert.equal(normalizePhoneDigits('09171234567'), '09171234567');
  assert.equal(normalizePhoneDigits(''), '');
});

test('isValidPhoneNumber only accepts a complete 11-digit mobile number', () => {
  assert.equal(isValidPhoneNumber('09171234567'), true);
  assert.equal(isValidPhoneNumber('09991234567'), true);
  assert.equal(isValidPhoneNumber('0917123'), false);
  assert.equal(isValidPhoneNumber('0917123456'), false);
  assert.equal(isValidPhoneNumber('091712345678'), false);
  assert.equal(isValidPhoneNumber('+639171234567'), false);
  assert.equal(isValidPhoneNumber('0917 123 4567'), false);
  assert.equal(isValidPhoneNumber('0917-123-4567'), false);
  assert.equal(isValidPhoneNumber('08171234567'), false);
  assert.equal(isValidPhoneNumber(''), false);
});

test('isBlankPhone treats an empty optional field as blank', () => {
  assert.equal(isBlankPhone(''), true);
  assert.equal(isBlankPhone('   '), true);
  assert.equal(isBlankPhone('09171234567'), false);
});

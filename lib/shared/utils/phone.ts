/**
 * Phone number utilities
 *
 * This module provides utilities for formatting and handling phone numbers.
 * Uses libphonenumber-js for international phone number formatting.
 *
 * REPLACES: 4+ duplicated phone formatting blocks throughout the codebase
 */

import { parsePhoneNumberWithError } from "libphonenumber-js";

/**
 * Formats a phone number for international display
 *
 * @param phone - Raw phone number string (may or may not have + prefix)
 * @returns Formatted phone number (e.g., "+1 234 567 8900") or original if parsing fails
 *
 * @example
 * formatPhoneNumber('+12345678900') // '+1 234 567 8900'
 * formatPhoneNumber('12345678900')  // '+1 234 567 8900'
 * formatPhoneNumber('invalid')      // 'invalid'
 * formatPhoneNumber(null)           // 'Unknown'
 */
export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return "Unknown";

  try {
    const formatted = phone.startsWith("+") ? phone : `+${phone}`;
    const parsed = parsePhoneNumberWithError(formatted);
    return parsed ? parsed.formatInternational() : phone;
  } catch {
    return phone;
  }
}

/**
 * Gets the last 2 digits of a phone number for avatar/initial display
 *
 * @param phone - Phone number string
 * @returns Last 2 digits or '??' if unavailable
 *
 * @example
 * getPhoneInitials('+12345678900') // '00'
 * getPhoneInitials('12345')        // '45'
 * getPhoneInitials(null)           // '??'
 */
export function getPhoneInitials(phone: string | undefined | null): string {
  if (!phone) return "??";
  return phone.slice(-2) || "??";
}

/**
 * Validates if a string is a valid phone number
 *
 * @param phone - Phone number string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidPhoneNumber('+12345678900') // true
 * isValidPhoneNumber('abc')          // false
 */
export function isValidPhoneNumber(phone: string): boolean {
  try {
    const formatted = phone.startsWith("+") ? phone : `+${phone}`;
    const parsed = parsePhoneNumberWithError(formatted);
    return parsed ? parsed.isValid() : false;
  } catch {
    return false;
  }
}

/**
 * Normalizes a phone number to E.164 format (+country_code_number)
 *
 * @param phone - Phone number to normalize
 * @returns Normalized phone number or null if invalid
 *
 * @example
 * normalizePhoneNumber('12345678900')  // '+12345678900'
 * normalizePhoneNumber('+12345678900') // '+12345678900'
 * normalizePhoneNumber('invalid')      // null
 */
export function normalizePhoneNumber(phone: string): string | null {
  try {
    const formatted = phone.startsWith("+") ? phone : `+${phone}`;
    const parsed = parsePhoneNumberWithError(formatted);
    return parsed ? parsed.number : null;
  } catch {
    return null;
  }
}

/**
 * Gets country code from phone number
 *
 * @param phone - Phone number
 * @returns Country code (e.g., 'US', 'GB') or null if not determinable
 *
 * @example
 * getPhoneCountryCode('+12345678900') // 'US'
 * getPhoneCountryCode('+441234567890') // 'GB'
 */
export function getPhoneCountryCode(phone: string): string | null {
  try {
    const formatted = phone.startsWith("+") ? phone : `+${phone}`;
    const parsed = parsePhoneNumberWithError(formatted);
    return parsed ? parsed.country || null : null;
  } catch {
    return null;
  }
}

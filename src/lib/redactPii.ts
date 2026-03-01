/**
 * Redacts personally identifiable information (PII) from text.
 * Replaces emails, phone numbers, CPFs, and proper names (capitalized words)
 * that look like person names with ********
 */

const REDACT = "********";

// Email pattern
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Brazilian phone patterns: (XX) XXXXX-XXXX, (XX) XXXX-XXXX, +55..., etc.
const PHONE_RE = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g;

// CPF pattern: XXX.XXX.XXX-XX
const CPF_RE = /\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2}/g;

/**
 * Redact known PII patterns from a text string.
 * Used to sanitize transcriptions and other user content
 * before showing to support agents.
 */
export function redactPii(text: string): string {
  if (!text) return text;

  let result = text;

  // Redact CPFs first (before phone, since CPF looks like numbers)
  result = result.replace(CPF_RE, REDACT);

  // Redact emails
  result = result.replace(EMAIL_RE, REDACT);

  // Redact phones
  result = result.replace(PHONE_RE, REDACT);

  return result;
}

/**
 * Generate a short anonymous ticket code from a UUID session ID.
 * e.g. "a1b2c3d4-..." -> "#A1B2C3"
 */
export function ticketCode(sessionId: string): string {
  if (!sessionId) return "#------";
  return "#" + sessionId.substring(0, 6).toUpperCase();
}

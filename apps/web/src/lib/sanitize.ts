import DOMPurify from 'isomorphic-dompurify';

// Allow only safe formatting tags in long-form HTML (job descriptions, reviews).
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p'];

/** Sanitize rich text — keeps basic formatting, strips scripts/iframes/etc. */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

/** Strip ALL HTML — for short plain-text fields (titles, names, answers). */
export function stripHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

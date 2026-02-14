/**
 * Shared utilities for the cascade pipeline.
 */

/** Lowercase, & → and, non-alphanumeric → hyphens, trim leading/trailing hyphens, collapse. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Trim + lowercase for dedup comparisons. */
export function normalize(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Extract numeric ID from a Payload relationship field value.
 * Handles: number (direct ID), object with `id`, or null/undefined.
 */
export function extractId(ref: unknown): number | null {
  if (ref === null || ref === undefined) return null
  if (typeof ref === 'number') return ref
  if (typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
    const id = (ref as Record<string, unknown>).id
    return typeof id === 'number' ? id : null
  }
  return null
}

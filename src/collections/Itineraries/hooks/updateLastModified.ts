import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Updates the lastModified field on every save (create and update).
 * This field is used for SEO purposes (sitemap lastmod, schema.org dateModified).
 */
export const updateLastModified: CollectionBeforeChangeHook = async ({ data }) => {
  data.lastModified = new Date().toISOString()
  return data
}

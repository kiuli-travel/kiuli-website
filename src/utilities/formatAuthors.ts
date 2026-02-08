import { Author, Post } from '@/payload-types'

/**
 * Formats an array of authors from Posts into a prettified string.
 * @param authors - The authors array from a Post (can be Author objects or IDs).
 * @returns A prettified string of authors.
 * @example
 *
 * [Author1, Author2] becomes 'Author1 and Author2'
 * [Author1, Author2, Author3] becomes 'Author1, Author2, and Author3'
 *
 */
export const formatAuthors = (authors: Post['authors']) => {
  if (!authors || authors.length === 0) return ''

  // Extract names from Author objects (skip IDs)
  const authorNames = authors
    .map((author) => {
      if (typeof author === 'object' && author !== null) {
        return (author as Author).name
      }
      return null
    })
    .filter(Boolean) as string[]

  if (authorNames.length === 0) return ''
  if (authorNames.length === 1) return authorNames[0]
  if (authorNames.length === 2) return `${authorNames[0]} and ${authorNames[1]}`

  return `${authorNames.slice(0, -1).join(', ')} and ${authorNames[authorNames.length - 1]}`
}

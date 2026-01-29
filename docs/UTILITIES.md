# Utilities Reference

Documentation for utility functions in Kiuli.

**Location:** `src/utilities/`

---

## URL Utilities

### getServerSideURL

**File:** `getURL.ts`

Returns the server-side base URL for API requests and absolute URLs.

```typescript
export const getServerSideURL = (): string
```

**Resolution Order:**
1. `NEXT_PUBLIC_SERVER_URL` environment variable
2. `VERCEL_PROJECT_PRODUCTION_URL` (with https prefix)
3. Fallback: `http://localhost:3000`

**Usage:**
```typescript
import { getServerSideURL } from '@/utilities/getURL'

const apiUrl = `${getServerSideURL()}/api/endpoint`
```

---

### getClientSideURL

**File:** `getURL.ts`

Returns the client-side base URL, detecting protocol and domain from window.

```typescript
export const getClientSideURL = (): string
```

**Resolution Order:**
1. Browser `window.location` (if in browser)
2. `VERCEL_PROJECT_PRODUCTION_URL` (with https prefix)
3. `NEXT_PUBLIC_SERVER_URL`
4. Fallback: empty string

**Usage:**
```typescript
import { getClientSideURL } from '@/utilities/getURL'

const baseUrl = getClientSideURL()
```

---

### getMediaUrl

**File:** `getMediaUrl.ts`

Processes media URLs to ensure proper formatting with optional cache busting.

```typescript
export const getMediaUrl = (
  url: string | null | undefined,
  cacheTag?: string | null
): string
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string \| null | Original URL from media resource |
| `cacheTag` | string \| null | Optional cache tag to append |

**Behavior:**
- Returns empty string if url is null/undefined
- Preserves full URLs (http/https)
- Prepends client-side URL for relative paths
- Appends encoded cache tag as query parameter

**Usage:**
```typescript
import { getMediaUrl } from '@/utilities/getMediaUrl'

// Full URL - returned as-is
getMediaUrl('https://example.com/image.jpg')
// => 'https://example.com/image.jpg'

// Relative path - prepends base URL
getMediaUrl('/media/image.jpg')
// => 'http://localhost:3000/media/image.jpg'

// With cache tag
getMediaUrl('/media/image.jpg', 'v123')
// => 'http://localhost:3000/media/image.jpg?v123'
```

---

## SEO Utilities

### generateMeta

**File:** `generateMeta.ts`

Generates Next.js Metadata object for pages with SEO optimization.

```typescript
export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
}): Promise<Metadata>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `doc` | Page \| Post \| null | Document with meta fields |

**Returns:** Next.js `Metadata` object with:
- `title` - Page title with " | Kiuli" suffix
- `description` - Meta description with default fallback
- `openGraph` - Merged OpenGraph data

**Title Format:**
- With custom title: `"{title} | Kiuli"`
- Default: `"Kiuli | Luxury African Safaris"`

**Image Resolution:**
1. `imgixUrl` from meta.image (preferred)
2. `sizes.og.url` from meta.image
3. Default: `/kiuli-og.jpg`

**Usage:**
```typescript
import { generateMeta } from '@/utilities/generateMeta'

export async function generateMetadata({ params }): Promise<Metadata> {
  const doc = await getDocument(params.slug)
  return generateMeta({ doc })
}
```

---

### mergeOpenGraph

**File:** `mergeOpenGraph.ts`

Merges custom OpenGraph data with Kiuli defaults.

```typescript
export const mergeOpenGraph = (
  og?: Metadata['openGraph']
): Metadata['openGraph']
```

**Default OpenGraph Values:**
```typescript
{
  type: 'website',
  description: 'Discover transformative African safari experiences...',
  images: [{ url: '/kiuli-og.jpg', width: 1200, height: 630 }],
  siteName: 'Kiuli',
  title: 'Kiuli | Luxury African Safaris',
}
```

**Merge Behavior:**
- Custom values override defaults
- Images are replaced entirely (not merged)

**Usage:**
```typescript
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

const og = mergeOpenGraph({
  title: 'Safari Adventure',
  description: 'Custom description',
})
```

---

## User Utilities

### getMeUser

**File:** `getMeUser.ts`

Retrieves the currently authenticated user from Payload session.

```typescript
export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{ token: string; user: User }>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `nullUserRedirect` | string | Redirect path if no user |
| `validUserRedirect` | string | Redirect path if user exists |

**Behavior:**
- Reads `payload-token` from cookies
- Fetches user from `/api/users/me`
- Redirects based on authentication status
- Returns token and user object

**Usage:**
```typescript
import { getMeUser } from '@/utilities/getMeUser'

// Require authentication - redirect to login if no user
const { user, token } = await getMeUser({
  nullUserRedirect: '/login',
})

// Redirect authenticated users away from login page
await getMeUser({
  validUserRedirect: '/admin',
})
```

---

## String Utilities

### toKebabCase

**File:** `toKebabCase.ts`

Converts a string to kebab-case format.

```typescript
export const toKebabCase = (string: string): string
```

**Transformations:**
1. Inserts hyphen between camelCase boundaries
2. Replaces spaces with hyphens
3. Converts to lowercase

**Examples:**
```typescript
import { toKebabCase } from '@/utilities/toKebabCase'

toKebabCase('HelloWorld')     // => 'hello-world'
toKebabCase('Hello World')    // => 'hello-world'
toKebabCase('myVariableName') // => 'my-variable-name'
```

---

### formatDateTime

**File:** `formatDateTime.ts`

Formats a timestamp string to MM/DD/YYYY format.

```typescript
export const formatDateTime = (timestamp: string): string
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `timestamp` | string | ISO date string |

**Returns:** Formatted date string (e.g., "01/29/2026")

**Usage:**
```typescript
import { formatDateTime } from '@/utilities/formatDateTime'

formatDateTime('2026-01-29T10:30:00.000Z')
// => '01/29/2026'
```

---

## Preview Utilities

### generatePreviewPath

**File:** `generatePreviewPath.ts`

Generates a preview URL path for draft content.

```typescript
export const generatePreviewPath = (props: {
  collection: 'posts' | 'pages'
  slug: string
  req: PayloadRequest
}): string | null
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `collection` | string | Collection slug |
| `slug` | string | Document slug |
| `req` | PayloadRequest | Payload request object |

**Collection Prefixes:**
| Collection | Prefix |
|------------|--------|
| `posts` | `/posts` |
| `pages` | `` (empty) |

**Returns:** Preview URL like `/next/preview?slug=...&collection=...&path=...&previewSecret=...`

**Usage:**
```typescript
import { generatePreviewPath } from '@/utilities/generatePreviewPath'

const previewUrl = generatePreviewPath({
  collection: 'posts',
  slug: 'my-post',
  req,
})
// => '/next/preview?slug=my-post&collection=posts&path=/posts/my-post&previewSecret=...'
```

---

## Object Utilities

### deepMerge

**File:** `deepMerge.ts`

Recursively merges two objects, with source values overriding target.

```typescript
export default function deepMerge<T, R>(target: T, source: R): T & R
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | T | Base object |
| `source` | R | Object to merge in |

**Behavior:**
- Nested objects are merged recursively
- Arrays are not merged (replaced)
- Source values override target values

**Usage:**
```typescript
import deepMerge from '@/utilities/deepMerge'

const result = deepMerge(
  { a: 1, b: { c: 2 } },
  { b: { d: 3 }, e: 4 }
)
// => { a: 1, b: { c: 2, d: 3 }, e: 4 }
```

---

### isObject

**File:** `deepMerge.ts`

Type guard to check if a value is a plain object.

```typescript
export function isObject(item: unknown): item is Record<string, unknown>
```

**Returns:** `true` if item is an object (not null, not array)

---

## Browser Utilities

### canUseDOM

**File:** `canUseDOM.ts`

Boolean indicating if code is running in a browser environment.

```typescript
export default boolean
```

**Value:** `true` if `window`, `window.document`, and `window.document.createElement` exist.

**Usage:**
```typescript
import canUseDOM from '@/utilities/canUseDOM'

if (canUseDOM) {
  // Safe to use browser APIs
  window.localStorage.setItem('key', 'value')
}
```

---

## React Hooks

### useDebounce

**File:** `useDebounce.ts`

Debounces a value, updating only after a delay.

```typescript
export function useDebounce<T>(value: T, delay?: number): T
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | T | - | Value to debounce |
| `delay` | number | 200 | Debounce delay in ms |

**Usage:**
```typescript
import { useDebounce } from '@/utilities/useDebounce'

function SearchComponent() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    // Only fires 300ms after user stops typing
    fetchResults(debouncedSearch)
  }, [debouncedSearch])
}
```

---

### useClickableCard

**File:** `useClickableCard.ts`

Makes an entire card clickable while preserving child link functionality.

*(Implementation details available in source file)*

---

## Utility Summary

| Utility | Purpose | Location |
|---------|---------|----------|
| `getServerSideURL` | Server-side base URL | getURL.ts |
| `getClientSideURL` | Client-side base URL | getURL.ts |
| `getMediaUrl` | Format media URLs | getMediaUrl.ts |
| `generateMeta` | Generate page metadata | generateMeta.ts |
| `mergeOpenGraph` | Merge OpenGraph data | mergeOpenGraph.ts |
| `getMeUser` | Get authenticated user | getMeUser.ts |
| `toKebabCase` | Convert to kebab-case | toKebabCase.ts |
| `formatDateTime` | Format date to MM/DD/YYYY | formatDateTime.ts |
| `generatePreviewPath` | Generate preview URLs | generatePreviewPath.ts |
| `deepMerge` | Deep merge objects | deepMerge.ts |
| `isObject` | Check if plain object | deepMerge.ts |
| `canUseDOM` | Check for browser environment | canUseDOM.ts |
| `useDebounce` | Debounce hook | useDebounce.ts |
| `useClickableCard` | Card click hook | useClickableCard.ts |

---

## See Also

- [FRONTEND_COMPONENTS.md](./FRONTEND_COMPONENTS.md) - Components using these utilities
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints

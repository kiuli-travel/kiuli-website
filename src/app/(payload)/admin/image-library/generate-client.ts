/**
 * Client-side helper to generate an image via the route handler.
 * Handles network errors, timeouts, and server errors uniformly.
 */
export async function generateImageViaApi(
  prompt: string,
  metadata: {
    type: string
    species?: string[]
    country?: string
    destination?: string
    aspectRatio?: string
  },
): Promise<{ mediaId: number; imgixUrl: string; model: string } | { error: string }> {
  try {
    const response = await fetch('/api/content/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, metadata }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || `Server error (${response.status})` }
    }

    if (!data.mediaId || !data.imgixUrl) {
      return { error: 'Server returned incomplete result' }
    }

    return data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { error: 'Network error — check your connection and try again' }
    }
    return { error: error instanceof Error ? error.message : 'Unknown error — please try again' }
  }
}

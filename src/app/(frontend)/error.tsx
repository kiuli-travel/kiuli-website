'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Frontend error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-playfair text-kiuli-charcoal mb-4">
          Something went wrong
        </h1>
        <p className="text-kiuli-charcoal/70 mb-8">
          We apologize for the inconvenience. Please try again or contact us if the problem
          persists.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-kiuli-teal text-white rounded hover:bg-kiuli-teal/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-kiuli-charcoal/20 text-kiuli-charcoal rounded hover:border-kiuli-charcoal/40 transition-colors"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  )
}

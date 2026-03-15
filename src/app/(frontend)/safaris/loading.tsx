export default function SafarisLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="bg-kiuli-gray/30 h-[50vh]" />

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-8">
        <div className="mb-4 h-10 w-64 rounded bg-kiuli-gray/40" />
        <div className="mb-12 h-5 w-96 rounded bg-kiuli-gray/20" />

        {/* Card grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[2px]">
              <div className="aspect-[4/3] bg-kiuli-gray/30" />
              <div className="space-y-3 py-5">
                <div className="h-5 w-3/4 rounded bg-kiuli-gray/30" />
                <div className="h-4 w-1/2 rounded bg-kiuli-gray/20" />
                <div className="h-4 w-1/3 rounded bg-kiuli-gray/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

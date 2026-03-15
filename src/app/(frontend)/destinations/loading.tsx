export default function DestinationsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="bg-kiuli-ivory px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 h-4 w-32 rounded bg-kiuli-gray/20" />
          <div className="mb-4 h-10 w-72 rounded bg-kiuli-gray/40" />
          <div className="h-5 w-[480px] max-w-full rounded bg-kiuli-gray/20" />
        </div>
      </div>

      {/* Card grid */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-[2px] bg-kiuli-gray/30" />
          ))}
        </div>
      </div>
    </div>
  )
}

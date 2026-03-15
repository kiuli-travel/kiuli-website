export default function PropertiesLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="bg-kiuli-ivory px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 h-4 w-32 rounded bg-kiuli-gray/20" />
          <div className="mb-4 h-10 w-64 rounded bg-kiuli-gray/40" />
          <div className="h-5 w-[440px] max-w-full rounded bg-kiuli-gray/20" />
        </div>
      </div>

      {/* Card grid */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[2px] border border-kiuli-gray/30">
              <div className="aspect-[5/3] bg-kiuli-gray/30" />
              <div className="space-y-2 p-4">
                <div className="h-5 w-2/3 rounded bg-kiuli-gray/30" />
                <div className="h-4 w-1/3 rounded bg-kiuli-gray/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

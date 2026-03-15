export default function ArticlesLoading() {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="bg-kiuli-ivory px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 h-4 w-32 rounded bg-kiuli-gray/20" />
          <div className="mb-4 h-10 w-48 rounded bg-kiuli-gray/40" />
          <div className="h-5 w-[400px] max-w-full rounded bg-kiuli-gray/20" />
        </div>
      </div>

      {/* Card grid */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[2px]">
              <div className="aspect-[16/9] bg-kiuli-gray/30" />
              <div className="space-y-3 py-5">
                <div className="h-3 w-20 rounded bg-kiuli-gray/20" />
                <div className="h-6 w-full rounded bg-kiuli-gray/30" />
                <div className="h-4 w-4/5 rounded bg-kiuli-gray/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

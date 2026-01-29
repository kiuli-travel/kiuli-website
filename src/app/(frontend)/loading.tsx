export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Animated loading spinner */}
        <div className="w-12 h-12 border-4 border-kiuli-teal/20 border-t-kiuli-teal rounded-full animate-spin" />
        <p className="text-kiuli-charcoal/60 text-sm">Loading...</p>
      </div>
    </div>
  )
}

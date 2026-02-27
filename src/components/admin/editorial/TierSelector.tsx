"use client"

type InvestmentTier = "essential" | "classic" | "premium" | "ultra" | null

interface TierSelectorProps {
  selectedTier: InvestmentTier
  onTierChange: (tier: InvestmentTier) => void
}

const TIERS: { id: Exclude<InvestmentTier, null>; name: string; price: string }[] = [
  { id: "essential", name: "Essential", price: "From $10,000 pp" },
  { id: "classic", name: "Classic", price: "From $20,000 pp" },
  { id: "premium", name: "Premium", price: "From $40,000 pp" },
  { id: "ultra", name: "Ultra Luxury", price: "From $75,000 pp" },
]

export function TierSelector({ selectedTier, onTierChange }: TierSelectorProps) {
  const hasTier = selectedTier !== null

  return (
    <div
      className={`border-l-4 ${hasTier ? "border-l-[#16A34A]" : "border-l-[#DC2626]"}`}
    >
      {/* Label */}
      <div className="px-3 pt-3 pb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#888]">
          Investment Tier
        </span>
      </div>

      {/* Grid of tier cards */}
      <div className="grid grid-cols-2 gap-2.5 px-3 pb-3">
        {TIERS.map((tier) => {
          const isSelected = selectedTier === tier.id
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onTierChange(isSelected ? null : tier.id)}
              className={`flex cursor-pointer items-start justify-between rounded-lg p-3 px-3.5 text-left transition-all duration-150 ${
                isSelected
                  ? "border-2 border-kiuli-teal bg-kiuli-teal/[0.06]"
                  : "border border-kiuli-gray bg-white hover:border-kiuli-teal hover:bg-[#FAFAFA]"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-kiuli-charcoal">
                  {tier.name}
                </span>
                <span className="text-[12px] text-[#888]">{tier.price}</span>
              </div>
              {/* Radio circle */}
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected
                    ? "border-kiuli-teal bg-kiuli-teal"
                    : "border-kiuli-gray bg-white"
                }`}
              >
                {isSelected && (
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Warning when no tier selected */}
      {!hasTier && (
        <div className="px-3 pb-3">
          <span className="text-[11px] text-[#DC2626]">
            Select a tier to enable publish
          </span>
        </div>
      )}
    </div>
  )
}

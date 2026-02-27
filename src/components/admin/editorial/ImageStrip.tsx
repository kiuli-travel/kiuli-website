"use client"

import { cn } from "@/utilities/ui"

export interface StripImage {
  id: string
  url: string
  alt: string
}

export interface ImageStripProps {
  images: StripImage[]
  imagesReviewed: boolean
  onImagesReviewedChange: (checked: boolean) => void
  onAddImage: () => void
  onRemoveImage: (id: string) => void
  className?: string
}

export function ImageStrip({
  images,
  imagesReviewed,
  onImagesReviewedChange,
  onAddImage,
  onRemoveImage,
  className,
}: ImageStripProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header Row */}
      <div
        className="flex items-center justify-between border-b border-kiuli-gray"
        style={{
          padding: "6px 12px",
        }}
      >
        <span
          className="font-sans"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "#666",
          }}
        >
          Images ({images.length})
        </span>

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={imagesReviewed}
            onChange={(e) => onImagesReviewedChange(e.target.checked)}
            className="cursor-pointer"
            style={{
              width: "13px",
              height: "13px",
              accentColor: "#486A6A",
            }}
          />
          <span
            className="font-sans"
            style={{
              fontSize: "12px",
              fontWeight: imagesReviewed ? 500 : 400,
              color: imagesReviewed ? "#16A34A" : "#404040",
            }}
          >
            Images Reviewed
          </span>
        </label>
      </div>

      {/* Thumbnail Row */}
      <div
        className="flex items-center scrollbar-hide"
        style={{
          padding: "8px 12px",
          gap: "6px",
          overflowX: "auto",
        }}
      >
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative shrink-0 border border-kiuli-gray"
            style={{
              width: "72px",
              height: "54px",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            {image.url ? (
              <img
                src={image.url}
                alt={image.alt}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ backgroundColor: "#E8E4DC" }}
              />
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveImage(image.id)
              }}
              className="absolute hidden group-hover:flex items-center justify-center cursor-pointer"
              style={{
                top: "3px",
                right: "3px",
                width: "16px",
                height: "16px",
                backgroundColor: "#DC2626",
                borderRadius: "50%",
                color: "white",
                fontSize: "10px",
                lineHeight: 1,
                border: "none",
                padding: 0,
              }}
              aria-label={`Remove image ${image.alt}`}
            >
              {"×"}
            </button>
          </div>
        ))}

        {/* Add button */}
        <button
          type="button"
          onClick={onAddImage}
          className="shrink-0 flex items-center justify-center cursor-pointer border-2 border-dashed border-kiuli-gray text-kiuli-gray"
          style={{
            width: "72px",
            height: "54px",
            borderRadius: "4px",
            background: "transparent",
            fontSize: "20px",
            fontWeight: 300,
            transition: "border-color 150ms, color 150ms",
          }}
          aria-label="Add image"
        >
          +
        </button>
      </div>
    </div>
  )
}

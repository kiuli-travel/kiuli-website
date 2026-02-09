import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { HomeHeroBlock } from '@/blocks/HomeHero/Component'
import { FeaturedItinerariesBlock } from '@/blocks/FeaturedItineraries/Component'
import { DestinationHighlightsBlock } from '@/blocks/DestinationHighlights/Component'
import { ValuePropositionBlock } from '@/blocks/ValueProposition/Component'
import { TestimonialBlock } from '@/blocks/Testimonial/Component'
import { FeaturedPropertiesBlock } from '@/blocks/FeaturedProperties/Component'

// Block components mapped by blockType - each component accepts its specific block props
const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  homeHero: HomeHeroBlock,
  featuredItineraries: FeaturedItinerariesBlock,
  destinationHighlights: DestinationHighlightsBlock,
  valueProposition: ValuePropositionBlock,
  testimonial: TestimonialBlock,
  featuredProperties: FeaturedPropertiesBlock,
} as const

type BlockType = keyof typeof blockComponents

// Block types that should render full-bleed without margin wrapper
const fullBleedBlocks = new Set(['homeHero'])

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block

          if (blockType && blockType in blockComponents) {
            // Type assertion through unknown is required because TypeScript cannot narrow
            // the union of block types to match the dynamically selected component.
            // Each block component expects its specific block type props.
            const Block = blockComponents[blockType as BlockType] as unknown as React.FC<
              typeof block & { disableInnerContainer?: boolean }
            >

            if (Block) {
              // Full-bleed blocks (like homeHero) render without wrapper
              if (fullBleedBlocks.has(blockType)) {
                return <Block key={index} {...block} disableInnerContainer />
              }

              return (
                <div className="my-16" key={index}>
                  <Block {...block} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}

import { HomepageHero } from '@/components/HomepageHero'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kiuli | Experience Travel Redefined',
  description: 'Handcrafted luxury safari journeys through Africa\'s wild heart. Discover Kenya, Tanzania, Botswana, Rwanda, and beyond with Kiuli.',
}

export default function HeroDemoPage() {
  return (
    <>
      <HomepageHero />
      
      {/* Placeholder content to demonstrate scroll behavior */}
      <section className="bg-kiuli-ivory py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-kiuli-charcoal mb-8">
            Curated Safari Experiences
          </h2>
          <p className="font-body text-lg text-kiuli-charcoal/80 max-w-2xl mb-12">
            Each journey is thoughtfully designed to connect you with Africa's most extraordinary landscapes 
            and wildlife encounters.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {['Kenya', 'Tanzania', 'Botswana'].map((destination) => (
              <div key={destination} className="bg-white rounded-sm p-8 border border-kiuli-gray">
                <h3 className="font-heading text-xl font-medium text-kiuli-charcoal mb-3">
                  {destination}
                </h3>
                <p className="font-body text-sm text-kiuli-charcoal/70">
                  Discover the magic of {destination} with our expert-guided safaris.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-kiuli-charcoal mb-8">
            Why Travel with Kiuli
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="font-heading text-lg font-medium text-kiuli-charcoal mb-3">
                Handpicked Properties
              </h3>
              <p className="font-body text-kiuli-charcoal/80">
                Every lodge and camp in our collection has been personally vetted for exceptional 
                service, comfort, and location.
              </p>
            </div>
            <div>
              <h3 className="font-heading text-lg font-medium text-kiuli-charcoal mb-3">
                Expert Guidance
              </h3>
              <p className="font-body text-kiuli-charcoal/80">
                Our team has decades of combined experience crafting unforgettable African journeys.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

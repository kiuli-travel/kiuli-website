// src/lib/hubspot.ts

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

interface HubSpotContactProperties {
  email: string
  firstname?: string
  lastname?: string
  phone?: string
  lifecyclestage?: string
  kiuli_gclid?: string
  kiuli_traffic_source?: string
  kiuli_landing_page?: string
  kiuli_session_id?: string
}

interface HubSpotDealProperties {
  dealname: string
  dealstage: string
  pipeline: string
  amount: string
  kiuli_projected_profit?: string
  kiuli_inquiry_type?: string
}

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotDeal {
  id: string
  properties: Record<string, string | null>
}

async function hubspotRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) {
    throw new Error('HUBSPOT_ACCESS_TOKEN not configured')
  }

  const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`HubSpot API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

export async function searchContactByEmail(email: string): Promise<HubSpotContact | null> {
  try {
    const result = await hubspotRequest('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email.toLowerCase(),
              },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'kiuli_gclid', 'kiuli_traffic_source'],
      }),
    })

    if (result.total > 0 && result.results.length > 0) {
      return result.results[0]
    }
    return null
  } catch (error) {
    console.error('HubSpot search error:', error)
    return null
  }
}

export async function createContact(
  properties: HubSpotContactProperties
): Promise<HubSpotContact> {
  return hubspotRequest('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  })
}

export async function updateContact(
  contactId: string,
  properties: Partial<HubSpotContactProperties>
): Promise<HubSpotContact> {
  return hubspotRequest(`/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  })
}

export async function createDeal(
  properties: HubSpotDealProperties,
  contactId: string
): Promise<HubSpotDeal> {
  return hubspotRequest('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify({
      properties,
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 3, // Contact to Deal
            },
          ],
        },
      ],
    }),
  })
}

// Build HTML Note body with full form data for travel designers
function buildInquiryNote(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  destinations: Array<{ code: string }>
  timingType: string
  travelDateStart?: string | null
  travelDateEnd?: string | null
  travelWindowEarliest?: string | null
  travelWindowLatest?: string | null
  partyType: string
  totalTravelers: number
  childrenCount: number
  interests: string[]
  budgetRange: string
  howHeard: string
  message?: string | null
  marketingConsent: boolean
  pageUrl?: string | null
  gclid?: string | null
  createdAt: string
}): string {
  const DESTINATION_LABELS: Record<string, string> = {
    TZ: 'Tanzania', KE: 'Kenya', BW: 'Botswana', RW: 'Rwanda',
    UG: 'Uganda', ZA: 'South Africa', NA: 'Namibia', ZM: 'Zambia',
    ZW: 'Zimbabwe', UNDECIDED: 'Not sure yet',
  }
  const INTEREST_LABELS: Record<string, string> = {
    migration: 'The Great Migration', gorillas: 'Gorilla & primate trekking',
    big_cats: 'Big cats & wildlife', beach: 'Beach & island escape',
    culture: 'Cultural immersion', walking: 'Walking & hiking safaris',
    wine_culinary: 'Wine & culinary', luxury_camp: 'Luxury lodges & camps',
    celebration: 'Honeymoon or celebration', photography: 'Photography safari',
    horse_riding: 'Horse riding safari', other: 'Something else',
  }
  const PARTY_LABELS: Record<string, string> = {
    solo: 'Solo', couple: 'Couple', family: 'Family',
    multigenerational: 'Multi-generational', friends: 'Friends',
    multiple_families: 'Multiple families', other: 'Other',
  }
  const BUDGET_LABELS: Record<string, string> = {
    '10k-15k': '$10,000 – $15,000', '15k-25k': '$15,000 – $25,000',
    '25k-40k': '$25,000 – $40,000', '40k-60k': '$40,000 – $60,000',
    '60k-80k': '$60,000 – $80,000', '80k-100k': '$80,000 – $100,000',
    '100k+': '$100,000+', unsure: 'Not sure yet',
  }
  const HOW_HEARD_LABELS: Record<string, string> = {
    google: 'Google search', ai: 'ChatGPT / AI',
    referral: 'Friend or family', advisor: 'Travel advisor',
    press: 'Magazine/publication', social: 'Social media',
    podcast: 'Podcast', returning: 'Returning customer', other: 'Other',
  }

  const destinations = data.destinations.map(d => DESTINATION_LABELS[d.code] || d.code).join(', ')
  const interests = data.interests.map(i => INTEREST_LABELS[i] || i).join(', ')

  let timing = ''
  if (data.timingType === 'specific' && data.travelDateStart) {
    timing = `${data.travelDateStart} to ${data.travelDateEnd || 'TBD'}`
  } else if (data.timingType === 'flexible' && data.travelWindowEarliest) {
    timing = `${data.travelWindowEarliest} to ${data.travelWindowLatest || 'TBD'}`
  } else {
    timing = 'Just exploring'
  }

  const party = PARTY_LABELS[data.partyType] || data.partyType
  const childrenNote = data.childrenCount > 0 ? ` (${data.childrenCount} under 18)` : ''
  const date = new Date(data.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  let html = `<h3>Safari Inquiry — ${date}</h3><table>`
  html += `<tr><td><strong>Destinations:</strong></td><td>${destinations}</td></tr>`
  html += `<tr><td><strong>Timing:</strong></td><td>${timing}</td></tr>`
  html += `<tr><td><strong>Party:</strong></td><td>${party} — ${data.totalTravelers} travelers${childrenNote}</td></tr>`
  html += `<tr><td><strong>Experiences:</strong></td><td>${interests}</td></tr>`
  html += `<tr><td><strong>Investment:</strong></td><td>${BUDGET_LABELS[data.budgetRange] || data.budgetRange} per person</td></tr>`
  html += `<tr><td><strong>How heard:</strong></td><td>${HOW_HEARD_LABELS[data.howHeard] || data.howHeard}</td></tr>`
  html += `</table>`
  if (data.message) html += `<br/><strong>Message:</strong><br/>${data.message}`
  if (data.gclid || data.pageUrl) {
    html += `<br/><br/><small><strong>Attribution</strong><br/>`
    if (data.pageUrl) html += `Page: ${data.pageUrl}<br/>`
    if (data.gclid) html += `GCLID: ${data.gclid}<br/>`
    html += `Marketing consent: ${data.marketingConsent ? 'Yes' : 'No'}</small>`
  }
  return html
}

// Create a HubSpot Note attached to contact and deal
async function createNote(
  noteBody: string,
  contactId: string,
  dealId: string
): Promise<{ id: string } | null> {
  try {
    return await hubspotRequest('/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
          { to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
        ],
      }),
    })
  } catch (error) {
    console.error('HubSpot Note creation failed:', error)
    return null
  }
}

function mapTrafficSource(gclid?: string | null, utmSource?: string | null): string {
  if (gclid) return 'google_ads'
  if (!utmSource) return 'direct'

  const source = utmSource.toLowerCase()
  if (source === 'google') return 'organic_search'
  if (['chatgpt', 'perplexity', 'claude', 'ai'].includes(source)) return 'ai_search'
  if (source === 'partner') return 'partner_referral'
  return 'direct'
}

export interface InquiryData {
  firstName: string
  lastName: string
  email: string
  phone: string
  projectedProfitCents: number
  sessionId?: string | null
  gclid?: string | null
  utmSource?: string | null
  landingPage?: string | null
  inquiryType: string
  // Full form data for HubSpot Note
  destinations?: Array<{ code: string }>
  timingType?: string
  travelDateStart?: string | null
  travelDateEnd?: string | null
  travelWindowEarliest?: string | null
  travelWindowLatest?: string | null
  partyType?: string
  totalTravelers?: number
  childrenCount?: number
  interests?: string[]
  budgetRange?: string
  howHeard?: string
  message?: string | null
  marketingConsent?: boolean
  pageUrl?: string | null
}

export interface HubSpotResult {
  contactId: string | null
  dealId: string | null
  error?: string
}

export async function createOrUpdateContactAndDeal(
  data: InquiryData
): Promise<HubSpotResult> {
  try {
    // 1. Search for existing contact
    const existingContact = await searchContactByEmail(data.email)

    let contactId: string

    if (existingContact) {
      // 2a. Update existing contact (preserve original attribution)
      const updateProps: Partial<HubSpotContactProperties> = {
        firstname: data.firstName,
        lastname: data.lastName,
        phone: data.phone,
        kiuli_session_id: data.sessionId || undefined,
      }

      // Only set attribution if not already set
      if (!existingContact.properties.kiuli_gclid && data.gclid) {
        updateProps.kiuli_gclid = data.gclid
      }
      if (!existingContact.properties.kiuli_traffic_source && (data.gclid || data.utmSource)) {
        updateProps.kiuli_traffic_source = mapTrafficSource(data.gclid, data.utmSource)
      }

      await updateContact(existingContact.id, updateProps)
      contactId = existingContact.id
      console.log(`HubSpot: Updated existing contact ${contactId}`)
    } else {
      // 2b. Create new contact
      const contact = await createContact({
        email: data.email.toLowerCase(),
        firstname: data.firstName,
        lastname: data.lastName,
        phone: data.phone,
        lifecyclestage: 'lead',
        kiuli_gclid: data.gclid || undefined,
        kiuli_traffic_source: mapTrafficSource(data.gclid, data.utmSource),
        kiuli_landing_page: data.landingPage || undefined,
        kiuli_session_id: data.sessionId || undefined,
      })
      contactId = contact.id
      console.log(`HubSpot: Created new contact ${contactId}`)
    }

    // 3. Create deal
    const dealAmount = Math.round(data.projectedProfitCents / 100)
    const deal = await createDeal(
      {
        dealname: `${data.firstName} ${data.lastName} - Safari Inquiry`,
        dealstage: '4690609358',  // First Contact stage
        pipeline: '3425899755',   // Kiuli Funnel pipeline
        amount: String(dealAmount),
        kiuli_projected_profit: String(dealAmount),
        kiuli_inquiry_type: data.inquiryType,
      },
      contactId
    )
    console.log(`HubSpot: Created deal ${deal.id} with amount ${dealAmount}`)

    // 4. Create Note with full form data (non-blocking)
    if (data.destinations && data.interests) {
      try {
        const noteBody = buildInquiryNote({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          destinations: data.destinations,
          timingType: data.timingType || 'exploring',
          travelDateStart: data.travelDateStart,
          travelDateEnd: data.travelDateEnd,
          travelWindowEarliest: data.travelWindowEarliest,
          travelWindowLatest: data.travelWindowLatest,
          partyType: data.partyType || 'other',
          totalTravelers: data.totalTravelers || 1,
          childrenCount: data.childrenCount || 0,
          interests: data.interests,
          budgetRange: data.budgetRange || 'unsure',
          howHeard: data.howHeard || 'other',
          message: data.message,
          marketingConsent: data.marketingConsent || false,
          pageUrl: data.pageUrl || data.landingPage,
          gclid: data.gclid,
          createdAt: new Date().toISOString(),
        })
        const note = await createNote(noteBody, contactId, deal.id)
        if (note) {
          console.log(`HubSpot: Created Note ${note.id} attached to contact and deal`)
        }
      } catch (noteError) {
        console.error('HubSpot Note creation failed (non-blocking):', noteError)
      }
    }

    return {
      contactId,
      dealId: deal.id,
    }
  } catch (error) {
    console.error('HubSpot integration error:', error)
    return {
      contactId: null,
      dealId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

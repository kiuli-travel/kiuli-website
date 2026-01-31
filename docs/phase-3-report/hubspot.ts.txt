// src/lib/hubspot.ts

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

interface HubSpotContactProperties {
  email: string
  firstname?: string
  lastname?: string
  phone?: string
  lifecyclestage?: string
  kiuli_gclid?: string
  traffic_source?: string
  landing_page_url?: string
  kiuli_session_id?: string
  inquiry_type?: string
}

interface HubSpotDealProperties {
  dealname: string
  dealstage: string
  pipeline: string
  amount: string
  projected_profit?: string
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
        properties: ['email', 'firstname', 'lastname', 'kiuli_gclid', 'traffic_source'],
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
        inquiry_type: data.inquiryType,
      }

      // Only set attribution if not already set
      if (!existingContact.properties.kiuli_gclid && data.gclid) {
        updateProps.kiuli_gclid = data.gclid
      }
      if (!existingContact.properties.traffic_source && (data.gclid || data.utmSource)) {
        updateProps.traffic_source = mapTrafficSource(data.gclid, data.utmSource)
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
        traffic_source: mapTrafficSource(data.gclid, data.utmSource),
        landing_page_url: data.landingPage || undefined,
        kiuli_session_id: data.sessionId || undefined,
        inquiry_type: data.inquiryType,
      })
      contactId = contact.id
      console.log(`HubSpot: Created new contact ${contactId}`)
    }

    // 3. Create deal
    const dealAmount = Math.round(data.projectedProfitCents / 100)
    const deal = await createDeal(
      {
        dealname: `${data.firstName} ${data.lastName} - Safari Inquiry`,
        dealstage: '4690609358', // First Contact stage
        pipeline: '3425899755', // Kiuli Funnel pipeline
        amount: String(dealAmount),
        projected_profit: String(dealAmount),
      },
      contactId
    )
    console.log(`HubSpot: Created deal ${deal.id} with amount $${dealAmount}`)

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

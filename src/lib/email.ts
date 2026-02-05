// src/lib/email.ts — Email sending functions using Resend

import { Resend } from 'resend'
import { render } from '@react-email/render'
import CustomerConfirmation from '@/emails/CustomerConfirmation'
import DesignerNotification from '@/emails/DesignerNotification'

// Lazy-load Resend client to avoid build-time errors
let resend: Resend | null = null
function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

interface Inquiry {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  destinations: string[]
  timingType: string
  travelWindowEarliest?: string
  travelWindowLatest?: string
  partyType: string
  totalTravelers: number
  interests: string[]
  budgetRange: string
  hubspotDealId: string
  trafficSource?: string
}

interface Designer {
  name: string
  email: string
}

export async function sendCustomerConfirmation(
  inquiry: Inquiry
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await render(
      CustomerConfirmation({
        firstName: inquiry.firstName,
        destinations: inquiry.destinations,
        budgetRange: inquiry.budgetRange,
      })
    )

    await getResend().emails.send({
      from: 'Kiuli <hello@kiuli.com>',
      to: inquiry.email,
      subject: 'Thank you for your safari inquiry',
      html,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Customer confirmation email failed:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function sendDesignerNotification(
  inquiry: Inquiry,
  designer: Designer
): Promise<{ success: boolean; error?: string }> {
  try {
    const travelWindow =
      inquiry.travelWindowEarliest && inquiry.travelWindowLatest
        ? `${inquiry.travelWindowEarliest} to ${inquiry.travelWindowLatest}`
        : undefined

    const hubspotDealUrl = `https://app.hubspot.com/contacts/145410644/deal/${inquiry.hubspotDealId}`

    const html = await render(
      DesignerNotification({
        designerName: designer.name,
        customerFirstName: inquiry.firstName,
        customerLastName: inquiry.lastName,
        customerEmail: inquiry.email,
        customerPhone: inquiry.phone,
        destinations: inquiry.destinations,
        timingType: inquiry.timingType,
        travelWindow,
        partyType: inquiry.partyType,
        totalTravelers: inquiry.totalTravelers,
        interests: inquiry.interests,
        budgetRange: inquiry.budgetRange,
        hubspotDealUrl,
        trafficSource: inquiry.trafficSource || 'unknown',
      })
    )

    // TESTING MODE: Send to graham@kiuli.com but address to designer
    const testingMode =
      process.env.NODE_ENV !== 'production' ||
      process.env.EMAIL_TESTING_MODE === 'true'

    await getResend().emails.send({
      from: 'Kiuli <hello@kiuli.com>',
      to: testingMode
        ? `${designer.name} <graham@kiuli.com>`
        : `${designer.name} <${designer.email}>`,
      subject: `New Safari Inquiry: ${inquiry.firstName} ${inquiry.lastName} - ${inquiry.destinations.join(', ')}`,
      html,
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Designer notification email failed:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

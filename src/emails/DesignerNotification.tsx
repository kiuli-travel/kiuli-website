// src/emails/DesignerNotification.tsx — Designer notification email template

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface DesignerNotificationProps {
  designerName: string
  customerFirstName: string
  customerLastName: string
  customerEmail: string
  customerPhone: string
  destinations: string[]
  timingType: string
  travelWindow?: string
  partyType: string
  totalTravelers: number
  interests: string[]
  budgetRange: string
  hubspotDealUrl: string
  trafficSource: string
}

export default function DesignerNotification({
  designerName,
  customerFirstName,
  customerLastName,
  customerEmail,
  customerPhone,
  destinations,
  timingType,
  travelWindow,
  partyType,
  totalTravelers,
  interests,
  budgetRange,
  hubspotDealUrl,
  trafficSource,
}: DesignerNotificationProps) {
  const customerName = `${customerFirstName} ${customerLastName}`

  return (
    <Html>
      <Head />
      <Preview>
        New Safari Inquiry: {customerName} - {destinations.join(', ')}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://kiuli.com/logos/kiuli-logo-teal.png"
            width="120"
            height="40"
            alt="Kiuli"
            style={logo}
          />

          <Heading style={h1}>New Inquiry Assigned</Heading>

          <Text style={text}>
            Hi {designerName}, you have been assigned a new safari inquiry.
          </Text>

          <Section style={detailsBox}>
            <Text style={detailsHeading}>Customer Information</Text>
            <Text style={detailsText}>
              <strong>Name:</strong> {customerName}
            </Text>
            <Text style={detailsText}>
              <strong>Email:</strong> {customerEmail}
            </Text>
            <Text style={detailsText}>
              <strong>Phone:</strong> {customerPhone}
            </Text>
          </Section>

          <Section style={detailsBox}>
            <Text style={detailsHeading}>Trip Details</Text>
            <Text style={detailsText}>
              <strong>Destinations:</strong> {destinations.join(', ')}
            </Text>
            <Text style={detailsText}>
              <strong>Timing:</strong> {timingType}
              {travelWindow ? ` (${travelWindow})` : ''}
            </Text>
            <Text style={detailsText}>
              <strong>Party:</strong> {partyType} ({totalTravelers} travelers)
            </Text>
            <Text style={detailsText}>
              <strong>Interests:</strong> {interests.join(', ')}
            </Text>
            <Text style={detailsText}>
              <strong>Budget Range:</strong> {budgetRange}
            </Text>
          </Section>

          <Section style={detailsBox}>
            <Text style={detailsHeading}>Attribution</Text>
            <Text style={detailsText}>
              <strong>Source:</strong> {trafficSource}
            </Text>
          </Section>

          <Link href={hubspotDealUrl} style={button}>
            View in HubSpot
          </Link>

          <Text style={text}>Please respond within 24 hours.</Text>

          <Text style={footer}>Kiuli Internal System</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#F5F3EB',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '600px',
}

const logo = {
  margin: '0 auto 40px',
  display: 'block' as const,
}

const h1 = {
  color: '#404040',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.4',
  margin: '0 0 20px',
}

const text = {
  color: '#404040',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

const detailsBox = {
  backgroundColor: '#F5F3EB',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 0',
}

const detailsHeading = {
  color: '#486A6A',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 12px',
}

const detailsText = {
  color: '#404040',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const button = {
  backgroundColor: '#DA7A5A',
  borderRadius: '4px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  margin: '20px 0',
}

const footer = {
  color: '#999999',
  fontSize: '14px',
  lineHeight: '1.6',
  marginTop: '40px',
  textAlign: 'center' as const,
}

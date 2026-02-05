// src/emails/CustomerConfirmation.tsx — Customer confirmation email template

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

interface CustomerConfirmationProps {
  firstName: string
  destinations: string[]
  budgetRange: string
}

export default function CustomerConfirmation({
  firstName,
  destinations,
  budgetRange,
}: CustomerConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Thank you for your safari inquiry - Kiuli</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://kiuli.com/logos/kiuli-logo-teal.png"
            width="120"
            height="40"
            alt="Kiuli"
            style={logo}
          />

          <Heading style={h1}>Thank you for your inquiry, {firstName}</Heading>

          <Text style={text}>
            We have received your safari inquiry and one of our travel designers
            will be in touch within 24 hours.
          </Text>

          <Section style={detailsBox}>
            <Text style={detailsHeading}>Your Inquiry</Text>
            <Text style={detailsText}>
              <strong>Destinations:</strong> {destinations.join(', ')}
            </Text>
            <Text style={detailsText}>
              <strong>Investment Range:</strong> {budgetRange}
            </Text>
          </Section>

          <Text style={text}>
            In the meantime, explore more safari experiences on our website.
          </Text>

          <Link href="https://kiuli.com/safaris" style={button}>
            Explore Safaris
          </Link>

          <Text style={footer}>
            Kiuli - Luxury African Safari Experiences
            <br />
            <Link href="https://kiuli.com" style={footerLink}>
              kiuli.com
            </Link>
          </Text>
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

const footerLink = {
  color: '#486A6A',
  textDecoration: 'none',
}

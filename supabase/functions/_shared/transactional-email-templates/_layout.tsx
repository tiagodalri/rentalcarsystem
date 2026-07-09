/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr, Link, Row, Column,
} from 'npm:@react-email/components@0.0.22'

// Sua Marca — Private bank visual identity
// Background sempre #ffffff (regra Lovable Emails)
export const zeus = {
  black: '#0a0a0a',
  ink: '#111111',
  gold: '#c9a961',
  goldDark: '#a8884a',
  muted: '#6b7280',
  border: '#e5e7eb',
  surface: '#fafafa',
  white: '#ffffff',
  font: '"Inter", "Helvetica Neue", Arial, sans-serif',
}

const main: React.CSSProperties = {
  backgroundColor: zeus.white,
  fontFamily: zeus.font,
  margin: 0,
  padding: 0,
  color: zeus.ink,
  WebkitFontSmoothing: 'antialiased',
}

const wrap: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: zeus.white,
}

const headerBar: React.CSSProperties = {
  backgroundColor: zeus.black,
  padding: '28px 32px',
  textAlign: 'center',
}

const brand: React.CSSProperties = {
  color: zeus.white,
  fontFamily: zeus.font,
  fontSize: '22px',
  fontWeight: 600,
  letterSpacing: '0.18em',
  margin: 0,
  textTransform: 'uppercase',
}

const tagline: React.CSSProperties = {
  color: zeus.gold,
  fontSize: '10px',
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  margin: '6px 0 0',
  fontWeight: 500,
}

const goldStripe: React.CSSProperties = {
  height: '3px',
  background: `linear-gradient(90deg, ${zeus.goldDark} 0%, ${zeus.gold} 50%, ${zeus.goldDark} 100%)`,
  lineHeight: '3px',
  fontSize: '0',
}

const content: React.CSSProperties = {
  padding: '36px 32px 12px',
}

const eyebrow: React.CSSProperties = {
  color: zeus.gold,
  fontSize: '10px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 600,
  margin: '0 0 10px',
}

const h1: React.CSSProperties = {
  color: zeus.black,
  fontSize: '26px',
  lineHeight: 1.25,
  fontWeight: 600,
  margin: '0 0 14px',
  letterSpacing: '-0.01em',
}

const lead: React.CSSProperties = {
  color: zeus.ink,
  fontSize: '15px',
  lineHeight: 1.6,
  margin: '0 0 24px',
}

const card: React.CSSProperties = {
  border: `1px solid ${zeus.border}`,
  borderRadius: '12px',
  padding: '20px 22px',
  backgroundColor: zeus.surface,
  margin: '0 0 20px',
}

const cardTitle: React.CSSProperties = {
  color: zeus.muted,
  fontSize: '10px',
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  fontWeight: 600,
  margin: '0 0 14px',
}

const rowLabel: React.CSSProperties = {
  color: zeus.muted,
  fontSize: '12px',
  fontWeight: 500,
  padding: '8px 0',
  width: '40%',
  verticalAlign: 'top',
}

const rowValue: React.CSSProperties = {
  color: zeus.ink,
  fontSize: '14px',
  fontWeight: 500,
  padding: '8px 0',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
}

const divider: React.CSSProperties = {
  borderTop: `1px solid ${zeus.border}`,
  margin: '0',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: zeus.black,
  color: zeus.white,
  padding: '14px 28px',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textDecoration: 'none',
  border: `1px solid ${zeus.gold}`,
}

const footer: React.CSSProperties = {
  padding: '32px',
  textAlign: 'center',
  borderTop: `1px solid ${zeus.border}`,
  marginTop: '24px',
}

const footerText: React.CSSProperties = {
  color: zeus.muted,
  fontSize: '11px',
  lineHeight: 1.6,
  margin: '0 0 6px',
}

const footerBrand: React.CSSProperties = {
  color: zeus.black,
  fontSize: '11px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 600,
  margin: '0 0 8px',
}

export interface KV { label: string; value: React.ReactNode }

export function DataCard({ title, items }: { title: string; items: KV[] }) {
  return (
    <Section style={card}>
      <Text style={cardTitle}>{title}</Text>
      {items.map((it, idx) => (
        <Row key={idx} style={idx < items.length - 1 ? { borderBottom: `1px solid ${zeus.border}` } : undefined}>
          <Column style={rowLabel}>{it.label}</Column>
          <Column style={rowValue}>{it.value ?? '—'}</Column>
        </Row>
      ))}
    </Section>
  )
}

export function PhotoGrid({ title, photos }: { title?: string; photos: string[] }) {
  if (!photos || photos.length === 0) return null
  const limited = photos.slice(0, 12)
  const rows: string[][] = []
  for (let i = 0; i < limited.length; i += 2) rows.push(limited.slice(i, i + 2))
  const cell: React.CSSProperties = { padding: '4px', width: '50%', verticalAlign: 'top' }
  const img: React.CSSProperties = {
    width: '100%', height: '160px', objectFit: 'cover',
    borderRadius: '10px', border: `1px solid ${zeus.border}`, display: 'block',
  }
  return (
    <Section style={{ margin: '0 0 20px' }}>
      {title ? <Text style={cardTitle}>{title}</Text> : null}
      {rows.map((r, i) => (
        <Row key={i}>
          {r.map((src, j) => (
            <Column key={j} style={cell}>
              <Img src={src} alt={`Foto ${i * 2 + j + 1}`} style={img} />
            </Column>
          ))}
          {r.length === 1 ? <Column style={cell}>&nbsp;</Column> : null}
        </Row>
      ))}
      {photos.length > limited.length ? (
        <Text style={{ ...rowLabel, textAlign: 'center', width: '100%', padding: '8px 0 0' }}>
          + {photos.length - limited.length} fotos adicionais no laudo
        </Text>
      ) : null}
    </Section>
  )
}

export interface LayoutProps {
  preview: string
  eyebrow?: string
  title: string
  children: React.ReactNode
}

export function ZeusLayout({ preview, eyebrow: eb, title, children }: LayoutProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={wrap}>
          <Section style={headerBar}>
            <Text style={brand}>SUA MARCA</Text>
            <Text style={tagline}>Rental Car · Orlando &amp; Miami</Text>
          </Section>
          <div style={goldStripe}>&nbsp;</div>

          <Section style={content}>
            {eb ? <Text style={eyebrow}>{eb}</Text> : null}
            <Heading as="h1" style={h1}>{title}</Heading>
            {children}
          </Section>

          <Section style={footer}>
            <Text style={footerBrand}>Sua Marca</Text>
            <Text style={footerText}>
              Atendimento concierge · WhatsApp <Link href="https://wa.me/15550000000" style={{ color: zeus.black, textDecoration: 'none' }}>+1 (555) 000-0000</Link>
            </Text>
            <Text style={footerText}>
              <Link href="https://rentalcarsystem.lovable.app" style={{ color: zeus.muted, textDecoration: 'none' }}>rentalcarsystem.lovable.app</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const styles = { button, lead, divider }

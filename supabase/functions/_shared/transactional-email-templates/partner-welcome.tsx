/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  agencyName?: string
  userFullName?: string
  userEmail?: string
  temporaryPassword?: string
  loginUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Bem-vindo à rede GoDalz Rent — ${p.agencyName ?? ''}`}
    eyebrow="GoDalz Rent"
    title="Sua parceria foi aprovada"
  >
    <Text style={styles.lead}>
      Olá {p.userFullName ?? ''}, a agência <strong>{p.agencyName ?? '—'}</strong> foi aprovada
      no programa GoDalz Rent. Seu acesso ao Portal do Parceiro já está liberado.
    </Text>

    <DataCard
      title="Credenciais de acesso"
      items={[
        { label: 'E-mail', value: p.userEmail ?? '—' },
        { label: 'Senha temporária', value: p.temporaryPassword ?? '—' },
      ]}
    />

    <Text style={styles.lead}>
      Por segurança, troque sua senha no primeiro acesso pelo Portal do Parceiro.
    </Text>

    {p.loginUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.loginUrl} style={styles.button}>
          Acessar o portal
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Bem-vindo à GoDalz Rent · ${d.agencyName ?? 'Portal do Parceiro'}`,
  displayName: 'Parceiro — boas-vindas',
  previewData: {
    agencyName: 'Viagens Bem-Vindo',
    userFullName: 'Ana Prado',
    userEmail: 'ana@viagensbv.com',
    temporaryPassword: 'Godalz#2026',
    loginUrl: 'https://rentalcarsystem.lovable.app/parceiro/login',
  },
} satisfies TemplateEntry

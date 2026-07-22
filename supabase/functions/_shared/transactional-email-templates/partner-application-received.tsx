/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  agencyName?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  cnpj?: string
  city?: string
  state?: string
  reviewUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Nova solicitação de parceria — ${p.agencyName ?? ''}`}
    eyebrow="Central de Parceiros"
    title="Nova solicitação de parceria"
  >
    <Text style={styles.lead}>
      A agência <strong>{p.agencyName ?? '—'}</strong> acaba de solicitar entrada no programa
      GoDalz Rent e está aguardando revisão.
    </Text>

    <DataCard
      title="Agência"
      items={[
        { label: 'Nome', value: p.agencyName ?? '—' },
        { label: 'CNPJ', value: p.cnpj ?? '—' },
        { label: 'Cidade / UF', value: [p.city, p.state].filter(Boolean).join(' / ') || '—' },
      ]}
    />

    <DataCard
      title="Contato"
      items={[
        { label: 'Responsável', value: p.contactName ?? '—' },
        { label: 'E-mail', value: p.contactEmail ?? '—' },
        { label: 'Telefone', value: p.contactPhone ?? '—' },
      ]}
    />

    {p.reviewUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.reviewUrl} style={styles.button}>
          Revisar solicitação
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Nova solicitação de parceria · ${d.agencyName ?? 'GoDalz Rent'}`,
  displayName: 'Parceria — nova solicitação',
  previewData: {
    agencyName: 'Viagens Bem-Vindo',
    contactName: 'Ana Prado',
    contactEmail: 'ana@viagensbv.com',
    contactPhone: '(11) 99999-0000',
    cnpj: '12.345.678/0001-90',
    city: 'São Paulo',
    state: 'SP',
    reviewUrl: 'https://rentalcarsystem.lovable.app/admin/platform/parceiros',
  },
} satisfies TemplateEntry

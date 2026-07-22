/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  agencyName?: string
  payoutKind?: string // "Comissão" | "Bônus"
  amount?: string
  reference?: string // ex.: reserva ZRC-0142 ou missão "20 reservas"
  paidAt?: string
  dashboardUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`${p.payoutKind ?? 'Pagamento'} processado — ${p.amount ?? ''}`}
    eyebrow="Portal do Parceiro"
    title={`${p.payoutKind ?? 'Pagamento'} processado`}
  >
    <Text style={styles.lead}>
      Olá {p.agencyName ?? 'parceiro'}, um pagamento foi marcado como concluído pela equipe
      GoDalz. O valor deve ser compensado em sua conta conforme o meio de repasse configurado.
    </Text>

    <DataCard
      title="Detalhes do pagamento"
      items={[
        { label: 'Tipo', value: p.payoutKind ?? '—' },
        { label: 'Valor', value: p.amount ?? '—' },
        { label: 'Referência', value: p.reference ?? '—' },
        { label: 'Processado em', value: p.paidAt ?? '—' },
      ]}
    />

    {p.dashboardUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.dashboardUrl} style={styles.button}>
          Ver extrato
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d.payoutKind ?? 'Pagamento'} processado · ${d.amount ?? ''}`.trim(),
  displayName: 'Parceiro — repasse processado',
  previewData: {
    agencyName: 'Viagens Bem-Vindo',
    payoutKind: 'Comissão',
    amount: 'USD 189,00',
    reference: 'Reserva ZRC-0142',
    paidAt: '12/07/2026 14:30',
    dashboardUrl: 'https://rentalcarsystem.lovable.app/parceiro/comissoes',
  },
} satisfies TemplateEntry

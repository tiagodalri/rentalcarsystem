/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  agencyName?: string
  customerName?: string
  vehicleName?: string
  pickupDate?: string
  pickupTime?: string
  pickupLocation?: string
  returnDate?: string
  returnTime?: string
  returnLocation?: string
  bookingNumber?: string
  totalPrice?: string
  dashboardUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Proposta aceita — reserva ${p.bookingNumber ?? ''}`}
    eyebrow="Portal do Parceiro"
    title="Cliente aceitou a proposta"
  >
    <Text style={styles.lead}>
      Boa notícia, {p.agencyName ?? 'parceiro'}! <strong>{p.customerName ?? 'O cliente'}</strong>{' '}
      aceitou a proposta e a reserva <strong>{p.bookingNumber ?? '—'}</strong> foi confirmada.
    </Text>

    <DataCard
      title="Reserva"
      items={[
        { label: 'Cliente', value: p.customerName ?? '—' },
        { label: 'Veículo', value: p.vehicleName ?? '—' },
        { label: 'Valor total', value: p.totalPrice ?? '—' },
      ]}
    />

    <DataCard
      title="Retirada"
      items={[
        { label: 'Data', value: p.pickupDate ?? '—' },
        { label: 'Horário', value: p.pickupTime ?? '—' },
        { label: 'Local', value: p.pickupLocation ?? '—' },
      ]}
    />

    <DataCard
      title="Devolução"
      items={[
        { label: 'Data', value: p.returnDate ?? '—' },
        { label: 'Horário', value: p.returnTime ?? '—' },
        { label: 'Local', value: p.returnLocation ?? '—' },
      ]}
    />

    {p.dashboardUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.dashboardUrl} style={styles.button}>
          Abrir portal do parceiro
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `Proposta aceita · reserva ${d.bookingNumber ?? ''} · ${d.customerName ?? ''}`.trim(),
  displayName: 'Parceiro — proposta aceita',
  previewData: {
    agencyName: 'Viagens Bem-Vindo',
    customerName: 'Rui Costa',
    vehicleName: 'Volkswagen Tiguan',
    pickupDate: '28/06/2026',
    pickupTime: '14:30',
    pickupLocation: 'MCO — Terminal A',
    returnDate: '05/07/2026',
    returnTime: '10:00',
    returnLocation: 'MCO — Terminal A',
    bookingNumber: 'ZRC-0142',
    totalPrice: 'USD 1.890,00',
    dashboardUrl: 'https://rentalcarsystem.lovable.app/parceiro/dashboard',
  },
} satisfies TemplateEntry

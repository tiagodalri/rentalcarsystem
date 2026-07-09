/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  bookingNumber?: string
  customerName?: string
  vehicleName?: string
  changeSummary?: string
  previousStatus?: string
  newStatus?: string
  pickupDate?: string
  returnDate?: string
  totalPrice?: string
  bookingUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Reserva ${p.bookingNumber ?? ''} foi atualizada`}
    eyebrow="Alteração de reserva"
    title="Reserva atualizada"
  >
    <Text style={styles.lead}>
      A reserva <strong>{p.bookingNumber ?? '—'}</strong> de{' '}
      <strong>{p.customerName ?? 'cliente'}</strong> recebeu uma atualização.
    </Text>

    <DataCard
      title="O que mudou"
      items={[
        { label: 'Resumo', value: p.changeSummary ?? '—' },
        { label: 'Status anterior', value: p.previousStatus ?? '—' },
        { label: 'Status atual', value: p.newStatus ?? '—' },
      ]}
    />

    <DataCard
      title="Reserva"
      items={[
        { label: 'Veículo', value: p.vehicleName ?? '—' },
        { label: 'Retirada', value: p.pickupDate ?? '—' },
        { label: 'Devolução', value: p.returnDate ?? '—' },
        { label: 'Valor total', value: p.totalPrice ?? '—' },
      ]}
    />

    {p.bookingUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.bookingUrl} style={styles.button}>
          Ver detalhes da reserva
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Reserva ${d.bookingNumber ?? ''} atualizada`,
  displayName: 'Alteração de reserva',
  previewData: {
    bookingNumber: 'ZRC-0142',
    customerName: 'Rui Costa',
    vehicleName: 'Volkswagen Tiguan',
    changeSummary: 'Status alterado',
    previousStatus: 'Confirmada',
    newStatus: 'Em andamento',
    pickupDate: '28/06/2026 · 14:30',
    returnDate: '05/07/2026 · 10:00',
    totalPrice: 'USD 1.890,00',
    bookingUrl: 'https://rentalcarsystem.lovable.app/admin/bookings/123',
  },
} satisfies TemplateEntry

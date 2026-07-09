/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  bookingNumber?: string
  customerName?: string
  vehicleName?: string
  pickupDate?: string
  returnDate?: string
  totalPrice?: string
  cancelledAt?: string
  bookingUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Reserva ${p.bookingNumber ?? ''} cancelada`}
    eyebrow="Cancelamento"
    title="Reserva cancelada"
  >
    <Text style={styles.lead}>
      A reserva <strong>{p.bookingNumber ?? '—'}</strong> de{' '}
      <strong>{p.customerName ?? 'cliente'}</strong> foi cancelada.
    </Text>

    <DataCard
      title="Reserva cancelada"
      items={[
        { label: 'Veículo', value: p.vehicleName ?? '—' },
        { label: 'Retirada prevista', value: p.pickupDate ?? '—' },
        { label: 'Devolução prevista', value: p.returnDate ?? '—' },
        { label: 'Valor', value: p.totalPrice ?? '—' },
        { label: 'Cancelada em', value: p.cancelledAt ?? '—' },
      ]}
    />

    {p.bookingUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.bookingUrl} style={styles.button}>
          Ver reserva
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Reserva ${d.bookingNumber ?? ''} cancelada`,
  displayName: 'Cancelamento de reserva',
  previewData: {
    bookingNumber: 'ZRC-0142',
    customerName: 'Rui Costa',
    vehicleName: 'Volkswagen Tiguan',
    pickupDate: '28/06/2026 · 14:30',
    returnDate: '05/07/2026 · 10:00',
    totalPrice: 'USD 1.890,00',
    cancelledAt: '27/06/2026 · 18:42',
    bookingUrl: 'https://rentalcarsystem.lovable.app/admin/bookings/123',
  },
} satisfies TemplateEntry

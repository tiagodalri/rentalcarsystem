/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, styles } from './_layout.tsx'

interface Props {
  bookingNumber?: string
  customerName?: string
  vehicleName?: string
  vehiclePlate?: string
  pickupDate?: string
  pickupTime?: string
  pickupLocation?: string
  returnDate?: string
  returnTime?: string
  returnLocation?: string
  totalPrice?: string
  paymentStatus?: string
  bookingUrl?: string
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Reserva ${p.bookingNumber ?? ''} confirmada — ${p.vehicleName ?? ''}`}
    eyebrow="Nova reserva"
    title="Reserva confirmada"
  >
    <Text style={styles.lead}>
      Reserva <strong>{p.bookingNumber ?? '—'}</strong> registrada com sucesso para{' '}
      <strong>{p.customerName ?? 'cliente'}</strong>.
    </Text>

    <DataCard
      title="Veículo"
      items={[
        { label: 'Modelo', value: p.vehicleName ?? '—' },
        { label: 'Placa', value: p.vehiclePlate ?? '—' },
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

    <DataCard
      title="Financeiro"
      items={[
        { label: 'Valor total', value: p.totalPrice ?? '—' },
        { label: 'Pagamento', value: p.paymentStatus ?? '—' },
      ]}
    />

    {p.bookingUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.bookingUrl} style={styles.button}>
          Abrir reserva no painel
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Reserva ${d.bookingNumber ?? 'confirmada'} · ${d.vehicleName ?? 'Sua Marca'}`,
  displayName: 'Reserva confirmada',
  previewData: {
    bookingNumber: 'ZRC-0142',
    customerName: 'Rui Costa',
    vehicleName: 'Volkswagen Tiguan',
    vehiclePlate: 'ABC-1234',
    pickupDate: '28/06/2026',
    pickupTime: '14:30',
    pickupLocation: 'MCO — Terminal A',
    returnDate: '05/07/2026',
    returnTime: '10:00',
    returnLocation: 'MCO — Terminal A',
    totalPrice: 'USD 1.890,00',
    paymentStatus: 'Pago',
    bookingUrl: 'https://rentalcarsystem.lovable.app/admin/bookings/123',
  },
} satisfies TemplateEntry

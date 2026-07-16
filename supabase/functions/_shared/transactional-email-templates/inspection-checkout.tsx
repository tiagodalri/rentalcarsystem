/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Button, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ZeusLayout, DataCard, PhotoGrid, styles } from './_layout.tsx'

interface Props {
  bookingNumber?: string
  customerName?: string
  vehicleName?: string
  vehiclePlate?: string
  odometerStart?: string
  odometerEnd?: string
  milesDriven?: string
  fuelLevel?: string
  damagesCount?: number
  photosCount?: number
  paymentStatus?: string
  inspectorName?: string
  completedAt?: string
  reportUrl?: string
  photos?: string[]
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Inspeção de retorno concluída — ${p.vehicleName ?? ''}`}
    eyebrow="Inspeção de retorno"
    title="Check-out concluído"
  >
    <Text style={styles.lead}>
      Devolução finalizada para a reserva <strong>{p.bookingNumber ?? '—'}</strong> ·{' '}
      <strong>{p.customerName ?? 'cliente'}</strong>.
    </Text>

    <DataCard
      title="Uso do veículo"
      items={[
        { label: 'Modelo', value: p.vehicleName ?? '—' },
        { label: 'Placa', value: p.vehiclePlate ?? '—' },
        { label: 'Odômetro entrada', value: p.odometerStart ?? '—' },
        { label: 'Odômetro saída', value: p.odometerEnd ?? '—' },
        { label: 'Milhas rodadas', value: p.milesDriven ?? '—' },
        { label: 'Combustível final', value: p.fuelLevel ?? '—' },
      ]}
    />

    <DataCard
      title="Laudo final"
      items={[
        { label: 'Avarias registradas', value: String(p.damagesCount ?? 0) },
        { label: 'Fotos anexadas', value: String(p.photosCount ?? 0) },
        { label: 'Status pagamento', value: p.paymentStatus ?? '—' },
        { label: 'Inspetor', value: p.inspectorName ?? '—' },
        { label: 'Concluído em', value: p.completedAt ?? '—' },
      ]}
    />

    <PhotoGrid title="Registro fotográfico" photos={p.photos ?? []} />

    {p.reportUrl && (
      <Section style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <Button href={p.reportUrl} style={styles.button}>
          Abrir laudo completo
        </Button>
      </Section>
    )}
  </ZeusLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Check-out concluído · ${d.vehicleName ?? 'GoDrive'} (${d.bookingNumber ?? ''})`,
  displayName: 'Inspeção de retorno',
  previewData: {
    bookingNumber: 'ZRC-0142',
    customerName: 'Rui Costa',
    vehicleName: 'Volkswagen Tiguan',
    vehiclePlate: 'ABC-1234',
    odometerStart: '24.812 mi',
    odometerEnd: '25.467 mi',
    milesDriven: '655 mi',
    fuelLevel: '8/8',
    damagesCount: 1,
    photosCount: 24,
    paymentStatus: 'Pago',
    inspectorName: 'Equipe GoDrive',
    completedAt: '05/07/2026 · 10:18',
    reportUrl: 'https://rentalcarsystem.lovable.app/i/abc123',
  },
} satisfies TemplateEntry

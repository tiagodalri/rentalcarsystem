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
  odometer?: string
  fuelLevel?: string
  damagesCount?: number
  photosCount?: number
  inspectorName?: string
  completedAt?: string
  reportUrl?: string
  photos?: string[]
}

const Email = (p: Props) => (
  <ZeusLayout
    preview={`Inspeção de entrega concluída — ${p.vehicleName ?? ''}`}
    eyebrow="Inspeção de entrega"
    title="Check-in concluído"
  >
    <Text style={styles.lead}>
      Inspeção de retirada finalizada para a reserva{' '}
      <strong>{p.bookingNumber ?? '—'}</strong> · <strong>{p.customerName ?? 'cliente'}</strong>.
    </Text>

    <DataCard
      title="Veículo"
      items={[
        { label: 'Modelo', value: p.vehicleName ?? '—' },
        { label: 'Placa', value: p.vehiclePlate ?? '—' },
        { label: 'Odômetro', value: p.odometer ?? '—' },
        { label: 'Combustível', value: p.fuelLevel ?? '—' },
      ]}
    />

    <DataCard
      title="Laudo"
      items={[
        { label: 'Avarias registradas', value: String(p.damagesCount ?? 0) },
        { label: 'Fotos anexadas', value: String(p.photosCount ?? 0) },
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
  subject: (d: Props) => `Check-in concluído · ${d.vehicleName ?? 'Sua Marca'} (${d.bookingNumber ?? ''})`,
  displayName: 'Inspeção de entrega',
  previewData: {
    bookingNumber: 'ZRC-0142',
    customerName: 'Rui Costa',
    vehicleName: 'Volkswagen Tiguan',
    vehiclePlate: 'ABC-1234',
    odometer: '24.812 mi',
    fuelLevel: '8/8',
    damagesCount: 0,
    photosCount: 18,
    inspectorName: 'Equipe Sua Marca',
    completedAt: '28/06/2026 · 14:47',
    reportUrl: 'https://rentalcarsystem.lovable.app/i/abc123',
  },
} satisfies TemplateEntry

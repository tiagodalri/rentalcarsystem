/// <reference types="npm:@types/react@18.3.1" />
import type { ComponentType } from 'npm:react@18.3.1'

import { template as bookingConfirmed } from './booking-confirmed.tsx'
import { template as bookingUpdated } from './booking-updated.tsx'
import { template as bookingCancelled } from './booking-cancelled.tsx'
import { template as inspectionCheckin } from './inspection-checkin.tsx'
import { template as inspectionCheckout } from './inspection-checkout.tsx'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmed': bookingConfirmed,
  'booking-updated': bookingUpdated,
  'booking-cancelled': bookingCancelled,
  'inspection-checkin': inspectionCheckin,
  'inspection-checkout': inspectionCheckout,
}

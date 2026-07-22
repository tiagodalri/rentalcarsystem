/// <reference types="npm:@types/react@18.3.1" />
import type { ComponentType } from 'npm:react@18.3.1'

import { template as bookingConfirmed } from './booking-confirmed.tsx'
import { template as bookingUpdated } from './booking-updated.tsx'
import { template as bookingCancelled } from './booking-cancelled.tsx'
import { template as inspectionCheckin } from './inspection-checkin.tsx'
import { template as inspectionCheckout } from './inspection-checkout.tsx'
import { template as partnerApplicationReceived } from './partner-application-received.tsx'
import { template as partnerWelcome } from './partner-welcome.tsx'
import { template as partnerProposalAccepted } from './partner-proposal-accepted.tsx'
import { template as partnerPayoutProcessed } from './partner-payout-processed.tsx'

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
  'partner-application-received': partnerApplicationReceived,
  'partner-welcome': partnerWelcome,
  'partner-proposal-accepted': partnerProposalAccepted,
  'partner-payout-processed': partnerPayoutProcessed,
}

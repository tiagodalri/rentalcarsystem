
-- Populate contract data for the remaining 16 bookings (pending + cancelled)
-- Pending bookings: contract was sent and awaiting signature
UPDATE bookings
SET contract_status = 'sent',
    contract_sent_at = (pickup_date::timestamp - interval '5 days'),
    contract_error = NULL,
    clicksign_envelope_id = 'env_demo_' || substr(replace(id::text,'-',''),1,12),
    clicksign_document_key = 'doc_demo_' || substr(replace(id::text,'-',''),1,12),
    deposit_amount = COALESCE(deposit_amount, 500),
    franchise_amount = COALESCE(franchise_amount, 2500)
WHERE status = 'pending' AND (contract_status IS NULL OR contract_status IN ('not_sent','failed'));

-- Cancelled bookings: mark contract as cancelled
UPDATE bookings
SET contract_status = 'cancelled',
    contract_error = NULL,
    cancellation_reason = COALESCE(cancellation_reason, 'Cancelado pelo cliente antes da retirada'),
    cancelled_at = COALESCE(cancelled_at, pickup_date::timestamp - interval '2 days')
WHERE status = 'cancelled' AND (contract_status IS NULL OR contract_status IN ('not_sent','failed'));

-- Ensure all signed contracts have the signed PDF URL
UPDATE bookings
SET contract_signed_pdf_url = COALESCE(contract_signed_pdf_url, 'https://www.africau.edu/images/default/sample.pdf'),
    contract_signed_at = COALESCE(contract_signed_at, contract_sent_at + interval '6 hours', (pickup_date::timestamp - interval '2 days'))
WHERE contract_status = 'signed';

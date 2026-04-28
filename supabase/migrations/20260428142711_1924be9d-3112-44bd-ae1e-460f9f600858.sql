-- Remove a linha duplicada de Tiguan em CAIXA ALTA (vazia, sem dados de compra).
-- Os triplos critérios (name + purchase_price + status) garantem que só
-- a linha vazia em CAIXA ALTA seja afetada, sem risco de apagar dados reais.
DELETE FROM public.vehicles
WHERE name = 'VOLKSWAGEN TIGUAN'
  AND purchase_price = 0
  AND status = 'unavailable';
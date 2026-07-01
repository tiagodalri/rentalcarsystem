-- Vincula transponders E-Pass restantes aos veiculos correspondentes (matches por placa)
UPDATE vehicles SET e_pass_transponder='723514' WHERE license_plate='FVUJ73';
UPDATE vehicles SET e_pass_transponder='726073' WHERE license_plate='82GBKQ';
UPDATE vehicles SET e_pass_transponder='726074' WHERE license_plate='10FYBQ';
UPDATE vehicles SET e_pass_transponder='727776' WHERE license_plate='XNF483';
UPDATE vehicles SET e_pass_transponder='727777' WHERE license_plate='XNI079';
UPDATE vehicles SET e_pass_transponder='727778' WHERE license_plate='EAG2501';
UPDATE vehicles SET e_pass_transponder='745613' WHERE license_plate='EAE1702';
UPDATE vehicles SET e_pass_transponder='745614' WHERE license_plate='SFHZ34';
UPDATE vehicles SET e_pass_transponder='745615' WHERE license_plate='EAD9055';
UPDATE vehicles SET e_pass_transponder='745616' WHERE license_plate='XGB889';
UPDATE vehicles SET e_pass_transponder='768288' WHERE license_plate='XNF482';
-- Kicks e Atlas (mapeamento invertido no cadastro atual): fixa pelo modelo/ano
UPDATE vehicles SET e_pass_transponder='727779' WHERE brand ILIKE '%Nissan%' AND model ILIKE '%Kicks%';
UPDATE vehicles SET e_pass_transponder='727780' WHERE brand ILIKE '%Volkswagen%' AND model ILIKE '%Atlas%';
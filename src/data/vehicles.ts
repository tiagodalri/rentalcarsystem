// Shared vehicle data with pricing
// Atualizado em 2026-04-28: adicionados Jeep Renegade, Porsche Macan,
// BMW 330, Nissan Rogue e Volkswagen Passat (ainda sem preço diário definido).

export interface VehicleData {
  name: string;
  categoryLabel: string;
  trim: string;
  passengers: number;
  dailyPrice: number;
}

export const vehiclePrices: Record<string, number> = {
  "Nissan Kicks": 46,
  "Kia Sportage": 61,
  "Kia Sorento": 81,
  "Mitsubishi Outlander": 81,
  "Volkswagen Tiguan": 81,
  "VOLKSWAGEN TIGUAN": 81,
  "Volkswagen Tiguan RLine": 91,
  "Dodge Durango": 101,
  "Chevrolet Suburban": 151,
  "Volkswagen Atlas": 151,
  "Lexus NX": 131,
  "Mercedes-Benz GLA": 131,
  "Volvo XC60": 161,
  "BMW X5 M Sport": 221,
  "Cadillac Escalade": 281,
  "Audi Q7": 281,
  "Chrysler Pacifica": 71,
  "Mustang Conversível": 321,
  "MUSTANG CONVERSÍVEL": 321,
  "Corvette Stingray C8": 652,
  "Jeep Renegade": 0,
  "Porsche Macan": 0,
  "BMW 330": 0,
  "Nissan Rogue": 0,
  "Volkswagen Passat": 0,
};

export const vehicleTrims: Record<string, string> = {
  "Nissan Kicks": "SV / SR",
  "Kia Sportage": "LX / EX",
  "Kia Sorento": "LX / EX",
  "Mitsubishi Outlander": "ES / SE",
  "Volkswagen Tiguan": "SE / SEL",
  "VOLKSWAGEN TIGUAN": "SE / SEL",
  "Volkswagen Tiguan RLine": "RLine",
  "Dodge Durango": "GT / SXT",
  "Chevrolet Suburban": "LT / Premier",
  "Volkswagen Atlas": "SE / SEL",
  "Lexus NX": "F Sport / Base",
  "Mercedes-Benz GLA": "GLA 250 / 4MATIC",
  "Volvo XC60": "R-Design / Inscription",
  "BMW X5 M Sport": "xDrive40i M Sport",
  "Cadillac Escalade": "Premium Luxury",
  "Audi Q7": "Premium Plus / Prestige",
  "Chrysler Pacifica": "Touring / Limited",
  "Mustang Conversível": "EcoBoost / GT",
  "MUSTANG CONVERSÍVEL": "EcoBoost / GT",
  "Corvette Stingray C8": "6.2 V8",
  "Jeep Renegade": "Sport / Limited",
  "Porsche Macan": "Base / S",
  "BMW 330": "330i xDrive",
  "Nissan Rogue": "S / SV / SL",
  "Volkswagen Passat": "S / SE",
};

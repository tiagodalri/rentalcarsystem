// Centralized cover image mapping for all vehicle names.
// Matching é tolerante (case-insensitive, por substring do modelo dentro do
// nome do veículo), então "2024 Toyota Camry SE" casa com "camry".
// Se nenhum modelo casar, retornamos um placeholder GoDrive (grafite +
// símbolo discreto) — nunca mais um quadrado preto vazio.

// Legacy premium covers (mantidos para uso em áreas de showroom)
import corvetteCover from "@/assets/fleet/covers/corvette-cover.jpg";
import mustangCover from "@/assets/fleet/covers/mustang-cover.jpg";
import escaladeCover from "@/assets/fleet/covers/escalade-cover.jpg";
import bmwX5Cover from "@/assets/fleet/covers/bmw-x5-cover.jpg";
import suburbanCover from "@/assets/fleet/covers/suburban-cover.jpg";
import durangoCover from "@/assets/fleet/covers/durango-cover.jpg";
import sorentoCover from "@/assets/fleet/covers/sorento-cover.jpg";
import sportageCover from "@/assets/fleet/covers/sportage-cover.jpg";
import outlanderCover from "@/assets/fleet/covers/outlander-cover.jpg";
import tiguanCover from "@/assets/fleet/covers/tiguan-cover.jpg";
import pacificaCover from "@/assets/fleet/covers/pacifica-cover.jpg";
import lexusNxCover from "@/assets/fleet/covers/lexus-nx-cover.jpg";
import audiQ7Cover from "@/assets/fleet/covers/audi-q7-cover.jpg";
import volvoXc60Cover from "@/assets/fleet/covers/volvo-xc60-cover.jpg";
import mustangWhiteCover from "@/assets/fleet/covers/mustang-white-cover.jpg";
import tiguanWhiteCover from "@/assets/fleet/covers/tiguan-white-cover.jpg";
import nissanKicksCover from "@/assets/fleet/covers/nissan-kicks-cover.jpg";
import vwAtlasCover from "@/assets/fleet/covers/vw-atlas-cover.jpg";
import mercedesGlaCover from "@/assets/fleet/covers/mercedes-gla-cover.jpg";

// Frota real (gerados)
import chevroletColorado from "@/assets/vehicles/chevrolet-colorado.jpg";
import chevroletEquinox from "@/assets/vehicles/chevrolet-equinox.jpg";
import chevroletMalibu from "@/assets/vehicles/chevrolet-malibu.jpg";
import chevroletTraverse from "@/assets/vehicles/chevrolet-traverse.jpg";
import fordEscape from "@/assets/vehicles/ford-escape.jpg";
import fordExplorer from "@/assets/vehicles/ford-explorer.jpg";
import fordFusion from "@/assets/vehicles/ford-fusion.jpg";
import fordRanger from "@/assets/vehicles/ford-ranger.jpg";
import hondaAccord from "@/assets/vehicles/honda-accord.jpg";
import hondaCivic from "@/assets/vehicles/honda-civic.jpg";
import hondaCrv from "@/assets/vehicles/honda-crv.jpg";
import hondaHrv from "@/assets/vehicles/honda-hrv.jpg";
import hondaPilot from "@/assets/vehicles/honda-pilot.jpg";
import hyundaiElantra from "@/assets/vehicles/hyundai-elantra.jpg";
import hyundaiSantafe from "@/assets/vehicles/hyundai-santafe.jpg";
import hyundaiSonata from "@/assets/vehicles/hyundai-sonata.jpg";
import hyundaiTucson from "@/assets/vehicles/hyundai-tucson.jpg";
import jeepCherokee from "@/assets/vehicles/jeep-cherokee.jpg";
import jeepCompass from "@/assets/vehicles/jeep-compass.jpg";
import kiaForte from "@/assets/vehicles/kia-forte.jpg";
import kiaK5 from "@/assets/vehicles/kia-k5.jpg";
import mazdaCx5 from "@/assets/vehicles/mazda-cx5.jpg";
import mazda3 from "@/assets/vehicles/mazda-mazda3.jpg";
import nissanAltima from "@/assets/vehicles/nissan-altima.jpg";
import nissanFrontier from "@/assets/vehicles/nissan-frontier.jpg";
import nissanPathfinder from "@/assets/vehicles/nissan-pathfinder.jpg";
import nissanRogue from "@/assets/vehicles/nissan-rogue.jpg";
import nissanSentra from "@/assets/vehicles/nissan-sentra.jpg";
import toyotaCamry from "@/assets/vehicles/toyota-camry.jpg";
import toyotaCorolla from "@/assets/vehicles/toyota-corolla.jpg";
import toyotaHighlander from "@/assets/vehicles/toyota-highlander.jpg";
import toyotaRav4 from "@/assets/vehicles/toyota-rav4.jpg";
import toyotaSienna from "@/assets/vehicles/toyota-sienna.jpg";
import toyotaTacoma from "@/assets/vehicles/toyota-tacoma.jpg";
import volkswagenJetta from "@/assets/vehicles/volkswagen-jetta.jpg";
import brandPlaceholder from "@/assets/vehicles/placeholder.jpg";

export const VEHICLE_PLACEHOLDER_IMAGE = brandPlaceholder;

// Mapa exato (nome canônico → imagem). Continua funcionando como antes.
export const vehicleCoverMap: Record<string, string> = {
  // Frota real (DB)
  "Chevrolet Colorado": chevroletColorado,
  "Chevrolet Equinox": chevroletEquinox,
  "Chevrolet Malibu": chevroletMalibu,
  "Chevrolet Traverse": chevroletTraverse,
  "Ford Escape": fordEscape,
  "Ford Explorer": fordExplorer,
  "Ford Fusion": fordFusion,
  "Ford Ranger": fordRanger,
  "Honda Accord": hondaAccord,
  "Honda Civic": hondaCivic,
  "Honda CR-V": hondaCrv,
  "Honda HR-V": hondaHrv,
  "Honda Pilot": hondaPilot,
  "Hyundai Elantra": hyundaiElantra,
  "Hyundai Santa Fe": hyundaiSantafe,
  "Hyundai Sonata": hyundaiSonata,
  "Hyundai Tucson": hyundaiTucson,
  "Jeep Cherokee": jeepCherokee,
  "Jeep Compass": jeepCompass,
  "Kia Forte": kiaForte,
  "Kia K5": kiaK5,
  "Kia Sorento": sorentoCover,
  "Kia Sportage": sportageCover,
  "Mazda CX-5": mazdaCx5,
  "Mazda Mazda3": mazda3,
  "Nissan Altima": nissanAltima,
  "Nissan Frontier": nissanFrontier,
  "Nissan Kicks": nissanKicksCover,
  "Nissan Pathfinder": nissanPathfinder,
  "Nissan Rogue": nissanRogue,
  "Nissan Sentra": nissanSentra,
  "Toyota Camry": toyotaCamry,
  "Toyota Corolla": toyotaCorolla,
  "Toyota Highlander": toyotaHighlander,
  "Toyota RAV4": toyotaRav4,
  "Toyota Sienna": toyotaSienna,
  "Toyota Tacoma": toyotaTacoma,
  "Volkswagen Atlas": vwAtlasCover,
  "Volkswagen Jetta": volkswagenJetta,
  "Volkswagen Tiguan": tiguanCover,

  // Showroom / premium legacy
  "Corvette Stingray C8": corvetteCover,
  "Mustang Conversível": mustangCover,
  "Cadillac Escalade": escaladeCover,
  "BMW X5 M Sport": bmwX5Cover,
  "Chevrolet Suburban": suburbanCover,
  "Dodge Durango": durangoCover,
  "Mitsubishi Outlander": outlanderCover,
  "Chrysler Pacifica": pacificaCover,
  "Lexus NX": lexusNxCover,
  "Audi Q7": audiQ7Cover,
  "Volvo XC60": volvoXc60Cover,
  "MUSTANG CONVERSÍVEL": mustangWhiteCover,
  "VOLKSWAGEN TIGUAN": tiguanWhiteCover,
  "Mercedes-Benz GLA": mercedesGlaCover,
};

// Índice para matching por substring (case-insensitive). Ordem importa:
// entradas mais específicas antes das genéricas para não capturar errado
// (ex.: "cr-v" antes de "civic" não é problema, mas "mustang conversível"
// antes de "mustang" evita fallback perdido).
const substringIndex: Array<[string, string]> = [
  // Chevrolet
  ["chevrolet colorado", chevroletColorado],
  ["chevrolet equinox", chevroletEquinox],
  ["chevrolet malibu", chevroletMalibu],
  ["chevrolet traverse", chevroletTraverse],
  ["chevrolet suburban", suburbanCover],
  ["corvette", corvetteCover],
  ["colorado", chevroletColorado],
  ["equinox", chevroletEquinox],
  ["malibu", chevroletMalibu],
  ["traverse", chevroletTraverse],
  ["suburban", suburbanCover],
  // Ford
  ["ford escape", fordEscape],
  ["ford explorer", fordExplorer],
  ["ford fusion", fordFusion],
  ["ford ranger", fordRanger],
  ["mustang conversível", mustangCover],
  ["mustang conversivel", mustangCover],
  ["mustang", mustangCover],
  ["escape", fordEscape],
  ["explorer", fordExplorer],
  ["fusion", fordFusion],
  ["ranger", fordRanger],
  // Honda
  ["honda accord", hondaAccord],
  ["honda civic", hondaCivic],
  ["honda cr-v", hondaCrv],
  ["honda crv", hondaCrv],
  ["honda hr-v", hondaHrv],
  ["honda hrv", hondaHrv],
  ["honda pilot", hondaPilot],
  ["accord", hondaAccord],
  ["civic", hondaCivic],
  ["cr-v", hondaCrv],
  ["hr-v", hondaHrv],
  ["pilot", hondaPilot],
  // Hyundai
  ["hyundai elantra", hyundaiElantra],
  ["hyundai santa fe", hyundaiSantafe],
  ["santa fe", hyundaiSantafe],
  ["santafe", hyundaiSantafe],
  ["hyundai sonata", hyundaiSonata],
  ["hyundai tucson", hyundaiTucson],
  ["elantra", hyundaiElantra],
  ["sonata", hyundaiSonata],
  ["tucson", hyundaiTucson],
  // Jeep
  ["jeep cherokee", jeepCherokee],
  ["jeep compass", jeepCompass],
  ["cherokee", jeepCherokee],
  ["compass", jeepCompass],
  // Kia
  ["kia forte", kiaForte],
  ["kia k5", kiaK5],
  ["kia sorento", sorentoCover],
  ["kia sportage", sportageCover],
  ["sorento", sorentoCover],
  ["sportage", sportageCover],
  ["forte", kiaForte],
  // Mazda
  ["mazda cx-5", mazdaCx5],
  ["mazda cx5", mazdaCx5],
  ["cx-5", mazdaCx5],
  ["mazda3", mazda3],
  ["mazda 3", mazda3],
  // Nissan
  ["nissan altima", nissanAltima],
  ["nissan frontier", nissanFrontier],
  ["nissan kicks", nissanKicksCover],
  ["nissan pathfinder", nissanPathfinder],
  ["nissan rogue", nissanRogue],
  ["nissan sentra", nissanSentra],
  ["altima", nissanAltima],
  ["frontier", nissanFrontier],
  ["kicks", nissanKicksCover],
  ["pathfinder", nissanPathfinder],
  ["rogue", nissanRogue],
  ["sentra", nissanSentra],
  // Toyota
  ["toyota camry", toyotaCamry],
  ["toyota corolla", toyotaCorolla],
  ["toyota highlander", toyotaHighlander],
  ["toyota rav4", toyotaRav4],
  ["toyota sienna", toyotaSienna],
  ["toyota tacoma", toyotaTacoma],
  ["camry", toyotaCamry],
  ["corolla", toyotaCorolla],
  ["highlander", toyotaHighlander],
  ["rav4", toyotaRav4],
  ["sienna", toyotaSienna],
  ["tacoma", toyotaTacoma],
  // Volkswagen
  ["volkswagen atlas", vwAtlasCover],
  ["volkswagen jetta", volkswagenJetta],
  ["volkswagen tiguan rline", tiguanCover],
  ["volkswagen tiguan", tiguanCover],
  ["vw atlas", vwAtlasCover],
  ["vw tiguan", tiguanCover],
  ["vw jetta", volkswagenJetta],
  ["atlas", vwAtlasCover],
  ["jetta", volkswagenJetta],
  ["tiguan", tiguanCover],
  // Premium legacy
  ["escalade", escaladeCover],
  ["bmw x5", bmwX5Cover],
  ["x5", bmwX5Cover],
  ["durango", durangoCover],
  ["outlander", outlanderCover],
  ["pacifica", pacificaCover],
  ["lexus nx", lexusNxCover],
  ["audi q7", audiQ7Cover],
  ["volvo xc60", volvoXc60Cover],
  ["xc60", volvoXc60Cover],
  ["mercedes-benz gla", mercedesGlaCover],
  ["mercedes gla", mercedesGlaCover],
];

export function getCoverImage(vehicleName: string | null | undefined): string {
  if (!vehicleName) return brandPlaceholder;
  // Exact match (rápido)
  if (vehicleCoverMap[vehicleName]) return vehicleCoverMap[vehicleName];
  const lower = vehicleName.toLowerCase();
  for (const [needle, img] of substringIndex) {
    if (lower.includes(needle)) return img;
  }
  return brandPlaceholder;
}

export function hasCoverImage(vehicleName: string | null | undefined): boolean {
  if (!vehicleName) return false;
  if (vehicleCoverMap[vehicleName]) return true;
  const lower = vehicleName.toLowerCase();
  return substringIndex.some(([needle]) => lower.includes(needle));
}

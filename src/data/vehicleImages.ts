// Centralized cover image mapping for all vehicle names
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

export const vehicleCoverMap: Record<string, string> = {
  "Corvette Stingray C8": corvetteCover,
  "Mustang Conversível": mustangCover,
  "Cadillac Escalade": escaladeCover,
  "BMW X5 M Sport": bmwX5Cover,
  "Chevrolet Suburban": suburbanCover,
  "Dodge Durango": durangoCover,
  "Kia Sorento": sorentoCover,
  "Kia Sportage": sportageCover,
  "Mitsubishi Outlander": outlanderCover,
  "Volkswagen Tiguan": tiguanCover,
  "Chrysler Pacifica": pacificaCover,
  "Lexus NX": lexusNxCover,
  "Audi Q7": audiQ7Cover,
  "Volvo XC60": volvoXc60Cover,
  "MUSTANG CONVERSÍVEL": mustangWhiteCover,
  "VOLKSWAGEN TIGUAN": tiguanWhiteCover,
  "Nissan Kicks": nissanKicksCover,
  "Volkswagen Atlas": vwAtlasCover,
  "Mercedes-Benz GLA": mercedesGlaCover,
};

export function getCoverImage(vehicleName: string): string {
  return vehicleCoverMap[vehicleName] || "/placeholder.svg";
}

export function hasCoverImage(vehicleName: string): boolean {
  return Boolean(vehicleCoverMap[vehicleName]);
}

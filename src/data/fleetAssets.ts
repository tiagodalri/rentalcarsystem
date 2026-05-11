// Cover images (cinematic)
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

const galleryImageMap = import.meta.glob("../assets/fleet/*.{jpg,jpeg,png}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const galleryThumbMap = import.meta.glob("../assets/fleet/thumbs/*.{jpg,jpeg,png}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const galleryViews = ["front", "dashboard", "interior", "rear"] as const;

const buildGallery = (slug: string) => {
  const images: string[] = [];
  const thumbs: string[] = [];

  for (const view of galleryViews) {
    const img = galleryImageMap[`../assets/fleet/${slug}-${view}.jpg`];
    if (img) {
      images.push(img);
      const thumb = galleryThumbMap[`../assets/fleet/thumbs/${slug}-${view}-thumb.jpg`] ?? img;
      thumbs.push(thumb);
    }
  }

  const baseImg = galleryImageMap[`../assets/fleet/${slug}.jpg`];
  if (baseImg && !images.includes(baseImg)) {
    images.push(baseImg);
    thumbs.push(baseImg);
  }

  return { images, thumbs };
};

export const coverImageMap: Record<string, string> = {
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

export const galleryMap: Record<string, { images: string[]; thumbs: string[] }> = {
  "Corvette Stingray C8": buildGallery("corvette"),
  "Mustang Conversível": buildGallery("mustang"),
  "Cadillac Escalade": buildGallery("escalade"),
  "BMW X5 M Sport": buildGallery("bmw-x5"),
  "Chevrolet Suburban": buildGallery("suburban"),
  "Dodge Durango": buildGallery("durango"),
  "Kia Sorento": buildGallery("sorento"),
  "Kia Sportage": buildGallery("sportage"),
  "Mitsubishi Outlander": buildGallery("outlander"),
  "Volkswagen Tiguan": buildGallery("tiguan"),
  "Chrysler Pacifica": buildGallery("pacifica"),
  "Lexus NX": buildGallery("lexus-nx"),
  "Audi Q7": buildGallery("audi-q7"),
  "Volvo XC60": buildGallery("volvo-xc60"),
  "MUSTANG CONVERSÍVEL": buildGallery("mustang-white"),
  "VOLKSWAGEN TIGUAN": buildGallery("tiguan-white"),
  "Nissan Kicks": buildGallery("nissan-kicks"),
  "Volkswagen Atlas": buildGallery("vw-atlas"),
  "Mercedes-Benz GLA": buildGallery("mercedes-gla"),
};

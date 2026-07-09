// Screenshot registry for the guided tutorials.
// Each entry resolves to a CDN-hosted image of the real Sua Marca admin screen.
import painel from "@/assets/tutorials/painel.jpg.asset.json";
import opsToday from "@/assets/tutorials/ops-today.jpg.asset.json";
import bookings from "@/assets/tutorials/bookings.jpg.asset.json";
import bookingDetail from "@/assets/tutorials/booking-detail.jpg.asset.json";
import inspectionOverview from "@/assets/tutorials/inspection-overview.jpg.asset.json";
import inspectionOdometro from "@/assets/tutorials/inspection-odometro.jpg.asset.json";
import inspectionAvarias from "@/assets/tutorials/inspection-avarias.jpg.asset.json";
import inspectionFotos from "@/assets/tutorials/inspection-fotos.jpg.asset.json";
import inspectionAcessorios from "@/assets/tutorials/inspection-acessorios.jpg.asset.json";
import inspectionAssinaturas from "@/assets/tutorials/inspection-assinaturas.jpg.asset.json";
import calendar from "@/assets/tutorials/calendar.jpg.asset.json";
import fleet from "@/assets/tutorials/fleet.jpg.asset.json";
import tutoriais from "@/assets/tutorials/tutoriais.jpg.asset.json";

export const TUTORIAL_SCREENS = {
  painel: painel.url,
  opsToday: opsToday.url,
  bookings: bookings.url,
  bookingDetail: bookingDetail.url,
  inspectionOverview: inspectionOverview.url,
  inspectionOdometro: inspectionOdometro.url,
  inspectionAvarias: inspectionAvarias.url,
  inspectionFotos: inspectionFotos.url,
  inspectionAcessorios: inspectionAcessorios.url,
  inspectionAssinaturas: inspectionAssinaturas.url,
  calendar: calendar.url,
  fleet: fleet.url,
  tutoriais: tutoriais.url,
} as const;

export type TutorialScreenKey = keyof typeof TUTORIAL_SCREENS;

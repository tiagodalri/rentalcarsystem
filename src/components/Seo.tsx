import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  path: string; // e.g. "/frota"
  image?: string;
  /** Optional extra <script type="application/ld+json"> block content */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = "https://rentalcarsystem.lovable.app";
const DEFAULT_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/eJRDSYFo9SVAiVDZ22i9nrIZiHm1/social-images/social-1774539847105-Captura_de_Tela_2026-03-26_%C3%A0s_12.43.49.webp";

/**
 * Per-route head: title, description, canonical, OG and optional JSON-LD.
 * <title> and <meta name="..."> dedupe automatically by name; <link rel="canonical">
 * does NOT dedupe, so the static index.html canonical was removed in favor of
 * route-owned canonicals via this component.
 */
export function Seo({ title, description, path, image, jsonLd }: SeoProps) {
  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const img = image || DEFAULT_IMAGE;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content="website" />

      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      <meta name="twitter:card" content="summary_large_image" />

      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Helmet>
  );
}

export default Seo;

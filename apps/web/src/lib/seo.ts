export const SITE_ORIGIN = "https://myparlaypal.com";
export const SITE_NAME = "ParlayPal";
export const SITE_TITLE = "Live Parlay Tracker & Bet Slip Analyzer | ParlayPal";
export const SITE_DESCRIPTION =
  "Upload a bet slip from any sportsbook, follow every player and team leg live, and get scheduled updates as your parlay moves.";
export const SITE_LOGO_URL = `${SITE_ORIGIN}/images/logo.png`;
export const SITE_LOGO_ICON_URL = `${SITE_ORIGIN}/images/logo-icon.png`;
export const SITE_OG_IMAGE_URL = `${SITE_ORIGIN}/og-image.png`;
export const SITE_OG_IMAGE_ALT =
  "ParlayPal live parlay tracker with a sportsbook bet slip and player progress card";

export const absoluteUrl = (path: string): string => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
};

export const socialMeta = ({
  description,
  image = SITE_OG_IMAGE_URL,
  imageAlt = SITE_OG_IMAGE_ALT,
  title,
  type = "website",
  url,
}: {
  description: string;
  image?: string;
  imageAlt?: string;
  title: string;
  type?: "article" | "website";
  url: string;
}) => [
  { content: title, property: "og:title" },
  { content: description, property: "og:description" },
  { content: type, property: "og:type" },
  { content: "en_US", property: "og:locale" },
  { content: url, property: "og:url" },
  { content: image, property: "og:image" },
  { content: "image/png", property: "og:image:type" },
  { content: imageAlt, property: "og:image:alt" },
  { content: "1200", property: "og:image:width" },
  { content: "630", property: "og:image:height" },
  { content: SITE_NAME, property: "og:site_name" },
  { content: "summary_large_image", name: "twitter:card" },
  { content: title, name: "twitter:title" },
  { content: description, name: "twitter:description" },
  { content: image, name: "twitter:image" },
  { content: imageAlt, name: "twitter:image:alt" },
];

export const noIndexMeta = {
  content: "noindex, nofollow, noarchive",
  name: "robots",
};

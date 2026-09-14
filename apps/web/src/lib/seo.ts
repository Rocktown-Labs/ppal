export const SITE_ORIGIN = "https://myparlaypal.com";
export const SITE_NAME = "ParlayPal";
export const SITE_DESCRIPTION =
  "Track every parlay leg live from any sportsbook. Upload a bet slip, verify picks with AI, follow player stats, and build a transparent betting record.";
export const SITE_LOGO_URL = `${SITE_ORIGIN}/images/logo.png`;

export const absoluteUrl = (path: string): string => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
};

export const socialMeta = ({
  description,
  image = SITE_LOGO_URL,
  title,
  type = "website",
  url,
}: {
  description: string;
  image?: string;
  title: string;
  type?: "article" | "website";
  url: string;
}) => [
  { content: title, property: "og:title" },
  { content: description, property: "og:description" },
  { content: type, property: "og:type" },
  { content: url, property: "og:url" },
  { content: image, property: "og:image" },
  { content: SITE_NAME, property: "og:site_name" },
  { content: "summary", name: "twitter:card" },
  { content: title, name: "twitter:title" },
  { content: description, name: "twitter:description" },
  { content: image, name: "twitter:image" },
];

export const noIndexMeta = {
  content: "noindex, nofollow, noarchive",
  name: "robots",
};

export const DEFAULT_SITE_URL = 'https://atrani.ru';
export const DEFAULT_RESPONSIVE_WIDTHS = [640, 960, 1280, 1600, 1920, 2560];
// Matches the Ghost image sizes enabled on the VPS. Unsupported widths
// redirect to the original image, so srcset candidates are normalized.
export const GHOST_SUPPORTED_WIDTHS = [160, 320, 600, 960, 1000, 1200, 1600, 2000, 2400];
export const DEFAULT_GHOST_WIDTHS = [600, 960, 1200, 1600, 2000, 2400];

const GHOST_IMAGE_PREFIX = '/blog/content/images/';
const GHOST_SIZE_RE = /^\/blog\/content\/images\/size\/w\d+\//;
const RASTER_RE = /\.(avif|gif|jpe?g|png|webp)$/i;

export function toAbsoluteUrl(src, siteUrl = DEFAULT_SITE_URL) {
  if (!src) return null;
  return /^https?:\/\//i.test(src) ? src : new URL(src, siteUrl).href;
}

export function isGhostImageUrl(src, siteUrl = DEFAULT_SITE_URL) {
  const absolute = toAbsoluteUrl(src, siteUrl);
  if (!absolute) return false;

  try {
    const url = new URL(absolute);
    const expected = new URL(siteUrl);
    return url.origin === expected.origin &&
      url.pathname.startsWith(GHOST_IMAGE_PREFIX) &&
      RASTER_RE.test(url.pathname);
  } catch {
    return false;
  }
}

export function buildGhostSizeUrl(src, width, siteUrl = DEFAULT_SITE_URL) {
  if (!Number.isFinite(width) || width <= 0 || !isGhostImageUrl(src, siteUrl)) {
    return null;
  }

  const supportedWidth = getNearestGhostWidth(width);
  const url = new URL(toAbsoluteUrl(src, siteUrl));
  const contentPath = url.pathname
    .replace(GHOST_SIZE_RE, GHOST_IMAGE_PREFIX)
    .replace(GHOST_IMAGE_PREFIX, '');

  url.pathname = `${GHOST_IMAGE_PREFIX}size/w${supportedWidth}/${contentPath}`;
  return url.href;
}

export function buildGhostSrcSet(src, widths = DEFAULT_GHOST_WIDTHS, siteUrl = DEFAULT_SITE_URL) {
  if (!isGhostImageUrl(src, siteUrl)) return null;

  const candidates = [...new Set(widths)]
    .filter((width) => Number.isFinite(width) && width > 0)
    .map(getNearestGhostWidth)
    .filter((width, index, all) => all.indexOf(width) === index)
    .sort((a, b) => a - b);

  if (candidates.length === 0) return null;

  return candidates
    .map((width) => `${buildGhostSizeUrl(src, width, siteUrl)} ${Math.round(width)}w`)
    .join(', ');
}

export function getNearestGhostWidth(width) {
  const requestedWidth = Math.round(width);
  return GHOST_SUPPORTED_WIDTHS.find((candidate) => candidate >= requestedWidth) ??
    GHOST_SUPPORTED_WIDTHS[GHOST_SUPPORTED_WIDTHS.length - 1];
}

export function getResponsiveWidths(intrinsicWidth, standardWidths = DEFAULT_RESPONSIVE_WIDTHS) {
  const maxWidth = Math.min(Math.max(Number(intrinsicWidth) * 2, 1), 2560);
  const widths = standardWidths.filter((width) => width <= maxWidth);

  if (widths[widths.length - 1] !== maxWidth) {
    widths.push(maxWidth);
  }

  return [...new Set(widths.map((width) => Math.round(width)))].sort((a, b) => a - b);
}

export function buildCloudinaryFetchUrl({
  src,
  width,
  cloudName,
  siteUrl = DEFAULT_SITE_URL,
  transformation = 'f_auto,q_auto',
}) {
  if (!cloudName || !Number.isFinite(width) || width <= 0) {
    return toAbsoluteUrl(src, siteUrl);
  }

  const sourceUrl = toAbsoluteUrl(src, siteUrl);
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformation},w_${Math.round(width)}/${sourceUrl}`;
}

export function buildCloudinarySrcSet({
  src,
  widths,
  cloudName,
  siteUrl = DEFAULT_SITE_URL,
  transformation = 'f_auto,q_auto',
}) {
  if (!cloudName || !src || !Array.isArray(widths) || widths.length === 0) return null;

  return widths
    .map((width) => `${buildCloudinaryFetchUrl({ src, width, cloudName, siteUrl, transformation })} ${Math.round(width)}w`)
    .join(', ');
}

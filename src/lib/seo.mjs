const MAX_DESCRIPTION_LENGTH = 160;
const SITE_ORIGIN = 'https://atrani.ru';

const LEGACY_PATH_REDIRECTS = new Map([
  ['/blog/2019/2/20/old-photos-of-amalfi', '/blog/2019-2-20-old-photos-of-amalfi'],
  ['/blog/2019/12/21/katastrofa', '/blog/katastrofa'],
  ['/blog/2018/6/29/pesce-allacqua-pazza', '/blog/pesce-allacqua-pazza'],
  ['/blog/2020/2/1/chiesa-maria-maddalena', '/blog/chiesa-maria-maddalena'],
  ['/blog/2020/2/9/47-carnevale-maiori-2020', '/blog/carnevale-maiori-2020'],
  ['/blog/2019/1/25/colatura-di-alici-di-cetara', '/blog/colatura-di-alici-di-cetara'],
  ['/blog/2020/3/2/final-carnivale-2020', '/blog/final-carnivale-2020'],
  ['/blog/2020/4/17/8-businessman-amalfi-interview', '/blog/8-businessman-amalfi-interview'],
  ['/blog/2020/4/28/la-caravella', '/blog/la-caravella'],
  ['/blog/2019/atrani', '/blog/2019-atrani'],
  ['/blog/apts', '/apartments'],
  ['/apts', '/apartments'],
  ['/reshka', '/orel-i-reshka-amalfi'],
  ['/blog/book', '/contacts'],
  ['/blog/shop', '/contacts'],
  ['/blog/eng', '/blog/eng-atrani'],
  ['/blog/2020/6/13/naples', '/blog/naples'],
  ['/blog/transport', '/transport'],
  ['/blog/directions', '/transport'],
  ['/blog/s/recepie-pasta-grangiano.pdf', '/blog/visit-pastificio-gentile-grangano'],
]);

function decodeBasicEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanText(value) {
  return decodeBasicEntities(String(value || ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateSnippet(value, maxLength = MAX_DESCRIPTION_LENGTH) {
  if (value.length <= maxLength) return value;

  const shortened = value.slice(0, maxLength - 1);
  const lastSpace = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, lastSpace > 100 ? lastSpace : shortened.length).trim()}…`;
}

/**
 * Build a stable, non-empty search description from Ghost's editorial fields.
 */
export function createMetaDescription(post) {
  const editorial = [
    post?.og_description,
    post?.meta_description,
    post?.custom_excerpt,
    post?.excerpt,
  ].find((value) => cleanText(value));

  if (editorial) return truncateSnippet(cleanText(editorial));

  const bodyWithoutHeadings = String(post?.html || '')
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');
  const body = cleanText(bodyWithoutHeadings);
  if (body) return truncateSnippet(body);

  return truncateSnippet(
    `${cleanText(post?.title) || 'Статья об Амальфитанском побережье'} — практические советы и истории от местных жителей на Atrani.ru.`,
  );
}

/**
 * The article template owns the only H1. Ghost body headings therefore start at H2.
 */
export function normalizeArticleHeadings(html) {
  if (!html) return html || '';
  return String(html).replace(/<(\/?)(h1)(\b[^>]*)>/gi, (_match, closing, sourceTag, attrs) => {
    const tag = sourceTag === 'H1' ? 'H2' : 'h2';
    return `<${closing ? '/' : ''}${tag}${attrs}>`;
  });
}

function canonicalLegacyHref(href) {
  let url;
  try {
    url = new URL(href, SITE_ORIGIN);
  } catch {
    return href;
  }

  if (!['atrani.ru', 'www.atrani.ru'].includes(url.hostname)) return href;

  const normalizedPath = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  let target = LEGACY_PATH_REDIRECTS.get(normalizedPath);
  if (/^\/blog\/order-photo\//i.test(normalizedPath)) target = '/photos';
  if (
    /^(?:\/s\/(?:FERRY|BUS)-|\/(?:blog\/)?files\/(?:FERRY|BUS)-|\/blog\/s\/(?:FERRY|BUS)-).*\.pdf$/i.test(normalizedPath)
  ) {
    target = '/transport';
  }

  if (target) return `${SITE_ORIGIN}${target}`;
  const hadLegacyRef = url.searchParams.get('ref') === 'atrani.ru';
  if (hadLegacyRef) url.searchParams.delete('ref');
  if (url.hostname === 'www.atrani.ru' || normalizedPath !== url.pathname || hadLegacyRef) {
    return `${SITE_ORIGIN}${normalizedPath}${url.search}${url.hash}`;
  }
  return href;
}

/**
 * Preserve legacy Ghost articles while steering old Squarespace-era links to live routes.
 */
export function normalizeLegacyLinks(html) {
  if (!html) return html || '';

  return String(html)
    .replace(/href=(["'])([^"']+)\1/gi, (_match, quote, href) => `href=${quote}${canonicalLegacyHref(href)}${quote}`)
    .replace(/href=([^\s"'=<>`]+)/gi, (_match, href) => `href=${canonicalLegacyHref(href)}`)
    .replace(
      /<a\b([^>]*?)href=(["'])https:\/\/atrani\.ru\/photos\2([^>]*)>\s*<\/a>/gi,
      '<a$1href="https://atrani.ru/photos" aria-label="Фотосессии на Амальфитанском побережье"$3></a>',
    );
}

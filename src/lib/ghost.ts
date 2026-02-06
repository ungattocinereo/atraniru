import GhostContentAPI from '@tryghost/content-api';

const GHOST_URL = import.meta.env.GHOST_URL;
const GHOST_PUBLIC_URL = import.meta.env.GHOST_PUBLIC_URL || GHOST_URL;
const CONTENT_API_KEY = import.meta.env.CONTENT_API_KEY;

if (!GHOST_URL || !CONTENT_API_KEY) {
    console.error(`[Ghost] Missing env vars: GHOST_URL=${GHOST_URL ? 'set' : 'MISSING'}, CONTENT_API_KEY=${CONTENT_API_KEY ? 'set' : 'MISSING'}`);
}

// Initialize Ghost Content API
export const ghostClient = new GhostContentAPI({
    url: GHOST_URL || '',
    key: CONTENT_API_KEY || '',
    version: 'v5.0',
});

/**
 * Rewrite Ghost internal URLs to public URLs.
 * On prod, Ghost listens on localhost but images must be served via public proxy.
 */
export function rewriteGhostUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (GHOST_URL === GHOST_PUBLIC_URL) return url;
    return url.replace(GHOST_URL, GHOST_PUBLIC_URL);
}

/**
 * Rewrite all Ghost URLs in HTML content (for post body).
 */
export function rewriteGhostHtml(html: string | null | undefined): string | null {
    if (!html) return null;
    if (GHOST_URL === GHOST_PUBLIC_URL) return html;
    return html.replaceAll(GHOST_URL, GHOST_PUBLIC_URL);
}

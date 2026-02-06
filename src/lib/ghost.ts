import GhostContentAPI from '@tryghost/content-api';

// Initialize Ghost Content API
export const ghostClient = new GhostContentAPI({
    url: import.meta.env.GHOST_URL || 'https://demo.ghost.io',
    key: import.meta.env.CONTENT_API_KEY || '22444f78447824223cefc48062',
    version: 'v5.0',
});

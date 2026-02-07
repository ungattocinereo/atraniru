// Ghost API functions
import { ghostClient } from './ghost';
import type { GhostPost, GhostTag } from './types/ghost';

interface GetPostsOptions {
  limit?: number | 'all';
  page?: number;
  filter?: string;
  include?: string;
}

/**
 * Get all posts with optional filtering and pagination.
 * When limit='all', manually paginates through all pages
 * (Ghost Content API caps at 100 per page).
 */
export async function getAllPosts(options: GetPostsOptions = {}): Promise<GhostPost[]> {
  const {
    limit = 15,
    page = 1,
    filter,
    include = 'tags,authors',
  } = options;

  // When limit='all', paginate through all pages manually
  if (limit === 'all') {
    const allPosts: GhostPost[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const posts = await ghostClient.posts.browse({
          limit: 100,
          page: currentPage,
          filter,
          include,
        });

        allPosts.push(...(posts as GhostPost[]));

        const meta = (posts as any).meta;
        const totalPages = meta?.pagination?.pages ?? 1;
        hasMore = currentPage < totalPages;
        currentPage++;
      } catch (error) {
        console.error(`Error fetching posts page ${currentPage} from Ghost:`, error);
        hasMore = false;
      }
    }

    return allPosts;
  }

  try {
    const posts = await ghostClient.posts.browse({
      limit,
      page,
      filter,
      include,
    });
    return posts as GhostPost[];
  } catch (error) {
    console.error('Error fetching posts from Ghost:', error);
    return [];
  }
}

/**
 * Get a single post by slug
 */
export async function getSinglePost(slug: string): Promise<GhostPost | null> {
  try {
    const post = await ghostClient.posts.read(
      { slug },
      { include: 'tags,authors' }
    );
    return post as GhostPost;
  } catch (error) {
    console.error(`Error fetching post "${slug}" from Ghost:`, error);
    return null;
  }
}

/**
 * Get featured posts
 */
export async function getFeaturedPosts(limit: number = 3): Promise<GhostPost[]> {
  try {
    const posts = await ghostClient.posts.browse({
      limit,
      filter: 'featured:true',
      include: 'tags,authors',
    });
    return posts as GhostPost[];
  } catch (error) {
    console.error('Error fetching featured posts from Ghost:', error);
    return [];
  }
}

/**
 * Get posts by tag slug
 */
export async function getPostsByTag(
  tagSlug: string,
  options: GetPostsOptions = {}
): Promise<GhostPost[]> {
  const { limit = 15, page = 1 } = options;

  try {
    const posts = await ghostClient.posts.browse({
      limit,
      page,
      filter: `tag:${tagSlug}`,
      include: 'tags,authors',
    });
    return posts as GhostPost[];
  } catch (error) {
    console.error(`Error fetching posts for tag "${tagSlug}" from Ghost:`, error);
    return [];
  }
}

/**
 * Get all tags
 */
export async function getAllTags(): Promise<GhostTag[]> {
  try {
    const tags = await ghostClient.tags.browse({
      limit: 'all',
    });
    return tags as GhostTag[];
  } catch (error) {
    console.error('Error fetching tags from Ghost:', error);
    return [];
  }
}

/**
 * Get a single tag by slug
 */
export async function getTagBySlug(slug: string): Promise<GhostTag | null> {
  try {
    const tag = await ghostClient.tags.read({ slug });
    return tag as GhostTag;
  } catch (error) {
    console.error(`Error fetching tag "${slug}" from Ghost:`, error);
    return null;
  }
}

/**
 * Calculate reading time from HTML content
 * Ghost provides reading_time, but this is a backup calculation
 */
export function calculateReadingTime(html: string): number {
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, '');
  // Count words (split by whitespace)
  const words = text.trim().split(/\s+/).length;
  // Average reading speed: 200 words per minute
  const minutes = Math.ceil(words / 200);
  return minutes;
}

/**
 * Format date to Russian locale
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get related posts based on tags (exclude current post)
 */
export async function getRelatedPosts(
  currentPostId: string,
  tagSlugs: string[],
  limit: number = 3
): Promise<GhostPost[]> {
  if (tagSlugs.length === 0) {
    // If no tags, just get latest posts
    const posts = await getAllPosts({ limit: limit + 1 });
    return posts.filter(post => post.id !== currentPostId).slice(0, limit);
  }

  try {
    // Get posts with any of the same tags
    const filter = tagSlugs.map(slug => `tag:${slug}`).join(',');
    const posts = await ghostClient.posts.browse({
      limit: limit + 1, // Get one extra in case current post is included
      filter,
      include: 'tags,authors',
    });

    // Filter out current post and limit results
    return (posts as GhostPost[])
      .filter(post => post.id !== currentPostId)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching related posts from Ghost:', error);
    return [];
  }
}

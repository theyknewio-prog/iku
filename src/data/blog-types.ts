// Shared BlogArticle type — extracted from blog.ts so both the hand-written
// BLOG_ARTICLES and the auto-generated BLOG_ARTICLES_HENTAICITY use the same
// shape without creating an import cycle.

export interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  publishedAt: string;
  readingTime: number;
  glossaryLinks: string[];
  seoTitle: string;
  seoDescription: string;
}

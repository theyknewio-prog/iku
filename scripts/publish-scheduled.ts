import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface QueueItem {
  type: 'blog' | 'glossary';
  publishDate: string;
  status: 'pending' | 'published';
  data: any;
}

const ROOT = join(__dirname, '..');
const QUEUE_PATH = join(ROOT, 'src', 'data', 'content-queue.json');
const BLOG_PATH = join(ROOT, 'src', 'data', 'blog.ts');
const GLOSSARY_PATH = join(ROOT, 'src', 'data', 'glossary.ts');

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function escapeForTemplate(str: string): string {
  // Escape backticks and ${} inside template literals
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function formatBlogEntry(data: any): string {
  const tags = JSON.stringify(data.tags);
  const glossaryLinks = JSON.stringify(data.glossaryLinks);
  return `  {
    slug: "${data.slug}",
    title: "${data.title.replace(/"/g, '\\"')}",
    excerpt: "${data.excerpt.replace(/"/g, '\\"')}",
    content: \`${escapeForTemplate(data.content)}\`,
    tags: ${tags},
    publishedAt: "${data.publishedAt}",
    readingTime: ${data.readingTime},
    glossaryLinks: ${glossaryLinks},
    seoTitle: "${data.seoTitle.replace(/"/g, '\\"')}",
    seoDescription: "${data.seoDescription.replace(/"/g, '\\"')}",
  }`;
}

function formatGlossaryEntry(data: any): string {
  return `  {
    slug: "${data.slug}",
    title: "${data.title.replace(/"/g, '\\"')}",
    category: "${data.category}",
    definition: "${data.definition.replace(/"/g, '\\"')}",
    relatedTags: ${JSON.stringify(data.relatedTags)},
    relatedTerms: ${JSON.stringify(data.relatedTerms)},
    relatedArticles: ${JSON.stringify(data.relatedArticles)},
    seoTitle: "${data.seoTitle.replace(/"/g, '\\"')}",
    seoDescription: "${data.seoDescription.replace(/"/g, '\\"')}",
  }`;
}

function appendToBlogFile(entries: any[]): void {
  let content = readFileSync(BLOG_PATH, 'utf-8');

  // Find the last closing of the array: the final ];
  const lastBracket = content.lastIndexOf('];');
  if (lastBracket === -1) {
    throw new Error('Could not find closing ]; in blog.ts');
  }

  const formatted = entries.map(e => formatBlogEntry(e)).join(',\n');

  // Insert before the final ];
  content = content.slice(0, lastBracket) + ',\n' + formatted + '\n' + content.slice(lastBracket);

  writeFileSync(BLOG_PATH, content, 'utf-8');
  console.log(`  ✓ Appended ${entries.length} blog article(s) to blog.ts`);
}

function appendToGlossaryFile(entries: any[]): void {
  let content = readFileSync(GLOSSARY_PATH, 'utf-8');

  const lastBracket = content.lastIndexOf('];');
  if (lastBracket === -1) {
    throw new Error('Could not find closing ]; in glossary.ts');
  }

  const formatted = entries.map(e => formatGlossaryEntry(e)).join(',\n');

  content = content.slice(0, lastBracket) + ',\n' + formatted + '\n' + content.slice(lastBracket);

  writeFileSync(GLOSSARY_PATH, content, 'utf-8');
  console.log(`  ✓ Appended ${entries.length} glossary term(s) to glossary.ts`);
}

async function main() {
  const todayStr = today();
  console.log(`[publish-scheduled] Running for date: ${todayStr}`);

  const queue: QueueItem[] = JSON.parse(readFileSync(QUEUE_PATH, 'utf-8'));

  const due = queue.filter(
    item => item.status === 'pending' && item.publishDate <= todayStr
  );

  if (due.length === 0) {
    console.log('No scheduled content due today.');
    return;
  }

  console.log(`Found ${due.length} item(s) due for publishing.`);

  // Collect all blog and glossary entries to batch-append
  const blogEntries: any[] = [];
  const glossaryEntries: any[] = [];

  for (const item of due) {
    if (item.type === 'blog') {
      blogEntries.push(item.data);
      console.log(`  → Blog: "${item.data.title}"`);
    } else if (item.type === 'glossary') {
      const terms = Array.isArray(item.data) ? item.data : [item.data];
      glossaryEntries.push(...terms);
      console.log(`  → Glossary: ${terms.map((t: any) => t.title).join(', ')}`);
    }

    // Mark as published in queue
    item.status = 'published';
  }

  // Append to files
  if (blogEntries.length > 0) {
    appendToBlogFile(blogEntries);
  }

  if (glossaryEntries.length > 0) {
    appendToGlossaryFile(glossaryEntries);
  }

  // Save updated queue
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf-8');
  console.log(`\n[publish-scheduled] Done. Published ${blogEntries.length} blog(s), ${glossaryEntries.length} glossary term(s).`);
}

main().catch(err => {
  console.error('Publish script failed:', err);
  process.exit(1);
});

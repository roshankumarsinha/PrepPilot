import { htmlToPlainText } from './html-to-markdown';
import type { ExtractedLink, LinkKind } from './types';

const HTML_ANCHOR = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const BARE_URL = /https?:\/\/[^\s<>"'`)\]]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?'"`]+$/;

/** Hosts that only appear in code samples, never as references worth keeping. */
const IGNORED_HOSTS =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|(.+\.)?example\.(com|org)|api\.example\.com)$/i;
const FILE_LIKE = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|json)$/i;

/**
 * Finds every external link in a chunk of raw source (HTML anchors, markdown links and bare
 * URLs), classifies it, and keeps one entry per URL, preferring one that has a label.
 */
export function extractLinks(raw: string): ExtractedLink[] {
  const found = new Map<string, ExtractedLink>();
  const add = (rawUrl: string, label: string | null) => {
    const url = normaliseUrl(rawUrl);
    if (!url) return;
    const existing = found.get(url);
    if (existing && (existing.label || !label)) return;
    const cleanLabel = label?.trim();
    found.set(url, {
      url,
      kind: classifyLink(url),
      label: cleanLabel === undefined || cleanLabel === '' ? null : cleanLabel,
    });
  };

  for (const [, url = '', label = ''] of raw.matchAll(HTML_ANCHOR))
    add(url, htmlToPlainText(label));
  for (const [, label = '', url = ''] of raw.matchAll(MARKDOWN_LINK)) add(url, label);
  for (const [url] of raw.matchAll(BARE_URL)) add(url, null);

  return [...found.values()];
}

export function classifyLink(url: string): LinkKind {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if ((host === 'chatgpt.com' || host === 'chat.openai.com') && pathname.startsWith('/share/')) {
    return 'chatgpt';
  }
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) {
    return 'youtube';
  }
  if (FILE_LIKE.test(pathname)) return 'other';
  return 'article';
}

function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(TRAILING_PUNCTUATION, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (IGNORED_HOSTS.test(url.hostname)) return null;
  return url.toString();
}

/** Text for the embedding model: links keep their label, bare URLs and images are dropped. */
export function stripUrls(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(BARE_URL, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

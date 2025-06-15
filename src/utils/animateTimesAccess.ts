import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

export type AnimeNewsItem = {
  title: string;
  link: string;
  time: Date;
};

export async function getLatestAnimeNews(): Promise<AnimeNewsItem[]> {
  const url = 'https://www.animatetimes.com/anime/?p=1';

  const items: AnimeNewsItem[] = [];

  // Set up HTTP client with headers similar to the C# version
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  const secChUa =
    '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"';

  const headers = {
    'User-Agent': userAgent,
    'sec-ch-ua': secChUa,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Priority: 'u=0, i',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  // Make HTTP request
  const response: AxiosResponse<string> = await axios.get(url, { headers });

  if (response.status !== 200) {
    throw new Error(
      `Failed to fetch data from ${url}. Status code: ${response.status}`
    );
  }

  const content = response.data;

  // Parse HTML content using cheerio
  const $ = cheerio.load(content);

  // Find the main content section
  const section = $('section.l-content-main');

  // Find news items within the first headline list only
  const newsItems = section
    .find('.c-headline-list')
    .first()
    .find('ul.c-headline-list li a');

  if (newsItems.length === 0) {
    return [];
  }

  // Extract title and link from each news item
  newsItems.each((index, element) => {
    const $element = $(element);

    // Find the title within the headline text div
    const title = $element.find('div.c-headline-text').text().trim();
    const link = $element.attr('href') || '';
    // time <div class="c-headline-date">2025-06-15 16:00</div>
    const time = new Date($element.find('div.c-headline-date').text().trim());

    if (title && link) {
      items.push({ title, link, time });
    }
  });

  return items;
}

export async function getNewsContent(
  url: string,
  page?: number
): Promise<string> {
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  const secChUa =
    '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"';

  const headers = {
    'User-Agent': userAgent,
    'sec-ch-ua': secChUa,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Priority: 'u=0, i',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  if (page != null) {
    const pageParam = `&p=${page}`;
    url = `${url}${pageParam}`;
  }
  // Make HTTP request
  const response: AxiosResponse<string> = await axios.get(url, { headers });
  // div : <div class="l-article responsive-iframe news-content">
  if (response.status !== 200) {
    throw new Error(
      `Failed to fetch data from ${url}. Status code: ${response.status}`
    );
  }
  const content = response.data;
  const $ = cheerio.load(content);
  // Find the article content
  const articleContent = $(
    'div.l-article.responsive-iframe.news-content'
  ).html();
  if (!articleContent) {
    throw new Error(`No article content found at ${url}`);
  }
  let dataToAppend = '';
  // if (page == null){
  //     const totalPage = $('div.c-pagination a.c-pagination__number').length;
  //     for (let i = 2; i <= totalPage; i++) {
  //         dataToAppend += await getNewsContent(url, i);
  //     }
  // }

  let result = convertHtmlToMarkdown(articleContent) + dataToAppend;
  if (result.length > 80000) {
    result = result.substring(0, 80000);
    result += `\n\n[Truncated, for full content, please visit: ${url}]`;
  }
  return result;
}

function convertHtmlToMarkdown(
  html: string,
  includeLinks: boolean = false
): string {
  try {
    // Clean and convert HTML to markdown
    const cleanedHtml = cleanHtmlForMarkdown(html, includeLinks);
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
    });

    const markdown = turndownService.turndown(cleanedHtml);

    // Post-process markdown to clean up any remaining issues and remove HTML remnants
    return cleanMarkdown(markdown, includeLinks);
  } catch (error) {
    console.error('Error converting HTML to markdown:', error);
    return html; // Return original HTML if conversion fails
  }
}

// Tags that markdown supports natively
const MARKDOWN_SUPPORTED_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'dl',
  'dt',
  'dd',
]);

/**
 * Cleans HTML by converting unsupported tags to plain text while preserving markdown-compatible tags
 */
function cleanHtmlForMarkdown(html: string, includeLinks: boolean): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove script and style elements entirely
  const scriptsAndStyles = document.querySelectorAll('script, style, noscript');
  scriptsAndStyles.forEach(node => node.remove());

  // Remove all links if includeLinks is false
  if (!includeLinks) {
    const linkNodes = document.querySelectorAll('a');
    linkNodes.forEach(linkNode => {
      const textContent = linkNode.textContent?.trim();
      if (textContent) {
        const textNode = document.createTextNode(textContent);
        linkNode.parentNode?.replaceChild(textNode, linkNode);
      } else {
        linkNode.remove();
      }
    });
  }

  // Process all nodes and convert unsupported tags to plain text
  processNodes(document.body || document.documentElement);

  // Clean attributes from all remaining tags for better markdown conversion
  cleanAttributes(document.body || document.documentElement, includeLinks);

  return (document.body || document.documentElement).innerHTML;
}

/**
 * Removes all attributes from HTML tags to ensure clean markdown conversion
 */
function cleanAttributes(node: Element, includeLinks: boolean): void {
  if (node.nodeType === node.ELEMENT_NODE) {
    const tagName = node.tagName.toLowerCase();
    const attributesToKeep: string[] = [];

    switch (tagName) {
      case 'a':
        if (includeLinks) {
          attributesToKeep.push('href');
        }
        break;
      case 'img':
        attributesToKeep.push('src', 'alt');
        break;
      // For all other tags, remove all attributes
    }

    // Remove unwanted attributes
    const attributesToRemove = Array.from(node.attributes).filter(
      attr => !attributesToKeep.includes(attr.name.toLowerCase())
    );

    attributesToRemove.forEach(attr => {
      node.removeAttribute(attr.name);
    });
  }

  // Recursively clean children
  Array.from(node.children).forEach(child => {
    cleanAttributes(child, includeLinks);
  });
}

/**
 * Recursively processes HTML nodes, converting unsupported tags to plain text
 */
function processNodes(node: Node): void {
  // First, recursively process all children to handle nested structures
  const children = Array.from(node.childNodes);
  children.forEach(child => {
    processNodes(child);
  });

  // Then process the current node if it's an element
  if (node.nodeType === node.ELEMENT_NODE) {
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Skip processing if it's a markdown-supported tag
    if (MARKDOWN_SUPPORTED_TAGS.has(tagName)) {
      return; // Keep the tag as-is
    }

    // For unsupported tags, we need to "unwrap" them while preserving their children
    unwrapUnsupportedTag(element, tagName);
  }
}

/**
 * Unwraps an unsupported tag while preserving its children and their structure
 */
function unwrapUnsupportedTag(node: Element, tagName: string): void {
  const parent = node.parentNode;
  if (!parent) return;

  // Determine if this is a block-level or inline element
  const isBlockLevel = isBlockLevelTag(tagName);

  // Get all child nodes
  const children = Array.from(node.childNodes);

  if (children.length === 0) {
    // Empty unsupported tag, just remove it
    node.remove();
    return;
  }

  // For block-level elements, we may want to add spacing
  if (isBlockLevel && hasSignificantContent(node)) {
    // Add a line break before if needed
    const prevSibling = node.previousElementSibling;
    if (prevSibling && isBlockLevelTag(prevSibling.tagName)) {
      const breakBefore = node.ownerDocument.createElement('br');
      parent.insertBefore(breakBefore, node);
    }
  }

  // Move all children to replace the parent node
  children.forEach(child => {
    parent.insertBefore(child, node);
  });

  // For block-level elements, add spacing after if needed
  if (isBlockLevel && hasSignificantContent(node)) {
    const nextSibling = node.nextElementSibling;
    if (nextSibling && isBlockLevelTag(nextSibling.tagName)) {
      const breakAfter = node.ownerDocument.createElement('br');
      parent.insertBefore(breakAfter, node);
    }
  }

  // Remove the original unsupported tag
  node.remove();
}

/**
 * Determines if a tag is typically a block-level element
 */
function isBlockLevelTag(tagName: string): boolean {
  const blockTags = new Set([
    'div',
    'section',
    'article',
    'header',
    'footer',
    'main',
    'aside',
    'nav',
    'form',
    'fieldset',
    'legend',
    'details',
    'summary',
    'figure',
    'figcaption',
    'address',
    'hgroup',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'blockquote',
    'pre',
    'hr',
    'br',
  ]);

  return blockTags.has(tagName.toLowerCase());
}

/**
 * Checks if a node has significant text content (not just whitespace)
 */
function hasSignificantContent(node: Element): boolean {
  const textContent = node.textContent || '';
  return textContent.trim().length > 0;
}

/**
 * Post-processes markdown to clean up formatting issues and remove HTML remnants
 */
function cleanMarkdown(markdown: string, includeLinks: boolean): string {
  if (!markdown || markdown.trim().length === 0) {
    return '';
  }

  // Remove any remaining HTML tags that weren't converted
  markdown = markdown.replace(/<[^>]+>/g, '');

  // Remove HTML comments
  markdown = markdown.replace(/<!--.*?-->/gs, '');

  // Remove markdown links if includeLinks is false
  if (!includeLinks) {
    // Remove markdown links: [text](url) -> text
    markdown = markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // Remove reference links: [text][ref] -> text
    markdown = markdown.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
    // Remove reference definitions: [ref]: url "title"
    markdown = markdown.replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '');
    // Remove empty links that might be left: [] -> (empty)
    markdown = markdown.replace(/\[\s*\]/g, '');
  }

  // Clean up excessive whitespace and newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.replace(/[ \t]+/g, ' ');

  // Clean up list formatting - remove extra spacing around lists
  markdown = markdown.replace(/\n\n+(\s*[-*+]\s)/g, '\n$1');
  markdown = markdown.replace(/\n\n+(\s*\d+\.\s)/g, '\n$1');

  // Clean up table formatting
  markdown = markdown.replace(/\n\n+(\s*\|)/g, '\n$1');

  // Remove empty markdown elements
  markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Clean up brackets and asterisks that might be left over from icons or formatting
  markdown = markdown.replace(/\[\s*\*\s*\]/g, '');
  markdown = markdown.replace(/\*\s*\]/g, ']');

  // Remove Font Awesome comments and similar
  markdown = markdown.replace(/<!--!Font Awesome.*?-->/gs, '');

  // Clean up multiple spaces
  markdown = markdown.replace(/  +/g, ' ');

  // Trim and ensure proper ending
  return markdown.trim();
}

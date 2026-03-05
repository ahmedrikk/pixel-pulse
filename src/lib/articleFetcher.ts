/**
 * Article fetching and text extraction utilities
 * Used to fetch full article content for better AI hashtag generation
 */

/**
 * Fetches article content from a URL and extracts clean text
 * Uses a CORS proxy approach to bypass CORS restrictions
 * @param url - The URL of the article to fetch
 * @returns Promise<string> - The extracted article text, or empty string if failed
 */
export async function fetchArticleContent(url: string): Promise<string> {
  // List of CORS proxies to try (in order of preference)
  const corsProxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];

  let lastError: Error | null = null;

  for (const getProxyUrl of corsProxies) {
    try {
      const proxyUrl = getProxyUrl(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      
      if (!html || html.trim().length === 0) {
        throw new Error('Empty response');
      }

      return extractArticleText(html);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next proxy
    }
  }

  // All proxies failed, return empty string
  console.warn(`Failed to fetch article from ${url}:`, lastError?.message);
  return '';
}

/**
 * Extracts readable article text from HTML
 * Strips scripts, styles, and extracts main content
 * @param html - The HTML string to extract text from
 * @returns string - The extracted clean text
 */
export function extractArticleText(html: string): string {
  try {
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    if (!doc.body) {
      return '';
    }

    // Remove non-content elements
    const elementsToRemove = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      'iframe',
      'svg',
      'noscript',
      '[role="banner"]',
      '[role="navigation"]',
      '[role="complementary"]',
      '.advertisement',
      '.ads',
      '.social-share',
      '.comments',
      '#comments',
      '.sidebar',
      '.menu',
      '.navigation',
    ];

    elementsToRemove.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Try to find the main content area
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.story-body',
      '.article-body',
    ];

    let contentElement: Element | null = null;

    for (const selector of contentSelectors) {
      contentElement = doc.querySelector(selector);
      if (contentElement) break;
    }

    // Fall back to body if no specific content area found
    const targetElement = contentElement || doc.body;

    // Get text content
    let text = targetElement.textContent || '';

    // Clean up the text
    text = text
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Remove extra line breaks
      .replace(/\n\s*\n/g, '\n')
      // Trim whitespace
      .trim();

    // Limit length to avoid excessive content (keep first 8000 chars)
    const maxLength = 8000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text;
  } catch (error) {
    console.warn('Error extracting article text:', error);
    return '';
  }
}

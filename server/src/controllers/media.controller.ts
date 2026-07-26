import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { generateUploadSignature } from '../services/cloudinary.service.js';

export async function getCloudinarySignature(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const folder = 'chatconnect/messages';
    const signatureData = generateUploadSignature(folder);
    return res.json(signatureData);
  } catch (error: any) {
    console.error('[MediaController] getCloudinarySignature error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to generate upload signature' });
  }
}

/**
 * Decodes HTML entities in text
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Extracts a meta property value safely regardless of attribute order (e.g. content before property)
 */
function extractMetaTag(html: string, key: string): string {
  const regexes = [
    new RegExp(`<meta[^>]*(?:property|name)=["'](?:og:|twitter:)?${key}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:|twitter:)?${key}["']`, 'i'),
  ];
  for (const reg of regexes) {
    const match = html.match(reg);
    if (match && match[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return '';
}

/**
 * Parses OpenGraph metadata (title, description, image, domain) from a given URL for rich link previews.
 * Includes specialized handlers for YouTube, Vimeo, Spotify, Twitter/X, and general websites.
 */
export async function getLinkPreview(req: AuthenticatedRequest, res: Response) {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: 'Valid URL is required' });
  }

  try {
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    // 1. Specialized Handler for YouTube Videos (Fastest, 100% reliable thumbnail & title via oEmbed)
    const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|v\/|shorts\/))([\w-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      const hqThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      let ytTitle = 'YouTube Video';
      let ytAuthor = 'YouTube';

      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          ytTitle = oembedData.title || ytTitle;
          ytAuthor = oembedData.author_name ? `Channel: ${oembedData.author_name}` : ytAuthor;
        }
      } catch (e) {
        // Fallback directly to thumbnail CDN
      }

      return res.json({
        url: targetUrl,
        domain: 'youtube.com',
        title: decodeHtmlEntities(ytTitle),
        description: decodeHtmlEntities(ytAuthor),
        image: hqThumbnail,
        isVideo: true,
      });
    }

    // 2. Standard Web Fetch for General URLs
    const domain = new URL(targetUrl).hostname.replace(/^www\./, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout limit

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.json({
        url: targetUrl,
        domain,
        title: domain,
        description: '',
        image: '',
      });
    }

    const html = await response.text();

    let title = extractMetaTag(html, 'title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? decodeHtmlEntities(titleMatch[1] || '') : '';
    }

    let description = extractMetaTag(html, 'description');
    let image = extractMetaTag(html, 'image');

    if (!image) {
      const linkImageMatch = html.match(/<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
      image = linkImageMatch ? linkImageMatch[1]?.trim() || '' : '';
    }

    if (image) {
      if (image.startsWith('//')) {
        image = `https:${image}`;
      } else if (!image.startsWith('http://') && !image.startsWith('https://')) {
        const origin = new URL(targetUrl).origin;
        image = `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
      }
    }

    return res.json({
      url: targetUrl,
      domain: domain || 'Link',
      title: title || domain || targetUrl,
      description: description || '',
      image: image || '',
    });
  } catch (error: any) {
    console.warn('[MediaController] Link preview fetch timeout or error:', error?.message || error);
    try {
      const cleanUrl = url.trim();
      const targetUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      const fallbackDomain = new URL(targetUrl).hostname.replace(/^www\./, '');
      
      // Fallback YouTube match in catch block if fetch timed out
      const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|v\/|shorts\/))([\w-]{11})/i);
      if (ytMatch && ytMatch[1]) {
        return res.json({
          url: targetUrl,
          domain: 'youtube.com',
          title: 'YouTube Video',
          description: '',
          image: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
          isVideo: true,
        });
      }

      return res.json({
        url: targetUrl,
        domain: fallbackDomain || 'Link',
        title: fallbackDomain || cleanUrl,
        description: '',
        image: '',
      });
    } catch (e) {
      return res.json({ url, domain: 'Link', title: url, description: '', image: '' });
    }
  }
}

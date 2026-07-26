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
      return match[1].trim();
    }
  }
  return '';
}

/**
 * Parses OpenGraph metadata (title, description, image, domain) from a given URL for rich link previews.
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

    const domain = new URL(targetUrl).hostname.replace(/^www\./, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout limit

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
      title = titleMatch ? titleMatch[1]?.trim() || '' : '';
    }

    let description = extractMetaTag(html, 'description');
    let image = extractMetaTag(html, 'image');

    if (image && !image.startsWith('http')) {
      const origin = new URL(targetUrl).origin;
      image = `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
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

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
 * Parses OpenGraph metadata (title, description, image, domain) from a given URL for rich link previews.
 */
export async function getLinkPreview(req: AuthenticatedRequest, res: Response) {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: 'Valid URL is required' });
  }

  try {
    const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const domain = new URL(targetUrl).hostname.replace(/^www\./, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout limit

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

    const title = titleMatch ? titleMatch[1]?.trim() : domain;
    const description = descMatch ? descMatch[1]?.trim() : '';
    let image = imgMatch ? imgMatch[1]?.trim() : '';

    if (image && !image.startsWith('http')) {
      const origin = new URL(targetUrl).origin;
      image = `${origin}${image.startsWith('/') ? '' : '/'}${image}`;
    }

    return res.json({
      url: targetUrl,
      domain,
      title: title || domain,
      description: description || '',
      image: image || '',
    });
  } catch (error: any) {
    console.warn('[MediaController] Link preview fetch timeout or error:', error?.message || error);
    try {
      const fallbackDomain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
      return res.json({
        url,
        domain: fallbackDomain,
        title: fallbackDomain,
        description: '',
        image: '',
      });
    } catch (e) {
      return res.json({ url, domain: '', title: url, description: '', image: '' });
    }
  }
}

import dns from 'dns';
import { promisify } from 'util';

const lookupAsync = promisify(dns.lookup);

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;

  // Normal IPv4 checks
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('169.254.') ||
    ip === '0.0.0.0' ||
    ip.startsWith('192.168.')
  ) {
    return true;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    // 172.16.0.0 – 172.31.255.255
    if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) {
      return true;
    }
  }

  // IPv6 loopback / link-local / private checks
  const lowerIp = ip.toLowerCase();
  if (
    lowerIp === '::1' ||
    lowerIp === '::' ||
    lowerIp.startsWith('fe80:') ||
    lowerIp.startsWith('fc00:') ||
    lowerIp.startsWith('fd00:')
  ) {
    return true;
  }

  return false;
}

export async function validateSafeUrl(urlStr: string): Promise<{ safe: boolean; reason?: string; parsedUrl?: URL }> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return { safe: false, reason: 'Access to internal hostnames is prohibited' };
    }

    // Direct IP address check
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: 'Direct requests to private IP addresses are prohibited' };
    }

    // Resolve DNS IP to prevent DNS rebinding / internal IP SSRF
    try {
      const resolved = await lookupAsync(hostname);
      if (isPrivateIp(resolved.address)) {
        return { safe: false, reason: 'Target URL resolves to a private or internal IP address' };
      }
    } catch {
      return { safe: false, reason: 'Could not resolve hostname' };
    }

    return { safe: true, parsedUrl: parsed };
  } catch (e: any) {
    return { safe: false, reason: 'Invalid URL string' };
  }
}

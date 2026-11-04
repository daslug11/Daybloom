import { describe, expect, it } from 'vitest';
import { allowedUrl, isPrivateAddress, parsePreview } from '../server/spaces/linkPreview';

describe('link preview safety', () => {
  it('flags private and special addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1']) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946', '8.8.8.8']) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it('only allows public http(s) URLs on default ports', () => {
    expect(allowedUrl('https://example.com/x')?.hostname).toBe('example.com');
    expect(allowedUrl('example.com')?.protocol).toBe('https:');
    for (const bad of ['http://localhost/', 'http://127.0.0.1/', 'https://example.com:8443/', 'ftp://example.com', 'http://user:pw@example.com/', 'http://printer.local/', 'javascript:alert(1)']) expect(allowedUrl(bad), bad).toBeNull();
  });
});

describe('parsePreview', () => {
  it('reads Open Graph tags, prices and JSON-LD', () => {
    const html = `<html><head><title>Fallback</title>
      <meta property="og:title" content="AirPods Pro &amp; case">
      <meta property="og:image" content="/img/airpods.jpg">
      <meta property="product:price:amount" content="249.00"><meta property="product:price:currency" content="usd">
      <meta property="og:site_name" content="Apple"></head>`;
    expect(parsePreview(html, 'https://www.apple.com/airpods')).toEqual({ title: 'AirPods Pro & case', image: 'https://www.apple.com/img/airpods.jpg', price: 249, currency: 'USD', site: 'Apple' });
    const ld = `<title>Socks</title><script type="application/ld+json">{"offers":{"price":"12.50","priceCurrency":"EUR"}}</script>`;
    expect(parsePreview(ld, 'https://shop.example/socks')).toMatchObject({ title: 'Socks', price: 12.5, currency: 'EUR', site: 'shop.example' });
  });
});

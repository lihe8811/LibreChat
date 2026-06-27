import { applyBrandFavicon, getBrandAssetPath } from '../branding';

describe('branding assets', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16x16.png" />
      <link rel="apple-touch-icon" href="assets/apple-touch-icon-180x180.png" />
    `;
  });

  it('resolves asset paths from configured branding prefix', () => {
    expect(getBrandAssetPath('logo.svg', { assetPrefix: 'assets/skyline' })).toBe(
      'assets/skyline/logo.svg',
    );
  });

  it('updates favicon links to the configured brand variant', () => {
    applyBrandFavicon({ logoVariant: 'skyline', assetPrefix: 'assets/skyline' });

    expect(document.head.querySelector('link[rel="icon"][sizes="32x32"]')).toHaveAttribute(
      'href',
      'assets/skyline/favicon-32x32.png',
    );
    expect(document.head.querySelector('link[rel="icon"][sizes="16x16"]')).toHaveAttribute(
      'href',
      'assets/skyline/favicon-16x16.png',
    );
    expect(document.head.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      'assets/skyline/apple-touch-icon-180x180.png',
    );
  });
});

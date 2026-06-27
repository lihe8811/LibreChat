import type { TStartupConfig } from 'librechat-data-provider';

const DEFAULT_VARIANT = 'default';
const DEFAULT_ASSET_PREFIX = 'assets';

type BrandingConfig = TStartupConfig['branding'];

export function getBrandAssetPrefix(branding?: BrandingConfig): string {
  if (!branding) {
    return DEFAULT_ASSET_PREFIX;
  }

  const trimmedPrefix = branding.assetPrefix?.trim();
  if (trimmedPrefix) {
    if (trimmedPrefix === DEFAULT_VARIANT) {
      return DEFAULT_ASSET_PREFIX;
    }

    if (trimmedPrefix.startsWith(`${DEFAULT_ASSET_PREFIX}/`)) {
      return trimmedPrefix;
    }

    if (trimmedPrefix.startsWith(DEFAULT_ASSET_PREFIX)) {
      return trimmedPrefix;
    }

    return `${DEFAULT_ASSET_PREFIX}/${trimmedPrefix}`;
  }

  const variant = branding.logoVariant?.trim();

  if (!variant || variant === DEFAULT_VARIANT) {
    return DEFAULT_ASSET_PREFIX;
  }

  return `${DEFAULT_ASSET_PREFIX}/${variant}`;
}

export function getBrandAssetPath(assetName: string, branding?: BrandingConfig): string {
  const prefix = getBrandAssetPrefix(branding);
  return `${prefix}/${assetName}`;
}

type IconLinkConfig = {
  rel: string;
  assetName: string;
  selector: string;
  attributes: Record<string, string>;
};

const ICON_LINKS: IconLinkConfig[] = [
  {
    rel: 'icon',
    assetName: 'favicon-32x32.png',
    selector: 'link[rel="icon"][sizes="32x32"]',
    attributes: { type: 'image/png', sizes: '32x32' },
  },
  {
    rel: 'icon',
    assetName: 'favicon-16x16.png',
    selector: 'link[rel="icon"][sizes="16x16"]',
    attributes: { type: 'image/png', sizes: '16x16' },
  },
  {
    rel: 'apple-touch-icon',
    assetName: 'apple-touch-icon-180x180.png',
    selector: 'link[rel="apple-touch-icon"]',
    attributes: {},
  },
];

export function applyBrandFavicon(branding?: BrandingConfig): void {
  if (typeof document === 'undefined') {
    return;
  }

  ICON_LINKS.forEach(({ rel, assetName, selector, attributes }) => {
    const link =
      document.head.querySelector<HTMLLinkElement>(selector) ?? document.createElement('link');

    link.rel = rel;
    Object.entries(attributes).forEach(([name, value]) => {
      link.setAttribute(name, value);
    });
    link.href = getBrandAssetPath(assetName, branding);

    if (!link.parentElement) {
      document.head.appendChild(link);
    }
  });
}

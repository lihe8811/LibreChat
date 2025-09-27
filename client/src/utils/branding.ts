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

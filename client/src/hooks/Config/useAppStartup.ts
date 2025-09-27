import { useEffect, useRef } from 'react';
import TagManager from 'react-gtm-module';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { LocalStorageKeys } from 'librechat-data-provider';
import { useAvailablePluginsQuery } from 'librechat-data-provider/react-query';
import type { TStartupConfig, TPlugin, TUser } from 'librechat-data-provider';
import { mapPlugins, selectPlugins, processPlugins } from '~/utils';
import { getBrandAssetPath, getBrandAssetPrefix } from '~/utils/branding';
import { cleanupTimestampedStorage } from '~/utils/timestamps';
import useSpeechSettingsInit from './useSpeechSettingsInit';
import { useMCPToolsQuery } from '~/data-provider';
import store from '~/store';

const pluginStore: TPlugin = {
  name: 'Plugin store',
  pluginKey: 'pluginStore',
  isButton: true,
  description: '',
  icon: '',
  authConfig: [],
  authenticated: false,
};

export default function useAppStartup({
  startupConfig,
  user,
}: {
  startupConfig?: TStartupConfig;
  user?: TUser;
}) {
  const setAvailableTools = useSetRecoilState(store.availableTools);
  const [defaultPreset, setDefaultPreset] = useRecoilState(store.defaultPreset);
  const { data: allPlugins } = useAvailablePluginsQuery({
    enabled: !!user?.plugins,
    select: selectPlugins,
  });

  const manifestObjectUrlRef = useRef<string | null>(null);
  const manifestBaseHrefRef = useRef<string | null>(null);

  useSpeechSettingsInit(!!user);

  useMCPToolsQuery({
    enabled: !!startupConfig?.mcpServers && !!user,
  });

  /** Clean up old localStorage entries on startup */
  useEffect(() => {
    cleanupTimestampedStorage();
  }, []);

  /** Set the app title */
  useEffect(() => {
    const appTitle = startupConfig?.appTitle ?? '';
    if (!appTitle) {
      return;
    }
    document.title = appTitle;
    localStorage.setItem(LocalStorageKeys.APP_TITLE, appTitle);
  }, [startupConfig]);

  /** Set the default spec's preset as default */
  useEffect(() => {
    if (defaultPreset && defaultPreset.spec != null) {
      return;
    }

    const modelSpecs = startupConfig?.modelSpecs?.list;

    if (!modelSpecs || !modelSpecs.length) {
      return;
    }

    const defaultSpec = modelSpecs.find((spec) => spec.default);

    if (!defaultSpec) {
      return;
    }

    setDefaultPreset({
      ...defaultSpec.preset,
      iconURL: defaultSpec.iconURL,
      spec: defaultSpec.name,
    });
  }, [defaultPreset, setDefaultPreset, startupConfig?.modelSpecs?.list]);

  /** Set the available Plugins */
  useEffect(() => {
    if (!user) {
      return;
    }

    if (!allPlugins) {
      return;
    }

    const userPlugins = user.plugins ?? [];

    if (userPlugins.length === 0) {
      setAvailableTools({ pluginStore });
      return;
    }

    const tools = [...userPlugins]
      .map((el) => allPlugins.map[el])
      .filter((el: TPlugin | undefined): el is TPlugin => el !== undefined);

    /* Filter Last Selected Tools */
    const localStorageItem = localStorage.getItem(LocalStorageKeys.LAST_TOOLS) ?? '';
    if (!localStorageItem) {
      return setAvailableTools({ pluginStore, ...mapPlugins(tools) });
    }
    const lastSelectedTools = processPlugins(JSON.parse(localStorageItem) ?? [], allPlugins.map);
    const filteredTools = lastSelectedTools
      .filter((tool: TPlugin) =>
        tools.some((existingTool) => existingTool.pluginKey === tool.pluginKey),
      )
      .filter((tool: TPlugin | undefined) => !!tool);
    localStorage.setItem(LocalStorageKeys.LAST_TOOLS, JSON.stringify(filteredTools));

    setAvailableTools({ pluginStore, ...mapPlugins(tools) });
  }, [allPlugins, user, setAvailableTools]);

  useEffect(() => {
    if (startupConfig?.analyticsGtmId != null && typeof window.google_tag_manager === 'undefined') {
      const tagManagerArgs = {
        gtmId: startupConfig.analyticsGtmId,
      };
      TagManager.initialize(tagManagerArgs);
    }
  }, [startupConfig?.analyticsGtmId]);

  useEffect(() => {
    if (!startupConfig) {
      return;
    }

    const branding = startupConfig.branding;
    const assetPrefix = getBrandAssetPrefix(branding);

    const iconDescriptors: Array<{ selector: string; asset: string }> = [
      { selector: 'link[rel="icon"][sizes="32x32"]', asset: 'favicon-32x32.png' },
      { selector: 'link[rel="icon"][sizes="16x16"]', asset: 'favicon-16x16.png' },
      { selector: 'link[rel="apple-touch-icon"]', asset: 'apple-touch-icon-180x180.png' },
    ];

    iconDescriptors.forEach(({ selector, asset }) => {
      const element = document.head.querySelector<HTMLLinkElement>(selector);
      if (!element) {
        return;
      }
      element.setAttribute('href', `${assetPrefix}/${asset}`);
    });

    const manifestLink = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      return;
    }

    if (!manifestBaseHrefRef.current) {
      const baseHref = manifestLink.getAttribute('data-base-href') ?? manifestLink.href;
      manifestBaseHrefRef.current = baseHref;
      manifestLink.setAttribute('data-base-href', baseHref);
    }

    const manifestHref = manifestBaseHrefRef.current ?? manifestLink.href;
    manifestLink.setAttribute('href', manifestHref);

    const manifestIcons = [
      {
        src: getBrandAssetPath('favicon-32x32.png', branding),
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: getBrandAssetPath('favicon-16x16.png', branding),
        sizes: '16x16',
        type: 'image/png',
      },
      {
        src: getBrandAssetPath('apple-touch-icon-180x180.png', branding),
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: getBrandAssetPath('icon-192x192.png', branding),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: getBrandAssetPath('maskable-icon.png', branding),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ];

    const controller = new AbortController();

    fetch(manifestHref, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest) => {
        if (!manifest) {
          return;
        }

        const updatedManifest = {
          ...manifest,
          icons: manifestIcons,
        };

        const blob = new Blob([JSON.stringify(updatedManifest)], {
          type: 'application/manifest+json',
        });

        if (manifestObjectUrlRef.current) {
          URL.revokeObjectURL(manifestObjectUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(blob);
        manifestObjectUrlRef.current = objectUrl;
        manifestLink.setAttribute('href', objectUrl);
      })
      .catch(() => {
        /* no-op: manifest fetch failures should not impact startup */
      });

    return () => {
      controller.abort();
      if (manifestObjectUrlRef.current) {
        URL.revokeObjectURL(manifestObjectUrlRef.current);
        manifestObjectUrlRef.current = null;
      }
      manifestLink.setAttribute('href', manifestHref);
    };
  }, [startupConfig]);
}

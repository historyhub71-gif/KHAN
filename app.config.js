/**
 * Production + preview: Android deep links, env-based scheme.
 * @see https://docs.expo.dev/guides/deep-linking/
 */

const DEEP_LINK_SCHEME =
  process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME?.trim() || 'myapp';

const ANDROID_PACKAGE =
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() ||
  'com.hashirkhan.attendance';

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,

  scheme: DEEP_LINK_SCHEME,

  android: {
    ...config.android,

    package: ANDROID_PACKAGE,

    intentFilters: [
      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            scheme: DEEP_LINK_SCHEME,
            host: 'reset-password',
          },
        ],
      },

      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            scheme: DEEP_LINK_SCHEME,
            host: 'reset-password',
            pathPrefix: '/',
          },
        ],
      },

      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          {
            scheme: DEEP_LINK_SCHEME,
          },
        ],
      },
    ],
  },

  extra: {
    ...config.extra,

    deepLinkScheme: DEEP_LINK_SCHEME,

    passwordResetRedirect: `${DEEP_LINK_SCHEME}://reset-password`,
  },
});
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.astrosky.app',
  appName: 'AstroSky',
  webDir: 'dist',
  backgroundColor: '#000000',
  ios: {
    backgroundColor: '#000000',
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;

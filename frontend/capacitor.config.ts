import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cryptovault.app',
  appName: 'SpaceOne',
  webDir: 'build',
  server: {
    // 'http' permite o teste local via IP da LAN (cleartext). Em produção com
    // backend HTTPS, troque para 'https' (padrão) e remova o cleartext do manifest.
    androidScheme: 'http',
  },
};

export default config;

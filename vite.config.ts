import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// رقم الإصدار الحقيقي من package.json (نفس مصدر نسخة البناء في CI).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig(({ mode }) => {
  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    // Vercel serves from the domain root; Capacitor loads the bundle from its local WebView.
    base: mode === 'android' ? './' : '/',
    plugins: [react(), tailwindcss()],  // Tailwind v4 design plugin + React
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['localforage'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
            if (id.includes('/motion/') || id.includes('/framer-motion/')) return 'motion-vendor';
            if (id.includes('/lucide-react/')) return 'icons-vendor';
            if (id.includes('/adhan/')) return 'adhan-vendor';
            if (id.includes('/@capacitor/') || id.includes('/@aparajita/')) return 'capacitor-vendor';
            return 'vendor';
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

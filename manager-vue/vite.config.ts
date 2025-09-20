import { fileURLToPath, URL } from 'node:url'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 自定义插件：复制图标文件到构建目录
const copyIconsPlugin = () => {
  return {
    name: 'copy-icons',
    writeBundle() {
      const iconsDir = resolve(__dirname, 'src/assets/icons')
      const distIconsDir = resolve(__dirname, '../manager-worker/dist/icons')

      // 创建目标目录
      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true })
      }

      // 复制所有图标文件
      const iconFiles = [
        'codebuddy.svg',
        'cursor.svg',
        'kiro.svg',
        'qoder.svg',
        'trae.svg',
        'vscode.svg',
        'vscodium.svg'
      ]

      iconFiles.forEach(file => {
        const src = resolve(iconsDir, file)
        const dest = resolve(distIconsDir, file)
        if (existsSync(src)) {
          copyFileSync(src, dest)
          console.log(`Copied ${file} to manager-worker/dist/icons/`)
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      vue(),
      vueDevTools(),
      copyIconsPlugin(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    build: {
      outDir: '../manager-worker/dist',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0', // 允许外部IP访问
      port: 5173,      // 指定端口
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        }
      }
    }
  }
})

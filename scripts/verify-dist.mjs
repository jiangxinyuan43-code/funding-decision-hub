import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('dist')
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'app-icon.svg',
  'sw.js',
  'assets/app.js',
  'assets/app.css',
  'assets/index-sqrXEzad.js',
  'assets/index-L71X6Ni2.js',
  'assets/index-D52gpzNu.css',
  'assets/index-I1hnMvon.css',
]

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) throw new Error(`构建缺少文件：${file}`)
}

const hash = (file) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')
for (const alias of ['assets/index-sqrXEzad.js', 'assets/index-L71X6Ni2.js']) {
  if (hash(alias) !== hash('assets/app.js')) throw new Error(`旧版脚本别名与最新文件不一致：${alias}`)
}
for (const alias of ['assets/index-D52gpzNu.css', 'assets/index-I1hnMvon.css']) {
  if (hash(alias) !== hash('assets/app.css')) throw new Error(`旧版样式别名与最新文件不一致：${alias}`)
}

const html = readFileSync(resolve(root, 'index.html'), 'utf8')
if (!html.includes('/funding-decision-hub/assets/app.js') || !html.includes('/funding-decision-hub/assets/app.css')) {
  throw new Error('GitHub Pages 入口没有引用稳定资源路径')
}

const serviceWorker = readFileSync(resolve(root, 'sw.js'), 'utf8')
if (!serviceWorker.includes('funding-decision-hub-') || !serviceWorker.includes('registration.unregister()') || serviceWorker.includes("addEventListener('fetch'")) {
  throw new Error('Service Worker 没有正确退役或仍在拦截页面请求')
}

console.log(`Dist verification passed: ${requiredFiles.length} required files and 4 legacy aliases`)

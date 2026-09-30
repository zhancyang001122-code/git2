import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

let views
const fixture = '.qa/asset-list-test-' + process.pid + '.mjs'
before(async () => {
  const bundle = await build({
    configFile: false, logLevel: 'silent', plugins: [react()],
    build: {
      ssr: 'src/App.jsx', write: false,
      rollupOptions: { external: (id) => !id.startsWith('.') && !isAbsolute(id) },
    },
  })
  await mkdir('.qa', { recursive: true })
  await writeFile(fixture, bundle.output.find((item) => item.type === 'chunk').code)
  views = await import(pathToFileURL(isAbsolute(fixture) ? fixture : process.cwd() + '/' + fixture).href)
})
after(async () => { await unlink(fixture).catch(() => {}) })

function asset(id, artifacts) {
  return { id, title: 'Asset ' + id, type: 'Image', source: 'Render', files: 1, tone: 'blue', persistent: true, artifacts }
}

test('rendered legacy card has an explicit original entry and embeds no original URL', () => {
  const html = renderToStaticMarkup(createElement(views.AssetPreviewVisual, {
    asset: asset(1, [{ storagePath: 'private/original.png', imageUrl: 'https://signed.invalid/original.png' }]),
  }))
  assert.match(html, /点击查看原图/)
  assert.doesNotMatch(html, /<img|signed.invalid|private\/original/)
})

test('list renders only the first 12 cards and keeps offscreen originals unmounted', () => {
  const assets = Array.from({ length: 27 }, (_, id) => asset(id, [{
    storagePath: 'private/' + id + '.png', thumbnailPath: 'private/' + id + '.thumb.webp',
    imageUrl: 'https://signed.invalid/' + id + '.png',
  }]))
  const html = renderToStaticMarkup(createElement(views.AssetsView, {
    assets, onDialog() {}, onNavigate() {},
  }))
  assert.equal((html.match(/class="asset-card"/g) || []).length, 12)
  assert.match(html, /资产分页/)
  assert.doesNotMatch(html, /<img|signed.invalid/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

test('slider and large preview report image load failures instead of silently showing an empty background', () => {
  assert.match(app, /function GeneratedPreviewImage/)
  assert.match(app, /onError=\{\(\) => setFailed\(true\)\}/)
  assert.match(app, /role="alert">生成图无法加载/)
  assert.match(app, /GeneratedPreviewImage key=\{render\.imageUrl\}/)
  assert.match(app, /GeneratedPreviewImage key=\{data\.item\.imageUrl\}/)
})

test('real render previews do not add a color overlay', () => {
  assert.match(
    styles,
    /\.render-compare-layer\.has-real-image::after\s*\{\s*display:\s*none;/,
  )
  assert.match(
    styles,
    /\.render-art\.has-real-image::after,\.dialog-render-art\.has-real-image::after\s*\{\s*display:\s*none;/,
  )
})

test('real render previews preserve the source image colors', () => {
  assert.match(
    styles,
    /\.render-compare-layer\.has-real-image\s*\{[^}]*filter:\s*none;/,
  )
  assert.match(
    styles,
    /\.render-compare-layer\.has-real-image\s*>\s*img\s*\{[^}]*filter:\s*none;[^}]*opacity:\s*1;[^}]*mix-blend-mode:\s*normal;/,
  )
})

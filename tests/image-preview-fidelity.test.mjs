import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

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

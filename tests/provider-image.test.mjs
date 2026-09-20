import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeProviderImage } from '../supabase/functions/_shared/provider-image.js'

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 1]).toString('base64')

test('new image provider may return a complete data URL instead of bare b64_json', () => {
  const result = decodeProviderImage(`data:image/jpeg;base64,${jpeg}`)
  assert.equal(result.base64, jpeg)
  assert.equal(result.declaredType, 'image/jpeg')
  assert.deepEqual([...result.bytes.slice(0, 3)], [0xff, 0xd8, 0xff])
})

test('bare base64 still works and malformed image data fails clearly', () => {
  assert.equal(decodeProviderImage(jpeg).declaredType, '')
  assert.throws(() => decodeProviderImage('data:image/png;base64,not-base64!'))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ASSET_BUCKET_LIMIT_BYTES,
  ASSET_OPTIMIZE_THRESHOLD_BYTES,
  prepareImageForStorage,
  storedImageName,
} from '../src/lib/asset-image.js'
import { createAssetRecord, features } from '../src/data.js'

function fakeBlob(size, type = 'image/png') {
  return { size, type }
}

test('small generated images keep their original bytes and extension', async () => {
  const original = fakeBlob(2 * 1024 * 1024)
  const prepared = await prepareImageForStorage(original, async () => assert.fail('small images must not be re-encoded'))
  assert.equal(prepared, original)
  assert.equal(storedImageName('render.png', prepared.type), 'render.png')
})

test('large 4K PNG assets are optimized and stored with a matching extension', async () => {
  const original = fakeBlob(27_237_302)
  const qualities = []
  const prepared = await prepareImageForStorage(original, async (_blob, quality) => {
    qualities.push(quality)
    return fakeBlob(8 * 1024 * 1024, 'image/webp')
  })
  assert.deepEqual(qualities, [0.96])
  assert.equal(prepared.size, 8 * 1024 * 1024)
  assert.equal(prepared.type, 'image/webp')
  assert.equal(storedImageName('render.png', prepared.type), 'render.webp')
})

test('original 4K asset can still upload when browser optimization is unavailable but it fits the bucket', async () => {
  const original = fakeBlob(27_237_302)
  const prepared = await prepareImageForStorage(original, async () => { throw new Error('codec unavailable') })
  assert.equal(prepared, original)
  assert.ok(prepared.size > ASSET_OPTIMIZE_THRESHOLD_BYTES)
  assert.ok(prepared.size < ASSET_BUCKET_LIMIT_BYTES)
})

test('oversized assets fail before Supabase upload with an actionable message', async () => {
  const original = fakeBlob(ASSET_BUCKET_LIMIT_BYTES + 1)
  await assert.rejects(
    prepareImageForStorage(original, async () => { throw new Error('codec unavailable') }),
    /超过 40 MiB/,
  )
})

test('managed remote image keeps its signed asset persistence token', () => {
  const feature = features.find((item) => item.id === 'render')
  const asset = createAssetRecord(feature, '测试建筑渲染', {
    images: [{ imageUrl: 'https://cdn.example.com/render.png', assetToken: 'expires.signature' }],
  })
  assert.equal(asset.artifacts[0].assetToken, 'expires.signature')
})

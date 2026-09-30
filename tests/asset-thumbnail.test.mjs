import test from 'node:test'
import assert from 'node:assert/strict'
import { THUMBNAIL_MAX_BYTES, prepareAssetThumbnail, storeAssetThumbnail, thumbnailDimensions } from '../src/lib/asset-thumbnail.js'

test('thumbnail dimensions preserve aspect ratio and never upscale', () => {
  assert.deepEqual(thumbnailDimensions(4096, 2048), { width: 480, height: 240 })
  assert.deepEqual(thumbnailDimensions(2048, 4096), { width: 240, height: 480 })
  assert.deepEqual(thumbnailDimensions(120, 80), { width: 120, height: 80 })
  assert.throws(() => thumbnailDimensions(0, 42))
})

test('thumbnail encoding rejects oversized, empty and unsupported output', async () => {
  const source = new Blob(['original'], { type: 'image/png' })
  const small = new Blob(['small'], { type: 'image/webp' })
  assert.equal(await prepareAssetThumbnail(source, async () => small), small)
  assert.equal(await prepareAssetThumbnail(source, async () => ({ size: THUMBNAIL_MAX_BYTES + 1, type: 'image/png' })), null)
  assert.equal(await prepareAssetThumbnail(source, async () => new Blob([], { type: 'image/webp' })), null)
  assert.equal(await prepareAssetThumbnail(source, async () => new Blob(['bad'], { type: 'text/html' })), null)
  assert.equal(await prepareAssetThumbnail(source, async () => { throw new Error('codec') }), null)
})

test('browser encoder creates a 480px thumbnail and releases its bitmap', async () => {
  const source = new Blob(['original'], { type: 'image/png' })
  const thumbnail = new Blob(['small'], { type: 'image/webp' })
  const dimensions = []
  let closed = 0
  const priorBitmap = globalThis.createImageBitmap
  globalThis.createImageBitmap = async () => ({
    width: 4096, height: 2048, close: () => { closed += 1 },
  })
  const priorDocument = globalThis.document
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({ fillRect() {}, drawImage(_image, _x, _y, width, height) { dimensions.push([width, height]) } }),
      toBlob(resolve, type, quality) {
        assert.equal(type, 'image/webp')
        assert.equal(quality, 0.78)
        resolve(thumbnail)
      },
    }),
  }
  try {
    assert.equal(await prepareAssetThumbnail(source), thumbnail)
    assert.deepEqual(dimensions, [[480, 240]])
    assert.equal(closed, 1)
  } finally {
    if (priorBitmap === undefined) delete globalThis.createImageBitmap
    else globalThis.createImageBitmap = priorBitmap
    if (priorDocument === undefined) delete globalThis.document
    else globalThis.document = priorDocument
  }
})

test('inline save reuses upload bytes and uploads only a separate small object', async () => {
  const source = new Blob(['original'], { type: 'image/png' })
  const thumbnail = new Blob(['small'], { type: 'image/webp' })
  const uploads = []
  const path = await storeAssetThumbnail({
    artifact: { imageUrl: 'data:image/png;base64,AAAA' },
    stored: { storagePath: 'alice/package/original.png', sourceBlob: source },
  }, {
    readStoredOriginal: () => assert.fail('inline save must not re-fetch the original'),
    prepareAssetThumbnail: async (blob) => { assert.equal(blob, source); return thumbnail },
    uploadBlob: async (...args) => uploads.push(args),
  })
  assert.equal(path, 'alice/package/original.png.thumb.webp')
  assert.deepEqual(uploads, [[path, thumbnail]])
})

test('remote thumbnail reads the authenticated stored copy, avoiding supplier CORS', async () => {
  const requests = []
  const source = new Blob(['original'], { type: 'image/png' })
  const thumbnail = new Blob(['small'], { type: 'image/png' })
  const path = await storeAssetThumbnail({
    artifact: { imageUrl: 'https://supplier.invalid/blocked.png' },
    stored: { storagePath: 'alice/package/original.png' },
  }, {
    readStoredOriginal: async (artifact) => { requests.push(artifact); return source },
    prepareAssetThumbnail: async (blob) => { assert.equal(blob, source); return thumbnail },
    uploadBlob: async (_path, blob) => assert.equal(blob, thumbnail),
  })
  assert.deepEqual(requests, [{ storagePath: 'alice/package/original.png' }])
  assert.equal(path, 'alice/package/original.png.thumb.png')
})

test('thumbnail failures leave the original save intact and return no path', async () => {
  for (const failure of ['read', 'encode', 'upload']) {
    const result = await storeAssetThumbnail({ artifact: {}, stored: { storagePath: 'original.png' } }, {
      readStoredOriginal: async () => { if (failure === 'read') throw new Error('network'); return new Blob() },
      prepareAssetThumbnail: async () => { if (failure === 'encode') return null; return new Blob(['small'], { type: 'image/webp' }) },
      uploadBlob: async () => { throw new Error('upload') },
    })
    assert.equal(result, null)
  }
})

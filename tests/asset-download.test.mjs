import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetOriginalReader, readAssetOriginalBlob } from '../src/lib/asset-download.js'

const artifact = { storagePath: 'private/4k.png', thumbnailPath: 'private/4k.png.thumb.webp' }
const original = new Blob([new Uint8Array([1, 4, 9, 16])], { type: 'image/png' })

test('download requests original and preserves its bytes and MIME type', async () => {
  const requests = []
  const result = await readAssetOriginalBlob(artifact, {
    getUrl: async (value, options) => { requests.push({ value, options }); return 'signed-original' },
    fetchImage: async (url) => { assert.equal(url, 'signed-original'); return new Response(original) },
  })
  assert.deepEqual(requests, [{ value: artifact, options: { purpose: 'original' } }])
  assert.equal(result.type, original.type)
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array(await original.arrayBuffer()))
})

for (const status of [401, 403, 400]) {
  test('expired URL response ' + status + ' refreshes and retries once', async () => {
    const options = []
    const urls = []
    const blob = await readAssetOriginalBlob(artifact, {
      getUrl: async (_value, value) => { options.push(value); return value.forceRefresh ? 'fresh' : 'cached' },
      fetchImage: async (url) => {
        urls.push(url)
        return url === 'cached'
          ? new Response(JSON.stringify({ message: 'jwt expired' }), { status })
          : new Response(original)
      },
    })
    assert.deepEqual(urls, ['cached', 'fresh'])
    assert.deepEqual(options, [{ purpose: 'original' }, { purpose: 'original', forceRefresh: true }])
    assert.equal(blob.size, original.size)
  })
}

test('second expiry fails without an unbounded refresh loop', async () => {
  let signs = 0
  let reads = 0
  await assert.rejects(readAssetOriginalBlob(artifact, {
    getUrl: async () => { signs += 1; return 'denied' },
    fetchImage: async () => { reads += 1; return new Response('', { status: 403 }) },
  }), /403/)
  assert.equal(signs, 2)
  assert.equal(reads, 2)
})

test('unrelated errors do not refresh URLs or repeat image GETs', async () => {
  for (const status of [400, 404, 500]) {
    let reads = 0
    await assert.rejects(readAssetOriginalBlob(artifact, {
      getUrl: async () => 'signed',
      fetchImage: async () => { reads += 1; return new Response(JSON.stringify({ message: 'not found' }), { status }) },
    }), new RegExp(String(status)))
    assert.equal(reads, 1)
  }
})

test('concurrent original downloads share a single GET', async () => {
  let reads = 0
  const reader = createAssetOriginalReader({
    getUrl: async () => 'signed',
    fetchImage: async () => { reads += 1; return new Response(original) },
  })
  const [first, second] = await Promise.all([reader.read(artifact), reader.read(artifact)])
  assert.equal(first, second)
  assert.equal(reads, 1)
})

test('logout or session switch cancels delivery of a pending original', async () => {
  let complete
  const reader = createAssetOriginalReader({
    getUrl: async () => 'signed',
    fetchImage: () => new Promise((resolve) => { complete = resolve }),
  })
  const pending = reader.read(artifact)
  await Promise.resolve()
  reader.clear()
  complete(new Response(original))
  await assert.rejects(pending, /会话已变更/)
})

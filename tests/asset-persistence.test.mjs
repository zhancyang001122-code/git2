import assert from 'node:assert/strict'
import test from 'node:test'

import { isRemoteAssetUrl, storeAssetArtifact } from '../src/lib/asset-persistence.js'

test('remote generated images always use the authenticated server persistence path', async () => {
  const calls = []
  const artifact = {
    imageUrl: 'https://download.example.com/generated/render.png',
    assetToken: 'expires.signature',
  }
  const stored = await storeAssetArtifact(
    { artifact, packageId: 'package-id', baseName: 'render' },
    {
      persistRemote: async (request) => {
        calls.push(request)
        return { fileName: 'render.png', storagePath: 'user-id/package-id/render.png' }
      },
      imageUrlToBlob: async () => assert.fail('remote URLs must never be fetched by the browser'),
    },
  )

  assert.equal(isRemoteAssetUrl(artifact.imageUrl), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].artifact.assetToken, 'expires.signature')
  assert.equal(stored.storagePath, 'user-id/package-id/render.png')
})

test('inline images keep the local optimized upload path', async () => {
  const uploads = []
  const sourceBlob = { type: 'image/png', size: 1024 }
  const stored = await storeAssetArtifact(
    {
      artifact: { imageUrl: 'data:image/png;base64,AAAA' },
      packageId: 'package-id',
      baseName: 'render.png',
    },
    {
      userId: 'user-id',
      persistRemote: async () => assert.fail('inline images must not use the remote transfer endpoint'),
      imageUrlToBlob: async () => sourceBlob,
      prepareImageForStorage: async (blob) => blob,
      storedImageName: () => 'render.png',
      uploadBlob: async (storagePath, blob) => uploads.push({ storagePath, blob }),
    },
  )

  assert.equal(isRemoteAssetUrl('data:image/png;base64,AAAA'), false)
  assert.deepEqual(uploads, [{ storagePath: 'user-id/package-id/render.png', blob: sourceBlob }])
  assert.equal(stored.storagePath, 'user-id/package-id/render.png')
})

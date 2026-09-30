import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASSET_URL_TTL_SECONDS, assetImagePath, assetListPreviews, assetPage,
  assetSessionScope, createAssetUrlCache, listedArtifacts,
} from '../src/lib/asset-access.js'

function session(userId, sessionId, generation = 1) {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId, exp: generation })).toString('base64url')
  return { user: { id: userId, last_sign_in_at: '2026-09-30' }, access_token: 'header.' + payload + '.signature' }
}

test('session cache survives token refresh but separates users and logins', () => {
  const scope = assetSessionScope(session('alice', 'first'))
  assert.equal(scope, assetSessionScope(session('alice', 'first', 2)))
  assert.notEqual(scope, assetSessionScope(session('alice', 'second')))
  assert.notEqual(scope, assetSessionScope(session('bob', 'first')))
  assert.equal(assetSessionScope(null), '')
  assert.doesNotThrow(() => assetSessionScope({ user: { id: 'alice' }, access_token: 'bad' }))
})

test('concurrent reads and repeated navigation reuse one unexpired signed URL', async () => {
  const calls = []
  const cache = createAssetUrlCache({ sign: async (...args) => { calls.push(args); return 'signed-1' } })
  cache.setScope('alice/session-1')
  assert.deepEqual(await Promise.all([cache.get('a.png'), cache.get('a.png')]), ['signed-1', 'signed-1'])
  cache.setScope('alice/session-1')
  assert.equal(await cache.get('a.png'), 'signed-1')
  assert.deepEqual(calls, [['a.png', ASSET_URL_TTL_SECONDS, false]])
})

test('URL refreshes before expiry, shares the refresh and renews after expiry', async () => {
  let clock = 0
  let signs = 0
  const cache = createAssetUrlCache({ now: () => clock, sign: async () => 'signed-' + ++signs })
  cache.setScope('alice')
  assert.equal(await cache.get('a'), 'signed-1')
  clock = ASSET_URL_TTL_SECONDS * 1000 - 30_001
  assert.equal(await cache.get('a'), 'signed-1')
  clock += 1
  assert.deepEqual(await Promise.all([cache.get('a'), cache.get('a')]), ['signed-2', 'signed-2'])
  clock += ASSET_URL_TTL_SECONDS * 1000 + 1
  assert.equal(await cache.get('a'), 'signed-3')
})

test('forced refreshes share a request and download URLs stay separate', async () => {
  let signs = 0
  const cache = createAssetUrlCache({ sign: async () => 'signed-' + ++signs })
  cache.setScope('alice')
  assert.equal(await cache.get('a'), 'signed-1')
  assert.deepEqual(await Promise.all([
    cache.get('a', { forceRefresh: true }), cache.get('a', { forceRefresh: true }),
  ]), ['signed-2', 'signed-2'])
  assert.equal(await cache.get('a', { download: true }), 'signed-3')
  assert.equal(await cache.get('a'), 'signed-2')
})

test('logout blocks reads, drops URLs and rejects signing already in flight', async () => {
  let finish
  const cache = createAssetUrlCache({ sign: () => new Promise((resolve) => { finish = resolve }) })
  cache.setScope('alice')
  const pending = cache.get('private.png')
  await Promise.resolve()
  cache.clear()
  finish('old-private-url')
  await assert.rejects(pending, /会话已变更/)
  await assert.rejects(cache.get('private.png'), /登录/)
})

test('user switch cannot return or overwrite a previous session request', async () => {
  const completions = []
  const cache = createAssetUrlCache({ sign: () => new Promise((resolve) => completions.push(resolve)) })
  cache.setScope('alice')
  const previous = cache.get('same-path')
  await Promise.resolve()
  cache.setScope('bob')
  const current = cache.get('same-path')
  await Promise.resolve()
  completions[0]('alice-url')
  await assert.rejects(previous, /会话已变更/)
  const duplicate = cache.get('same-path')
  completions[1]('bob-url')
  assert.deepEqual(await Promise.all([current, duplicate]), ['bob-url', 'bob-url'])
  assert.equal(await cache.get('same-path'), 'bob-url')
  assert.equal(completions.length, 2)
})

test('failed signing is not cached and can be retried', async () => {
  let attempts = 0
  const cache = createAssetUrlCache({ sign: async () => {
    if (++attempts === 1) throw new Error('network')
    return 'valid-url'
  } })
  cache.setScope('alice')
  await assert.rejects(cache.get('a'), /network/)
  assert.equal(await cache.get('a'), 'valid-url')
})

test('cloud list strips transient URLs and never falls back to original images', () => {
  const old = { id: 1, storagePath: 'original.png', imageUrl: 'signed-original', assetToken: 'token' }
  const modern = { id: 2, storagePath: 'original-2.png', thumbnailPath: 'small.webp', thumbnailUrl: 'signed-thumb' }
  const items = listedArtifacts([old, modern])
  assert.deepEqual(items, [{ id: 1, storagePath: 'original.png' }, { id: 2, storagePath: 'original-2.png', thumbnailPath: 'small.webp' }])
  assert.deepEqual(assetListPreviews([old]), [])
  assert.deepEqual(assetListPreviews(items), [items[1]])
  assert.equal(assetImagePath(old), undefined)
  assert.equal(assetImagePath(modern), 'small.webp')
  assert.equal(assetImagePath(modern, 'original'), 'original-2.png')
  assert.equal(old.imageUrl, 'signed-original')
})

test('guest images remain usable and only one preview is mounted per asset', () => {
  const guest = { imageUrl: 'blob:session-only' }
  assert.deepEqual(assetListPreviews([guest, guest, guest]), [guest])
})

test('pagination mounts at most 12 assets and clamps after filtering or deletion', () => {
  const assets = Array.from({ length: 27 }, (_, id) => ({ id }))
  assert.deepEqual(assetPage(assets, 0).items, assets.slice(0, 12))
  assert.deepEqual(assetPage(assets, 1).items, assets.slice(12, 24))
  assert.deepEqual(assetPage(assets, 99).items, assets.slice(24))
  assert.equal(assetPage(assets.slice(0, 2), 2).page, 0)
  assert.deepEqual(assetPage([], 0), { page: 0, pageCount: 1, items: [] })
})

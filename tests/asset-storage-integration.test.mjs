import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'vite'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

let api
const fixture = '.qa/asset-storage-test-' + process.pid + '.mjs'
before(async () => {
  const bundle = await build({
    configFile: false, logLevel: 'silent',
    build: {
      ssr: 'src/lib/supabase.js', write: false,
      rollupOptions: { external: (id) => !id.startsWith('.') && !isAbsolute(id) },
    },
  })
  await mkdir('.qa', { recursive: true })
  await writeFile(fixture, bundle.output.find((item) => item.type === 'chunk').code)
  api = await import(pathToFileURL(resolve(fixture)).href)
  await api.supabase.auth.getSession()
})
after(async () => { await unlink(fixture).catch(() => {}) })

function session(userId, sessionId) {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId })).toString('base64url')
  return { user: { id: userId }, access_token: 'header.' + payload + '.signature' }
}
const artifact = { storagePath: 'alice/original.png', thumbnailPath: 'alice/small.webp' }

test('workspace metadata load performs zero image signing or image GET requests', async (t) => {
  t.mock.method(api.supabase, 'from', (table) => ({
    select: () => ({ order: async () => ({ data: table === 'assets' ? [{
      id: 'asset', artifacts: [{ ...artifact, imageUrl: 'stale-signed-url' }],
    }] : [], error: null }) }),
  }))
  t.mock.method(api.supabase.storage, 'from', () => assert.fail('listing must not access Storage'))
  t.mock.method(globalThis, 'fetch', () => assert.fail('listing must not fetch images'))
  const workspace = await api.loadInternalWorkspace()
  assert.equal(workspace.assets.length, 1)
  assert.deepEqual(workspace.assets[0].artifacts, [artifact])
})

test('Storage integration reuses thumbnail signing and skips legacy originals', async (t) => {
  t.mock.method(api.supabase.auth, 'getSession', async () => ({ data: { session: session('alice', 'integration') }, error: null }))
  const paths = []
  t.mock.method(api.supabase.storage, 'from', () => ({
    createSignedUrl: async (path) => { paths.push(path); return { data: { signedUrl: 'signed-' + path }, error: null } },
  }))
  assert.equal(await api.getAssetImageUrl({ storagePath: 'legacy.png' }), '')
  const urls = await Promise.all([api.getAssetImageUrl(artifact), api.getAssetImageUrl(artifact)])
  assert.deepEqual(urls, ['signed-alice/small.webp', 'signed-alice/small.webp'])
  await api.getAssetImageUrl(artifact)
  assert.deepEqual(paths, ['alice/small.webp'])
})

test('download integration reads original bytes and session change drops cache', async (t) => {
  let active = session('alice', 'download')
  t.mock.method(api.supabase.auth, 'getSession', async () => ({ data: { session: active }, error: null }))
  const paths = []
  t.mock.method(api.supabase.storage, 'from', () => ({
    createSignedUrl: async (path) => { paths.push(path); return { data: { signedUrl: 'https://signed.invalid/' + path }, error: null } },
  }))
  let reads = 0
  const bytes = new Uint8Array([0, 1, 127, 255])
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, 'https://signed.invalid/alice/original.png')
    reads += 1
    return new Response(new Blob([bytes], { type: 'image/png' }))
  })
  const [first, second] = await Promise.all([api.getAssetOriginalBlob(artifact), api.getAssetOriginalBlob(artifact)])
  assert.equal(first, second)
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), bytes)
  assert.equal(reads, 1)
  assert.deepEqual(paths, ['alice/original.png'])
  active = session('bob', 'other')
  await api.getAssetImageUrl(artifact, { purpose: 'original' })
  assert.equal(paths.length, 2)
})

test('explicit logout clears URLs and cancels future authenticated image access', async (t) => {
  let active = session('alice', 'logout')
  t.mock.method(api.supabase.auth, 'getSession', async () => ({ data: { session: active }, error: null }))
  t.mock.method(api.supabase.auth, 'signOut', async () => { active = null; return { error: null } })
  t.mock.method(api.supabase.storage, 'from', () => ({
    createSignedUrl: async () => ({ data: { signedUrl: 'signed' }, error: null }),
  }))
  assert.equal(await api.getAssetImageUrl(artifact), 'signed')
  await api.signOutInternalAccount()
  await assert.rejects(api.getAssetImageUrl(artifact), /登录/)
})

test('logout rejects an authentication read already in flight without signing old paths', async (t) => {
  let complete
  const stale = session('alice', 'stale')
  t.mock.method(api.supabase.auth, 'getSession', () => new Promise((resolve) => { complete = resolve }))
  t.mock.method(api.supabase.auth, 'signOut', async () => ({ error: null }))
  t.mock.method(api.supabase.storage, 'from', () => assert.fail('stale session must not sign an image'))
  const pending = api.getAssetImageUrl(artifact)
  await api.signOutInternalAccount()
  complete({ data: { session: stale }, error: null })
  await assert.rejects(pending, /会话已变更/)
})

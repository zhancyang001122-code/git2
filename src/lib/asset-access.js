export const ASSET_URL_TTL_SECONDS = 60 * 60
const REFRESH_MARGIN_MS = 30_000

// This JWT claim only namespaces the cache; Storage authorizes every sign.
// session_id survives token refresh and distinguishes logins of the same user.
export function assetSessionScope(session) {
  if (!session?.user?.id) return ''
  let sessionId = ''
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    sessionId = JSON.parse(atob(payload)).session_id || ''
  } catch {
    // Older sessions without this claim still separate users and login times.
  }
  return JSON.stringify([session.user.id, sessionId || session.user.last_sign_in_at || ''])
}

export function assetImagePath(artifact, purpose = 'thumbnail') {
  return purpose === 'original' ? artifact?.storagePath : artifact?.thumbnailPath
}

export function createAssetUrlCache({ sign, now = Date.now }) {
  let scope = ''
  let revision = 0
  const entries = new Map()
  const pending = new Map()

  function clear() {
    revision += 1
    scope = ''
    entries.clear()
    pending.clear()
  }

  function setScope(next) {
    if (scope === next) return
    clear()
    scope = next
  }

  async function get(path, { forceRefresh = false, download = false } = {}) {
    if (!path) return ''
    if (!scope) throw new Error('请先登录后读取云端图片。')
    const key = JSON.stringify([path, download])
    // Share an in-flight refresh as well as the initial signing request.
    if (pending.has(key)) return pending.get(key)
    const cached = entries.get(key)
    if (!forceRefresh && cached?.expiresAt > now() + REFRESH_MARGIN_MS) return cached.url
    entries.delete(key)
    const startedAt = now()
    const startedRevision = revision
    const request = Promise.resolve().then(() => sign(path, ASSET_URL_TTL_SECONDS, download)).then((url) => {
      if (startedRevision !== revision) throw new Error('登录会话已变更，请重新打开图片。')
      if (!url) throw new Error('图片地址暂时不可用。')
      for (const [entryKey, entry] of entries) {
        if (entry.expiresAt <= now()) entries.delete(entryKey)
      }
      if (entries.size >= 256) entries.delete(entries.keys().next().value)
      entries.set(key, { url, expiresAt: startedAt + ASSET_URL_TTL_SECONDS * 1000 })
      return url
    }).finally(() => {
      if (pending.get(key) === request) pending.delete(key)
    })
    pending.set(key, request)
    return request
  }

  return { get, setScope, clear }
}

// Metadata only: listing assets must never mint or embed original-image URLs.
export function listedArtifacts(artifacts = []) {
  return artifacts.map(({ imageUrl: _imageUrl, thumbnailUrl: _thumbnailUrl, assetToken: _assetToken, ...artifact }) => artifact)
}

export function assetListPreviews(artifacts = []) {
  return artifacts.filter((item) => item.thumbnailPath || (!item.storagePath && item.imageUrl)).slice(0, 1)
}

export const ASSET_PAGE_SIZE = 12

export function assetPage(assets, requestedPage, pageSize = ASSET_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(assets.length / pageSize))
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1)
  return { page, pageCount, items: assets.slice(page * pageSize, (page + 1) * pageSize) }
}

async function expiredSignedResponse(response) {
  if (response.status === 401 || response.status === 403) return true
  // Storage also returns 400 InvalidJWT for an expired signed URL.
  if (response.status !== 400) return false
  try {
    const body = await response.clone().json()
    return /(?:jwt|token).*expir|expir.*(?:jwt|token)/i.test(body.message || body.error || '')
  } catch {
    return false
  }
}

export async function readAssetOriginalBlob(artifact, { getUrl, fetchImage = fetch }) {
  let url = await getUrl(artifact, { purpose: 'original' })
  let response = await fetchImage(url)
  // A cached URL may be rejected after server-side expiry. Refresh only once.
  if (await expiredSignedResponse(response)) {
    url = await getUrl(artifact, { purpose: 'original', forceRefresh: true })
    response = await fetchImage(url)
  }
  if (!response.ok) throw new Error(`原图下载失败（${response.status}）。`)
  return response.blob()
}

export function createAssetOriginalReader(adapters) {
  let revision = 0
  const pending = new Map()
  function clear() {
    revision += 1
    pending.clear()
  }
  function read(artifact) {
    const path = artifact.storagePath
    if (pending.has(path)) return pending.get(path)
    const startedRevision = revision
    const request = readAssetOriginalBlob(artifact, adapters).then((blob) => {
      if (startedRevision !== revision) throw new Error('登录会话已变更，下载已取消。')
      return blob
    }).finally(() => {
      if (pending.get(path) === request) pending.delete(path)
    })
    pending.set(path, request)
    return request
  }
  return { read, clear }
}

import { createClient } from '@supabase/supabase-js'
import { prepareImageForStorage, storedImageName } from './asset-image.js'
import { storeAssetArtifact } from './asset-persistence.js'
import { waitForImageTask } from './async-image-task.js'
import { clearInvalidBrowserSession, validatedBrowserSession } from './session.js'

// These values are public browser configuration, not server secrets. Keeping a
// checked-in fallback prevents a missing Vercel/GitHub build variable from
// silently disabling cross-device login during a demo.
const defaultSupabaseUrl = 'https://mblnorfsegteomazffwy.supabase.co'
const defaultSupabasePublishableKey = 'sb_publishable_Gn8SniEtQm0cnqdEcIS8xw_HIwAl1a5'
const defaultInternalAccountEmail = 'internal-account-1@archflow.local'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl).trim()
const supabasePublishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY
    || defaultSupabasePublishableKey,
).trim()

export const internalAccountUsername = '内部账户1'
export const internalAccountEmail = String(
  import.meta.env.VITE_INTERNAL_ACCOUNT_EMAIL || defaultInternalAccountEmail,
).trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

function requireClient() {
  if (!supabase) throw new Error('云端项目尚未完成部署配置，请稍后再试。')
  return supabase
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function readableAuthError(error) {
  const message = String(error?.message || '')
  if (message === 'Invalid login credentials') return '账号或密码不正确，请确认使用内部账户的 8 位密码。'
  if (/failed to fetch|network|load failed/i.test(message)) return '无法连接登录服务，请检查网络后重试。'
  if (/rate limit|too many requests/i.test(message)) return '登录尝试过于频繁，请稍等一分钟后重试。'
  if (/email not confirmed/i.test(message)) return '内部账户尚未完成验证，请联系管理员。'
  return message || '登录服务暂时不可用，请稍后重试。'
}

function formatMemoTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚'
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getMonth() + 1)} 月 ${pad(date.getDate())} 日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatAssetTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚保存'
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getMonth() + 1)} 月 ${pad(date.getDate())} 日`
}

function mapMemo(row) {
  return {
    id: row.id,
    text: row.content,
    time: formatMemoTime(row.updated_at || row.created_at),
    createdAt: row.created_at,
  }
}

async function signedArtifact(artifact) {
  if (!artifact?.storagePath) return artifact
  const client = requireClient()
  const { data, error } = await client.storage.from('user-assets').createSignedUrl(artifact.storagePath, 60 * 60)
  if (error) throw error
  return { ...artifact, imageUrl: data.signedUrl }
}

async function mapAsset(row) {
  const artifacts = await Promise.all((row.artifacts || []).slice(0, 3).map(signedArtifact))
  return {
    id: row.id,
    title: row.title,
    type: row.asset_type,
    files: row.file_count,
    time: formatAssetTime(row.updated_at || row.created_at),
    source: row.source,
    tone: row.tone,
    artifacts,
    resultData: row.result_data,
    sessionOnly: false,
    persistent: true,
  }
}

async function currentUser() {
  const client = requireClient()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('登录状态已失效，请重新登录。')
  return data.user
}

export async function getCurrentSession() {
  if (!supabase) return null
  return validatedBrowserSession(supabase.auth)
}

export function subscribeToAuth(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event))
  return () => data.subscription.unsubscribe()
}

export async function recoverInvalidSession() {
  if (!supabase) return
  await clearInvalidBrowserSession(supabase.auth)
}

export async function signInInternalAccount(username, password) {
  const normalizedUsername = username.trim()
  if (normalizedUsername !== internalAccountUsername) throw new Error('账号或密码不正确。')
  const client = requireClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: internalAccountEmail,
    password,
  })
  if (error) throw new Error(readableAuthError(error))
  if (!data.session) throw new Error('登录服务未返回有效会话，请稍后重试。')
  return data.session
}

export async function signOutInternalAccount() {
  const client = requireClient()
  // Multiple interviewers may use the shared internal account at the same
  // time. A global sign-out would revoke every device session; local scope
  // only clears the browser that requested the logout.
  unwrap(await client.auth.signOut({ scope: 'local' }))
}

export async function loadInternalWorkspace() {
  const client = requireClient()
  const [memoRows, assetRows] = await Promise.all([
    unwrap(await client.from('memos').select('*').order('created_at', { ascending: false })),
    unwrap(await client.from('assets').select('*').order('created_at', { ascending: false })),
  ])
  return {
    memos: memoRows.map(mapMemo),
    assets: await Promise.all(assetRows.map(mapAsset)),
  }
}

export async function insertMemo(content) {
  const user = await currentUser()
  const client = requireClient()
  const row = unwrap(await client.from('memos').insert({ user_id: user.id, content }).select().single())
  return mapMemo(row)
}

export async function updateMemo(id, content) {
  const client = requireClient()
  const row = unwrap(await client.from('memos').update({ content }).eq('id', id).select().single())
  return mapMemo(row)
}

async function imageUrlToBlob(imageUrl) {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`生成图读取失败（${response.status}）`)
    return response.blob()
  } catch (error) {
    if (/^https:\/\//i.test(String(imageUrl || '')) && /fetch|network|load failed/i.test(String(error?.message || error))) {
      throw new Error('生成图服务禁止浏览器跨域读取，已停止直接上传。请刷新页面重新生成后再保存。')
    }
    throw error
  }
}

function safeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'generated-image'
}

function isRetryableStorageError(error) {
  const status = Number(error?.statusCode || error?.status || 0)
  const message = String(error?.message || error || '')
  return status === 408 || status === 429 || status >= 500 || /fetch|network|timeout|load failed|暂时|（50[234]）/i.test(message)
}

async function retryIdempotent(operation, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isRetryableStorageError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 350 * (2 ** (attempt - 1))))
    }
  }
  throw lastError
}

async function uploadArtifactBlob(client, objectPath, blob) {
  return retryIdempotent(async () => unwrap(await client.storage.from('user-assets').upload(objectPath, blob, {
    contentType: blob.type || 'image/png',
    upsert: true,
  })))
}

async function persistRemoteArtifact({ artifact, packageId, storedName }) {
  return retryIdempotent(() => invokeGenerateFunction(requireClient(), {
    action: 'persist-artifact',
    imageUrl: artifact.imageUrl,
    assetToken: artifact.assetToken || '',
    packageId,
    fileName: storedName,
  }))
}

export async function persistAsset(asset) {
  const user = await currentUser()
  const client = requireClient()
  const packageId = crypto.randomUUID()
  const assetId = crypto.randomUUID()
  const uploadedPaths = []

  try {
    const artifacts = []
    for (const [index, artifact] of (asset.artifacts || []).entries()) {
      if (!artifact.imageUrl) continue
      const baseName = safeFileName(artifact.name || `generated-${index + 1}`)
      const persisted = await storeAssetArtifact(
        { artifact, packageId, baseName },
        {
          userId: user.id,
          persistRemote: persistRemoteArtifact,
          imageUrlToBlob,
          prepareImageForStorage,
          storedImageName,
          uploadBlob: (objectPath, blob) => uploadArtifactBlob(client, objectPath, blob),
        },
      )
      const storedName = persisted.fileName
      const objectPath = persisted.storagePath

      uploadedPaths.push(objectPath)
      artifacts.push({
        id: artifact.id || index + 1,
        name: storedName,
        title: artifact.title || '生成图像',
        meta: artifact.meta || 'ArchFlow 真实生成',
        storagePath: objectPath,
      })
    }

    const row = await retryIdempotent(async () => unwrap(await client.from('assets').upsert({
      id: assetId,
      user_id: user.id,
      title: asset.title,
      asset_type: asset.type,
      file_count: artifacts.length || asset.files,
      source: asset.source,
      tone: asset.tone,
      artifacts,
      result_data: stripLargeImagePayload(asset.resultData),
    }, { onConflict: 'id' }).select().single()))
    return mapAsset(row)
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        await retryIdempotent(async () => unwrap(await client.storage.from('user-assets').remove(uploadedPaths)))
      } catch (cleanupError) {
        console.error('资产保存回滚失败', cleanupError)
      }
    }
    throw error
  }
}

export async function deletePersistentAsset(asset) {
  const client = requireClient()
  const paths = (asset.artifacts || []).map((item) => item.storagePath).filter(Boolean)
  if (paths.length) unwrap(await client.storage.from('user-assets').remove(paths))
  unwrap(await client.from('assets').delete().eq('id', asset.id))
}

function stripLargeImagePayload(result) {
  if (!result) return null
  const { fileNames: _fileNames, originalImageUrl, images = [], ...rest } = result
  return {
    ...rest,
    originalImageUrl: originalImageUrl ? '[session-only-upload-removed]' : undefined,
    images: images.map(({ imageUrl: _imageUrl, assetToken: _assetToken, ...image }) => image),
  }
}

export async function recordGeneration({ feature, prompt, result }) {
  const user = await currentUser()
  const client = requireClient()
  unwrap(await client.from('generation_history').insert({
    user_id: user.id,
    feature_id: feature,
    prompt,
    file_names: [],
    result_data: stripLargeImagePayload(result),
  }))
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`))
    reader.onload = () => {
      const [, data = ''] = String(reader.result).split(',', 2)
      resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', data })
    }
    reader.readAsDataURL(file)
  })
}

async function cloudFunctionErrorMessage(error) {
  try {
    const context = error?.context
    if (context && typeof context.clone === 'function') {
      const payload = await context.clone().json()
      if (payload?.error) return String(payload.error)
    }
  } catch {
    // Fall back to the SDK error below when the response body is unavailable.
  }
  return String(error?.message || '云端生成服务调用失败。')
}

async function invokeGenerateFunction(client, body) {
  const { data, error } = await client.functions.invoke('generate', { body })
  if (error) throw new Error(await cloudFunctionErrorMessage(error))
  if (data?.error) throw new Error(data.error)
  return data
}

export async function generateWithCloudApi({ feature, prompt, files = [], options = {} }) {
  const client = requireClient()
  const imageFiles = files.filter((file) => file.type?.startsWith('image/')).slice(0, 1)
  const attachments = await Promise.all(imageFiles.map(fileToAttachment))
  const imageSlot = options.imageSlot || 'image1'
  const fileNames = files.map((file) => file.name)
  const request = {
    action: 'generate',
    feature,
    prompt,
    fileNames,
    attachments,
    imageSlot,
    imageSize: options.imageSize,
    imageAspectRatio: options.imageAspectRatio,
  }
  const initialResult = await invokeGenerateFunction(client, request)
  const result = await waitForImageTask(initialResult, (task) => invokeGenerateFunction(client, {
    action: 'image-task-status',
    feature,
    prompt,
    fileNames,
    imageSlot,
    imageAspectRatio: options.imageAspectRatio,
    taskId: task.taskId,
    taskToken: task.taskToken,
  }))
  if (result && !result.originalImageUrl && attachments[0]?.data) {
    return {
      ...result,
      originalImageUrl: `data:${attachments[0].mimeType || 'image/png'};base64,${attachments[0].data}`,
    }
  }
  return result
}

export async function getCloudCapabilities() {
  const client = requireClient()
  const { data, error } = await client.functions.invoke('generate', { body: { action: 'capabilities' } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return {
    languageReady: Boolean(data?.languageReady),
    languageModel: data?.languageModel || '',
    imageModes: data?.imageModes || [],
  }
}

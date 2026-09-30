import { extensionForImageType } from './asset-image.js'

export const THUMBNAIL_MAX_EDGE = 480
export const THUMBNAIL_MAX_BYTES = 200 * 1024

export function thumbnailDimensions(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('图片尺寸无效。')
  const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

async function encodeThumbnail(blob) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  const bitmap = await createImageBitmap(blob)
  try {
    const dimensions = thumbnailDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    Object.assign(canvas, dimensions)
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78))
  } finally {
    bitmap.close?.()
  }
}

export async function prepareAssetThumbnail(blob, encode = encodeThumbnail) {
  if (!/^image\/(?:png|jpeg|webp)$/i.test(blob?.type || '')) return null
  try {
    const thumbnail = await encode(blob)
    // An unsupported codec must never silently upload a full-size original.
    return /^image\/(?:png|jpeg|webp)$/i.test(thumbnail?.type || '')
      && thumbnail.size > 0 && thumbnail.size <= THUMBNAIL_MAX_BYTES ? thumbnail : null
  } catch {
    return null
  }
}

// Best-effort for new saves only. Historical assets are never read or backfilled.
export async function storeAssetThumbnail({ artifact, stored }, adapters) {
  try {
    // Reuse the inline upload bytes. Remote providers may block browser CORS;
    // read their authenticated persisted copy once, only when saving a new asset.
    const source = stored.sourceBlob || await adapters.readStoredOriginal({ storagePath: stored.storagePath })
    const thumbnail = await adapters.prepareAssetThumbnail(source)
    if (!thumbnail) return null
    const path = `${stored.storagePath}.thumb.${extensionForImageType(thumbnail.type)}`
    await adapters.uploadBlob(path, thumbnail)
    return path
  } catch {
    return null
  }
}

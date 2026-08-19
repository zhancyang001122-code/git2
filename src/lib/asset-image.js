export const ASSET_BUCKET_LIMIT_BYTES = 40 * 1024 * 1024
export const ASSET_OPTIMIZE_THRESHOLD_BYTES = 10 * 1024 * 1024

const WEBP_QUALITY_STEPS = [0.96, 0.9, 0.84]

export function extensionForImageType(type) {
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/webp') return 'webp'
  return 'png'
}

export function storedImageName(name, type) {
  const extension = extensionForImageType(type)
  const base = String(name || 'generated-image').replace(/\.[^.]+$/, '') || 'generated-image'
  return `${base}.${extension}`
}

async function encodeWebpInBrowser(blob, quality) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error('当前浏览器不支持大图优化。')
  }

  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('无法创建图片处理画布。')
    context.drawImage(bitmap, 0, 0)
    const encoded = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('浏览器无法编码 WebP 图片。')),
        'image/webp',
        quality,
      )
    })
    return encoded
  } finally {
    bitmap.close?.()
  }
}

export async function prepareImageForStorage(blob, encode = encodeWebpInBrowser) {
  let candidate = blob

  if (blob.size > ASSET_OPTIMIZE_THRESHOLD_BYTES && /^image\/(?:png|jpeg|webp)$/i.test(blob.type)) {
    for (const quality of WEBP_QUALITY_STEPS) {
      try {
        const encoded = await encode(blob, quality)
        if (encoded?.size && encoded.size < candidate.size) candidate = encoded
        if (candidate.size <= ASSET_OPTIMIZE_THRESHOLD_BYTES) break
      } catch {
        break
      }
    }
  }

  if (candidate.size > ASSET_BUCKET_LIMIT_BYTES) {
    throw new Error('4K 图片超过 40 MiB 且浏览器无法压缩，请先下载原图后再尝试保存。')
  }

  return candidate
}

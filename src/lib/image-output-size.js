export const ORIGINAL_RATIO_LONG_EDGE = 3840

export function fitOriginalImageTo4K(width, height, longEdge = ORIGINAL_RATIO_LONG_EDGE) {
  const sourceWidth = Number(width)
  const sourceHeight = Number(height)
  const targetLongEdge = Number(longEdge)

  if (![sourceWidth, sourceHeight, targetLongEdge].every(Number.isFinite)
    || sourceWidth <= 0 || sourceHeight <= 0 || targetLongEdge < 64 || targetLongEdge > 4096) {
    throw new Error('无法读取原图尺寸，请换一张 JPG、PNG 或 WEBP 图片。')
  }

  const scale = targetLongEdge / Math.max(sourceWidth, sourceHeight)
  const outputWidth = Math.round(sourceWidth * scale)
  const outputHeight = Math.round(sourceHeight * scale)

  if (outputWidth < 64 || outputHeight < 64) {
    throw new Error('原图比例过于狭长，短边换算后低于 64 像素，请改用自定义图幅。')
  }

  return {
    width: outputWidth,
    height: outputHeight,
    size: `${outputWidth}x${outputHeight}`,
  }
}

export async function readImageDimensions(blob) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    try {
      return { width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap.close?.()
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    throw new Error('当前浏览器无法读取原图尺寸。')
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('原图解码失败，请换一张 JPG、PNG 或 WEBP 图片。'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function originalImageOutputSize(blob, decode = readImageDimensions) {
  const { width, height } = await decode(blob)
  return fitOriginalImageTo4K(width, height).size
}

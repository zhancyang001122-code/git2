export function decodeProviderImage(value) {
  if (typeof value !== 'string') throw new Error('图片数据不是字符串。')
  const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(value.trim())
  const base64 = (match ? match[2] : value).replace(/\s/g, '')
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('图片 Base64 数据无效。')
  const binary = atob(base64)
  return {
    bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    base64,
    declaredType: match?.[1] || '',
  }
}

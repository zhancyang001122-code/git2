import { useEffect, useRef, useState } from 'react'
import { getAssetImageUrl } from '../lib/supabase.js'

export function AssetImage({ artifact, purpose = 'thumbnail', alt = '' }) {
  const container = useRef(null)
  const [visible, setVisible] = useState(purpose === 'original')
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const path = purpose === 'original' ? artifact.storagePath : artifact.thumbnailPath

  useEffect(() => {
    if (visible) return undefined
    if (typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '150px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    let active = true
    if (!visible) return undefined
    setUrl('')
    setFailed(false)
    getAssetImageUrl(artifact, { purpose, forceRefresh: retry > 0 })
      .then((value) => { if (active) setUrl(value) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [visible, path, artifact.imageUrl, purpose, retry])

  return (
    <span ref={container} className={`asset-image-slot ${purpose === 'original' ? 'is-original' : ''}`}>
      {url && !failed ? <img src={url} alt={alt} loading={purpose === 'thumbnail' ? 'lazy' : 'eager'} decoding="async" draggable="false" onError={() => {
        if (path && retry === 0) setRetry(1)
        else setFailed(true)
      }} /> : <span className="asset-image-placeholder">{failed ? '图片暂时无法加载' : purpose === 'original' ? '正在加载原图…' : '打开查看原图'}</span>}
    </span>
  )
}

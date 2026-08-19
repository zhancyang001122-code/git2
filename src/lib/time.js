export function formatElapsedTime(value) {
  const numericValue = Number(value)
  const totalSeconds = Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (part) => String(part).padStart(2, '0')

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

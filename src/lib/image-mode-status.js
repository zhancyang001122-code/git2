const statusCopy = {
  connected: { className: 'is-ready', label: '已连接', optionLabel: '已连接' },
  warning: { className: 'is-warning', label: '待实测', optionLabel: '待实测' },
  error: { className: 'is-missing', label: '检测失败', optionLabel: '检测失败' },
  not_configured: { className: 'is-missing', label: '配置不完整', optionLabel: '配置不完整' },
}

export function imageModeConnection(mode = {}) {
  const fallbackStatus = mode.connected === false ? 'warning' : 'connected'
  const status = statusCopy[mode.connectionStatus] ? mode.connectionStatus : fallbackStatus
  return {
    status,
    ...statusCopy[status],
    message: mode.connectionMessage || statusCopy[status].label,
  }
}

export function imageModeOptionLabel(mode = {}) {
  const connection = imageModeConnection(mode)
  const maxSize = mode.maxSize ? ` · 最高 ${mode.maxSize}` : ''
  return `${mode.label || '内置生图 API'} · ${mode.model || '等待配置'}${maxSize} · ${connection.optionLabel}`
}

export function isImageModeSelectable(mode = {}) {
  return mode.configured !== false && mode.connectionReason !== 'model_missing' && mode.connectionStatus !== 'error'
}

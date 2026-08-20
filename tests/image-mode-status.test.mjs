import assert from 'node:assert/strict'
import test from 'node:test'

import { imageModeConnection, imageModeOptionLabel, isImageModeSelectable } from '../src/lib/image-mode-status.js'

test('已连接模型显示连接状态', () => {
  const mode = { label: 'API 1', model: 'image-1', maxSize: '4K', connected: true, connectionStatus: 'connected' }
  assert.equal(imageModeConnection(mode).label, '已连接')
  assert.match(imageModeOptionLabel(mode), /API 1 · image-1 · 最高 4K · 已连接/)
})

test('模型列表接口不支持时仍保留为可选择的待实测模型', () => {
  const mode = { configured: true, connected: false, connectionStatus: 'warning', connectionMessage: '服务可连接，但模型待实测' }
  assert.equal(imageModeConnection(mode).message, '服务可连接，但模型待实测')
  assert.equal(isImageModeSelectable(mode), true)
})

test('服务商确认不存在的模型不可选择', () => {
  const mode = { configured: true, connected: false, connectionStatus: 'warning', connectionReason: 'model_missing' }
  assert.equal(isImageModeSelectable(mode), false)
})

test('配置不完整的自动发现槽位不可选择', () => {
  const mode = { configured: false, connectionStatus: 'not_configured' }
  assert.equal(imageModeConnection(mode).label, '配置不完整')
  assert.equal(isImageModeSelectable(mode), false)
})

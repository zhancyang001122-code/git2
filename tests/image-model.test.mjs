import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveImageLabel, resolveImageModel } from '../supabase/functions/_shared/image-model.js'
import { currentPrimaryImageModel } from '../src/data.js'

test('first image API migrates only the retired built-in model override', () => {
  assert.equal(resolveImageModel(1, 'gpt-image-2', 'gpt-image-2.5-flare'), 'gpt-image-2.5-flare')
  assert.equal(resolveImageModel(1, 'gpt-image2.5', 'gpt-image-2.5-flare'), 'gpt-image-2.5-flare')
  assert.equal(resolveImageModel(1, '', 'gpt-image-2.5-flare'), 'gpt-image-2.5-flare')
  assert.equal(resolveImageModel(1, 'custom-image-v3', 'gpt-image-2.5-flare'), 'custom-image-v3')
  assert.equal(resolveImageModel(2, 'gpt-image-2', 'gemini-3-pro-image-preview'), 'gpt-image-2')
  assert.equal(resolveImageModel(3, 'gpt-image-2', 'gpt-image-2'), 'gpt-image-2')
})

test('guest image API 1 upgrades stored Yunfei defaults without changing a custom model', () => {
  assert.equal(currentPrimaryImageModel('gpt-image2.5'), 'gpt-image-2.5-flare')
  assert.equal(currentPrimaryImageModel('gpt-image-2'), 'gpt-image-2.5-flare')
  assert.equal(currentPrimaryImageModel('gpt-image-2.5-sunburst'), 'gpt-image-2.5-sunburst')
  assert.equal(currentPrimaryImageModel('gpt-image2.5', 'compatible'), 'gpt-image2.5')
})

test('first image API updates only the stale display label', () => {
  assert.equal(resolveImageLabel(1, 'GPT Image 2', '第三方生图服务'), 'GPT Image 2.5')
  assert.equal(resolveImageLabel(1, 'Custom render', '第三方生图服务'), 'Custom render')
  assert.equal(resolveImageLabel(2, 'GPT Image 2', 'Git2 图 Gemini'), 'GPT Image 2')
})

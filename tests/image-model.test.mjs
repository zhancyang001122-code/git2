import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveImageModel } from '../supabase/functions/_shared/image-model.js'

test('first image API migrates only the retired built-in model override', () => {
  assert.equal(resolveImageModel(1, 'gpt-image-2', 'gpt-image2.5'), 'gpt-image2.5')
  assert.equal(resolveImageModel(1, '', 'gpt-image2.5'), 'gpt-image2.5')
  assert.equal(resolveImageModel(1, 'custom-image-v3', 'gpt-image2.5'), 'custom-image-v3')
  assert.equal(resolveImageModel(2, 'gpt-image-2', 'gemini-3-pro-image-preview'), 'gpt-image-2')
})

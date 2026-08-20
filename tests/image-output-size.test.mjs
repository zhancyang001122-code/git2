import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fitOriginalImageTo4K,
  originalImageOutputSize,
} from '../src/lib/image-output-size.js'

test('横图按原比例放大到 4K 长边', () => {
  assert.deepEqual(fitOriginalImageTo4K(1600, 900), {
    width: 3840,
    height: 2160,
    size: '3840x2160',
  })
})

test('非标准比例和竖图均保持原始比例', () => {
  assert.equal(fitOriginalImageTo4K(1200, 1000).size, '3840x3200')
  assert.equal(fitOriginalImageTo4K(900, 1600).size, '2160x3840')
})

test('生成前从参考图读取尺寸', async () => {
  const file = { name: 'reference.png' }
  const size = await originalImageOutputSize(file, async (received) => {
    assert.equal(received, file)
    return { width: 2048, height: 1536 }
  })
  assert.equal(size, '3840x2880')
})

test('无效尺寸和极端比例返回可操作提示', () => {
  assert.throws(() => fitOriginalImageTo4K(0, 100), /无法读取原图尺寸/)
  assert.throws(() => fitOriginalImageTo4K(10000, 100), /比例过于狭长/)
})

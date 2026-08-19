import assert from 'node:assert/strict'
import test from 'node:test'
import { formatElapsedTime } from '../src/lib/time.js'

test('等待时间以 mm:ss 显示，并在超过一小时后显示 hh:mm:ss', () => {
  assert.equal(formatElapsedTime(0), '00:00')
  assert.equal(formatElapsedTime(9), '00:09')
  assert.equal(formatElapsedTime(65), '01:05')
  assert.equal(formatElapsedTime(3661), '01:01:01')
})

test('等待时间会安全处理小数、负数和无效输入', () => {
  assert.equal(formatElapsedTime(1.9), '00:01')
  assert.equal(formatElapsedTime(-4), '00:00')
  assert.equal(formatElapsedTime('invalid'), '00:00')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { imageTaskPollDelay, waitForImageTask } from '../src/lib/async-image-task.js'

test('异步 4K 生图按服务端间隔轮询直到完成', async () => {
  const delays = []
  const states = [
    { pending: true, taskId: 'task-1', taskToken: 'signed', pollAfterMs: 1800 },
    { pending: false, images: [{ imageUrl: 'data:image/png;base64,done' }] },
  ]
  const result = await waitForImageTask(
    { pending: true, taskId: 'task-1', taskToken: 'signed', pollAfterMs: 2000 },
    async () => states.shift(),
    { sleep: async (delay) => delays.push(delay) },
  )

  assert.deepEqual(delays, [2000, 1800])
  assert.equal(result.images[0].imageUrl, 'data:image/png;base64,done')
})

test('异步生图轮询间隔限制在 1 到 5 秒', () => {
  assert.equal(imageTaskPollDelay(10), 1000)
  assert.equal(imageTaskPollDelay(9000), 5000)
  assert.equal(imageTaskPollDelay('invalid'), 2000)
})

test('异步生图缺少签名时立即停止', async () => {
  await assert.rejects(
    waitForImageTask({ pending: true, taskId: 'task-1' }, async () => ({}), { sleep: async () => {} }),
    /缺少查询凭据/,
  )
})

test('异步生图超过最长等待时间时给出明确提示', async () => {
  await assert.rejects(
    waitForImageTask(
      { pending: true, taskId: 'task-1', taskToken: 'signed', pollAfterMs: 2000 },
      async (task) => task,
      { sleep: async () => {}, maxWaitMs: 3000 },
    ),
    /超过 12 分钟/,
  )
})

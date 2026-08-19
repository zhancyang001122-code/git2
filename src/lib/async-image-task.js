const DEFAULT_MAX_WAIT_MS = 12 * 60 * 1000
const DEFAULT_MAX_POLLS = 360

export function imageTaskPollDelay(value) {
  const delay = Number(value)
  if (!Number.isFinite(delay)) return 2000
  return Math.max(1000, Math.min(5000, Math.round(delay)))
}

export async function waitForImageTask(initialResult, poll, options = {}) {
  const sleep = options.sleep || ((delay) => new Promise((resolve) => window.setTimeout(resolve, delay)))
  const maxWaitMs = options.maxWaitMs || DEFAULT_MAX_WAIT_MS
  const maxPolls = options.maxPolls || DEFAULT_MAX_POLLS
  let result = initialResult
  let elapsedWaitMs = 0

  for (let attempt = 0; result?.pending && attempt < maxPolls; attempt += 1) {
    if (!result.taskId || !result.taskToken) {
      throw new Error('4K 生图任务缺少查询凭据，请重新生成。')
    }
    const delay = imageTaskPollDelay(result.pollAfterMs)
    if (elapsedWaitMs + delay > maxWaitMs) {
      throw new Error('4K 生图等待超过 12 分钟，请稍后重新生成。')
    }
    await sleep(delay)
    elapsedWaitMs += delay
    result = await poll(result)
  }

  if (result?.pending) throw new Error('4K 生图任务长时间未完成，请稍后重新生成。')
  return result
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { loadWorkspaceAndCapabilities } from '../src/lib/workspace-loader.js'

test('keeps the workspace available when model capabilities fail', async () => {
  const workspace = { assets: [{ id: 1 }], memos: [{ id: 2 }] }
  const failure = new Error('model endpoint unavailable')
  const result = await loadWorkspaceAndCapabilities(
    async () => workspace,
    async () => { throw failure },
  )
  assert.equal(result.workspace, workspace)
  assert.equal(result.capabilities, null)
  assert.equal(result.capabilitiesError, failure)
})

test('still fails when the protected workspace itself cannot load', async () => {
  const failure = Object.assign(new Error('Session not found'), { code: 'session_not_found' })
  await assert.rejects(
    loadWorkspaceAndCapabilities(async () => { throw failure }, async () => ({ imageModes: [] })),
    failure,
  )
})

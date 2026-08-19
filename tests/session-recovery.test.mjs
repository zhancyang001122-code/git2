import test from 'node:test'
import assert from 'node:assert/strict'
import { isInvalidSessionError, validatedBrowserSession } from '../src/lib/session.js'

test('recognizes revoked and expired Supabase sessions', () => {
  assert.equal(isInvalidSessionError({ code: 'session_not_found', message: 'Session not found' }), true)
  assert.equal(isInvalidSessionError({ message: 'JWT expired' }), true)
  assert.equal(isInvalidSessionError({ message: 'Failed to fetch' }), false)
})

test('validates a cached browser session against the Auth server', async () => {
  const session = { access_token: 'valid-token' }
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async (token) => ({ data: { user: { id: token } }, error: null }),
    signOut: async () => assert.fail('valid session must not be cleared'),
  }
  assert.equal(await validatedBrowserSession(auth), session)
})

test('clears a cached session that no longer exists on the server', async () => {
  const signOutCalls = []
  const auth = {
    getSession: async () => ({ data: { session: { access_token: 'revoked-token' } }, error: null }),
    getUser: async () => ({ data: { user: null }, error: { code: 'session_not_found', status: 403, message: 'Session not found' } }),
    signOut: async (options) => { signOutCalls.push(options); return { error: null } },
  }
  assert.equal(await validatedBrowserSession(auth), null)
  assert.deepEqual(signOutCalls, [{ scope: 'local' }])
})

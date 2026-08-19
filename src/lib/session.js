const invalidSessionCodes = new Set([
  'session_not_found',
  'refresh_token_not_found',
  'refresh_token_already_used',
])

export function isInvalidSessionError(error) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || error || '').toLowerCase()
  return invalidSessionCodes.has(code)
    || /session not found|auth session missing|refresh token.*(?:not found|already used)|jwt.*(?:expired|invalid)|invalid jwt/.test(message)
}

async function clearLocalSession(auth) {
  try {
    await auth.signOut({ scope: 'local' })
  } catch {
    // auth-js still removes invalid 401/403 sessions locally. A transport
    // failure is non-fatal here because the caller will treat the session as
    // signed out and the next successful auth event will replace it.
  }
}

export async function validatedBrowserSession(auth) {
  const { data, error } = await auth.getSession()
  if (error) {
    if (isInvalidSessionError(error)) {
      await clearLocalSession(auth)
      return null
    }
    throw error
  }

  const session = data?.session || null
  if (!session) return null

  const { data: userData, error: userError } = await auth.getUser(session.access_token)
  if (userError || !userData?.user) {
    if (!userError || isInvalidSessionError(userError) || userError.status === 401 || userError.status === 403) {
      await clearLocalSession(auth)
      return null
    }
    throw userError
  }

  return session
}

export async function clearInvalidBrowserSession(auth) {
  await clearLocalSession(auth)
}

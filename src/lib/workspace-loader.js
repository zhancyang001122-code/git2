export async function loadWorkspaceAndCapabilities(loadWorkspace, loadCapabilities) {
  const [workspaceResult, capabilitiesResult] = await Promise.allSettled([
    loadWorkspace(),
    loadCapabilities(),
  ])

  if (workspaceResult.status === 'rejected') throw workspaceResult.reason

  return {
    workspace: workspaceResult.value,
    capabilities: capabilitiesResult.status === 'fulfilled' ? capabilitiesResult.value : null,
    capabilitiesError: capabilitiesResult.status === 'rejected' ? capabilitiesResult.reason : null,
  }
}

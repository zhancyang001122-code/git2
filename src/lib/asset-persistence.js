export function isRemoteAssetUrl(value) {
  return /^https:\/\//i.test(String(value || ''))
}

export async function storeAssetArtifact({ artifact, packageId, baseName }, adapters) {
  if (isRemoteAssetUrl(artifact.imageUrl)) {
    return adapters.persistRemote({ artifact, packageId, storedName: baseName })
  }

  const sourceBlob = await adapters.imageUrlToBlob(artifact.imageUrl)
  const blob = await adapters.prepareImageForStorage(sourceBlob)
  const storedName = adapters.storedImageName(baseName, blob.type)
  const storagePath = `${adapters.userId}/${packageId}/${storedName}`
  await adapters.uploadBlob(storagePath, blob)
  return { fileName: storedName, storagePath }
}

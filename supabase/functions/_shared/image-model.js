export function resolveImageModel(slotNumber, configuredModel, defaultModel) {
  // The former built-in model may still be pinned in the production override.
  // Migrate only that exact first-slot ID; preserve every other custom model.
  if (slotNumber === 1 && ['gpt-image-2', 'gpt-image2.5'].includes(configuredModel)) return defaultModel
  return configuredModel || defaultModel
}

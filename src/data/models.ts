export const MODELS = [
  { value: 'dall-e-3', label: 'OpenAI DALL·E 3', cost: 0.04 },
  { value: 'grok-vision', label: 'Grok Vision v1.5', cost: 0.03 },
  { value: 'midjourney-v6', label: 'Midjourney V6 (Proxy)', cost: 0.05 },
  { value: 'sdxl', label: 'Stable Diffusion XL', cost: 0.01 },
] as const;

export type ModelValue = (typeof MODELS)[number]['value'];

export function matchModelValue(labelOrValue: string): ModelValue {
  const byValue = MODELS.find((m) => m.value === labelOrValue);
  if (byValue) return byValue.value;
  const byLabel = MODELS.find((m) => m.label === labelOrValue);
  if (byLabel) return byLabel.value;
  // fuzzy: label contains
  const fuzzy = MODELS.find(
    (m) =>
      labelOrValue.toLowerCase().includes(m.value) ||
      m.label.toLowerCase().includes(labelOrValue.toLowerCase()),
  );
  return fuzzy?.value ?? MODELS[0].value;
}

export function formRatioFromAsset(
  ratio: string,
): string {
  return ratio.replace('/', ':');
}

export function assetRatioFromForm(
  ratio: string,
): string {
  return ratio.replace(':', '/');
}

export type OutputSpec = {
  value: 'standard' | 'high';
  label: string;
  detail: string;
};

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '7:4' | '4:7';

export type AspectRatioOption = { value: AspectRatio; label: string };

const COMMON_IMAGE_RATIOS: AspectRatioOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

const RATIO_VALUES: Record<AspectRatio, number> = {
  '1:1': 1,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '2:3': 2 / 3,
  '7:4': 7 / 4,
  '4:7': 4 / 7,
};

export type ReferenceMode = 'image-reference' | 'image-to-video' | 'video-edit';

export type ReferenceLimitKind = 'hard' | 'recommended' | 'project' | 'unsupported';

/** Only expose deterministic seeds for model families whose API accepts them. */
export function seedSupported(modelId: string | undefined, type: 'image' | 'video'): boolean {
  return type === 'image' && /(?:stable[-\s]?diffusion|\bsdxl\b|\bsd3\b|\bflux\b|comfy)/i.test(modelId ?? '');
}

export type ReferenceCapability = {
  imageLimit: number;
  videoLimit: number;
  /** Explains whether a displayed image limit is provider-enforced, guidance, or an app guardrail. */
  imageLimitKind: ReferenceLimitKind;
  videoLimitKind: ReferenceLimitKind;
  videoModes?: ReferenceMode[];
};

export function isGeminiImageModel(modelId: string | undefined): boolean {
  return /gemini|nano\s*banana|imagen/i.test(modelId ?? '');
}

export function isGrokImagineImageModel(modelId: string | undefined): boolean {
  const id = modelId?.toLowerCase() ?? '';
  return id.includes('grok-imagine') && !id.includes('video');
}

export function isGptImageModel(modelId: string | undefined): boolean {
  return (modelId?.toLowerCase() ?? '').startsWith('gpt-image');
}

export function isDallEImageModel(modelId: string | undefined): boolean {
  return /(?:^|[-_/])dall-e(?:[-_/]|$)/i.test(modelId ?? '');
}

/** Model-aware ratios: never label a provider's nearest size as a different ratio. */
export function aspectRatioOptions(
  modelId: string | undefined,
  type: 'image' | 'video',
): AspectRatioOption[] {
  if (type === 'image' && isGptImageModel(modelId)) {
    return [
      { value: '1:1', label: '1:1' },
      { value: '3:2', label: '3:2' },
      { value: '2:3', label: '2:3' },
    ];
  }
  if (type === 'image' && isDallEImageModel(modelId)) {
    return [
      { value: '1:1', label: '1:1' },
      { value: '7:4', label: '7:4' },
      { value: '4:7', label: '4:7' },
    ];
  }
  if (type === 'video' && (isGeminiVideoModel(modelId) || /grok-imagine-video/i.test(modelId ?? ''))) {
    return [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
    ];
  }
  return COMMON_IMAGE_RATIOS;
}

export function isAspectRatio(value: string): value is AspectRatio {
  return value in RATIO_VALUES;
}

export function aspectRatioFromDimensions(width: number, height: number): AspectRatio | string {
  if (!width || !height) return `${width}:${height}`;
  const measured = width / height;
  const closest = (Object.keys(RATIO_VALUES) as AspectRatio[])
    .map((value) => ({ value, distance: Math.abs(Math.log(measured / RATIO_VALUES[value])) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return closest && closest.distance < 0.02 ? closest.value : `${width}:${height}`;
}

export function genericImageSizeForRatio(ratio: string | undefined): string {
  switch (ratio) {
    case '9:16': return '1024x1536';
    case '4:3': return '1024x768';
    case '3:4': return '768x1024';
    case '3:2': return '1536x1024';
    case '2:3': return '1024x1536';
    case '7:4': return '1792x1024';
    case '4:7': return '1024x1792';
    case '1:1': return '1024x1024';
    default: return '1536x1024';
  }
}

export function isGeminiVideoModel(modelId: string | undefined): boolean {
  return /veo|gemini.*video|omni.*video/i.test(modelId ?? '');
}

export function videoDurationOptions(modelId: string | undefined): number[] | null {
  return isGeminiVideoModel(modelId) ? [4, 6, 8] : null;
}

export function outputSpecs(modelId: string | undefined, type: 'image' | 'video'): OutputSpec[] {
  const id = modelId?.toLowerCase() ?? '';
  if (type === 'video' && id.includes('grok-imagine-video')) {
    return [
      { value: 'standard', label: '标准 · 480p', detail: '480p' },
      { value: 'high', label: '高清 · 720p', detail: '720p' },
    ];
  }
  if (type === 'image' && isGrokImagineImageModel(modelId)) {
    return [
      { value: 'standard', label: '标准 · 1K', detail: '1K' },
      { value: 'high', label: '高清 · 2K', detail: '2K' },
    ];
  }
  if (type === 'image' && isGptImageModel(modelId)) {
    return [
      { value: 'standard', label: '标准 · Low', detail: 'low' },
      { value: 'high', label: '高清 · High', detail: 'high' },
    ];
  }
  if (type === 'image' && isGeminiImageModel(modelId)) {
    return [
      { value: 'standard', label: '标准 · 1K', detail: '1K' },
      { value: 'high', label: '高清 · 2K', detail: '2K' },
    ];
  }
  if (type === 'video' && isGeminiVideoModel(modelId)) {
    return [
      { value: 'standard', label: '标准 · 720p', detail: '720p' },
      { value: 'high', label: '高清 · 1080p', detail: '1080p' },
    ];
  }
  return [{ value: 'standard', label: '默认规格', detail: 'provider default' }];
}

/**
 * Resolve the input mode implied by the canvas references.
 * A first-frame image and a reference-image set are mutually exclusive for the
 * providers that support both, so first-frame takes precedence.
 */
export function referenceModeForInputs(
  type: 'image' | 'video',
  inputs: Array<{ kind: 'image' | 'video'; firstFrame?: boolean }>,
): ReferenceMode {
  if (type === 'image') return 'image-reference';
  if (inputs.some((input) => input.kind === 'video')) return 'video-edit';
  if (inputs.some((input) => input.firstFrame)) return 'image-to-video';
  return 'image-reference';
}

const unsupported = (): ReferenceCapability => ({
  imageLimit: 0,
  videoLimit: 0,
  imageLimitKind: 'unsupported',
  videoLimitKind: 'unsupported',
});

/**
 * Only expose reference inputs backed by an explicit provider capability.
 * `mode` matters for video: reference-image, first-frame and video-edit are
 * different API paths with different limits.
 */
export function referenceCapabilities(
  modelId: string | undefined,
  type: 'image' | 'video',
  mode: ReferenceMode = 'image-reference',
): ReferenceCapability {
  const id = modelId?.toLowerCase() ?? '';
  if (type === 'image' && isGptImageModel(modelId)) {
    // The API documents multiple inputs but no hard maximum. Keep a deliberate
    // project guardrail rather than presenting four as an OpenAI model limit.
    return { imageLimit: 4, videoLimit: 0, imageLimitKind: 'project', videoLimitKind: 'unsupported' };
  }
  if (type === 'image' && isGrokImagineImageModel(modelId)) {
    return { imageLimit: 3, videoLimit: 0, imageLimitKind: 'hard', videoLimitKind: 'unsupported' };
  }
  if (
    type === 'image' &&
    (/gemini-2\.5-flash-image/i.test(id) || /nano\s*banana(?!\s*(?:2|pro))/i.test(id))
  ) {
    // Gemini 2.5 Flash Image works best with up to three input images.
    return { imageLimit: 3, videoLimit: 0, imageLimitKind: 'recommended', videoLimitKind: 'unsupported' };
  }
  if (
    type === 'image' &&
    (/(?:gemini-(?:3|3\.1).*(?:flash|pro).*image)/i.test(id) || /nano\s*banana\s*(?:2|pro)/i.test(id))
  ) {
    // Gemini 3 image models support up to fourteen references in total.
    return { imageLimit: 14, videoLimit: 0, imageLimitKind: 'hard', videoLimitKind: 'unsupported' };
  }
  if (type === 'video' && id.includes('grok-imagine-video')) {
    const supportsReferenceToVideo = !id.includes('video-1.5');
    if (mode === 'image-reference') {
      return {
        imageLimit: supportsReferenceToVideo ? 7 : 0,
        videoLimit: 0,
        imageLimitKind: supportsReferenceToVideo ? 'hard' : 'unsupported',
        videoLimitKind: 'unsupported',
        videoModes: supportsReferenceToVideo
          ? ['image-reference', 'image-to-video', 'video-edit']
          : ['image-to-video', 'video-edit'],
      };
    }
    if (mode === 'image-to-video') {
      return {
        imageLimit: 1,
        videoLimit: 0,
        imageLimitKind: 'hard',
        videoLimitKind: 'unsupported',
        videoModes: supportsReferenceToVideo
          ? ['image-reference', 'image-to-video', 'video-edit']
          : ['image-to-video', 'video-edit'],
      };
    }
    return {
      imageLimit: 0,
      videoLimit: 1,
      imageLimitKind: 'unsupported',
      videoLimitKind: 'hard',
      videoModes: supportsReferenceToVideo
        ? ['image-reference', 'image-to-video', 'video-edit']
        : ['image-to-video', 'video-edit'],
    };
  }
  if (type === 'video' && isGeminiVideoModel(modelId)) {
    const supportsReferenceImages = id.includes('veo-3.1') && !id.includes('lite');
    if (mode === 'image-reference') {
      return {
        imageLimit: supportsReferenceImages ? 3 : 0,
        videoLimit: 0,
        imageLimitKind: supportsReferenceImages ? 'hard' : 'unsupported',
        videoLimitKind: 'unsupported',
        videoModes: ['image-reference', 'image-to-video'],
      };
    }
    if (mode === 'image-to-video') {
      return {
        imageLimit: 1,
        videoLimit: 0,
        imageLimitKind: 'hard',
        videoLimitKind: 'unsupported',
        videoModes: ['image-reference', 'image-to-video'],
      };
    }
    return {
      imageLimit: 0,
      videoLimit: 0,
      imageLimitKind: 'unsupported',
      videoLimitKind: 'unsupported',
      videoModes: ['image-reference', 'image-to-video'],
    };
  }
  return unsupported();
}

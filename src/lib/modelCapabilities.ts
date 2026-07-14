export type OutputSpec = {
  value: 'standard' | 'high';
  label: string;
  detail: string;
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
  if (type === 'image' && id.includes('grok-imagine-image')) {
    return [
      { value: 'standard', label: '标准 · 1K', detail: '1K' },
      { value: 'high', label: '高清 · 2K', detail: '2K' },
    ];
  }
  if (type === 'image' && id.startsWith('gpt-image')) {
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
  if (type === 'image' && id.startsWith('gpt-image')) {
    // The API documents multiple inputs but no hard maximum. Keep a deliberate
    // project guardrail rather than presenting four as an OpenAI model limit.
    return { imageLimit: 4, videoLimit: 0, imageLimitKind: 'project', videoLimitKind: 'unsupported' };
  }
  if (type === 'image' && id.includes('grok-imagine-image')) {
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

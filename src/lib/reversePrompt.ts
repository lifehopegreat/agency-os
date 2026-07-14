import type { Locale } from '../i18n/locales';
import type { ReverseApiConfig } from '../state/PreferencesContext';
import type { Provider } from '../state/ProvidersContext';

export type ReverseMode = 'local' | 'reverse_api' | 'provider_model';

export type ReverseRequest = {
  file: File;
  /** A preference for what to emphasize; it is never copied into the result. */
  hint?: string;
  locale: Locale;
  reverseAiAssist: boolean;
  reverseApi: ReverseApiConfig;
  reverseApiConfigured: boolean;
  providers: Provider[];
  /** Exact `${provider.id}::${model.id}` selected in Settings. */
  reverseProviderModelKey: string;
};

export type ReverseResult = {
  prompt: string;
  mode: ReverseMode;
  sourceLabel: string;
  tags: string[];
  warnings: string[];
};

type ReverseFocus = 'style' | 'composition' | 'lighting' | 'color' | 'subject' | 'detail';

type ImageMeta = {
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  saturation: number;
  avg: { r: number; g: number; b: number };
};

async function sampleImageMeta(file: File): Promise<ImageMeta> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image load failed'));
      element.src = url;
    });
    const width = image.naturalWidth || 1;
    const height = image.naturalHeight || 1;
    const sampleWidth = Math.min(64, width);
    const sampleHeight = Math.min(64, height);
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return { width, height, brightness: 0.5, contrast: 0.35, saturation: 0.35, avg: { r: 128, g: 128, b: 128 } };
    }
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let luminance = 0;
    let luminanceSquared = 0;
    let saturation = 0;
    const count = sampleWidth * sampleHeight;
    for (let i = 0; i < pixels.length; i += 4) {
      const pr = pixels[i];
      const pg = pixels[i + 1];
      const pb = pixels[i + 2];
      const light = (pr * 0.299 + pg * 0.587 + pb * 0.114) / 255;
      r += pr;
      g += pg;
      b += pb;
      luminance += light;
      luminanceSquared += light * light;
      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      saturation += max === 0 ? 0 : (max - min) / max;
    }
    const brightness = luminance / count;
    return {
      width,
      height,
      brightness,
      contrast: Math.sqrt(Math.max(0, luminanceSquared / count - brightness * brightness)),
      saturation: saturation / count,
      avg: { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resolveFocus(hint: string): ReverseFocus[] {
  const value = hint.toLowerCase();
  const areas = new Set<ReverseFocus>();
  if (/(构图|画面|镜头|视角|景别|composition|frame|camera|angle|shot)/.test(value)) areas.add('composition');
  if (/(光|夜景|明暗|lighting|light|shadow|exposure)/.test(value)) areas.add('lighting');
  if (/(色|配色|palette|colour|color)/.test(value)) areas.add('color');
  if (/(风格|画风|二次元|写实|style|anime|realistic|渲染)/.test(value)) areas.add('style');
  if (/(主体|人物|角色|表情|脸|subject|character|face)/.test(value)) areas.add('subject');
  if (/(服装|衣|饰品|材质|纹理|细节|clothing|outfit|material|detail)/.test(value)) areas.add('detail');
  return [...areas];
}

function visualTerms(meta: ImageMeta, locale: Locale) {
  const zh = locale === 'zh';
  const ratio = meta.width / meta.height;
  const composition = ratio > 1.4
    ? (zh ? '横向宽幅构图' : 'wide landscape composition')
    : ratio < 0.75
      ? (zh ? '竖向人物构图' : 'tall portrait composition')
      : (zh ? '平衡的近方形构图' : 'balanced near-square composition');
  const light = meta.brightness < 0.3
    ? (zh ? '低调暗部光影' : 'low-key shadowy lighting')
    : meta.brightness > 0.72
      ? (zh ? '通透的高调光线' : 'bright high-key lighting')
      : (zh ? '柔和均衡的曝光' : 'soft balanced exposure');
  const contrast = meta.contrast > 0.25
    ? (zh ? '清晰的明暗层次' : 'defined tonal separation')
    : (zh ? '柔和的明暗过渡' : 'soft tonal transitions');
  const { r, g, b } = meta.avg;
  const color = Math.max(r, g, b) - Math.min(r, g, b) < 28
    ? (zh ? '中性色调' : 'neutral color palette')
    : r >= g && r >= b
      ? (zh ? '暖色主调' : 'warm color palette')
      : b >= r && b >= g
        ? (zh ? '冷色主调' : 'cool color palette')
        : (zh ? '青绿色主调' : 'teal-green color palette');
  const style = meta.saturation > 0.62
    ? (zh ? '鲜明而干净的画面风格' : 'crisp, vivid visual style')
    : meta.saturation < 0.28
      ? (zh ? '克制的低饱和画面风格' : 'restrained low-saturation visual style')
      : (zh ? '自然协调的画面风格' : 'natural, cohesive visual style');
  return { composition, light, contrast, color, style };
}

/**
 * Offline fallback only derives visible visual properties. It intentionally does
 * not invent a subject, or leak filenames, dimensions, MIME types, or user notes.
 */
export async function reverseLocal(file: File, focus: ReverseFocus[], locale: Locale): Promise<Omit<ReverseResult, 'mode' | 'sourceLabel'>> {
  const terms = visualTerms(await sampleImageMeta(file), locale);
  const visualLayers: Array<{ areas: ReverseFocus[]; text: string }> = [
    { areas: ['composition'], text: terms.composition },
    { areas: ['lighting', 'style'], text: `${terms.light}，${terms.contrast}` },
    { areas: ['color', 'style'], text: terms.color },
    { areas: ['style'], text: terms.style },
  ];
  const clauses = focus.length
    ? [...visualLayers.filter((layer) => layer.areas.some((area) => focus.includes(area))), ...visualLayers.filter((layer) => !layer.areas.some((area) => focus.includes(area)))].map((layer) => layer.text)
    : visualLayers.map((layer) => layer.text);
  const zh = locale === 'zh';
  const prompt = zh
    ? `${clauses.join('，')}，主体清晰，层次自然，干净画面，无文字，无水印。`
    : `${clauses.join(', ')}, clear subject, natural depth, clean frame, no text, no watermark.`;
  return { prompt, tags: clauses, warnings: [] };
}

type EndpointResolved = {
  mode: ReverseMode;
  sourceLabel: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

function selectedProviderModel(req: ReverseRequest): { provider: Provider; model: Provider['models'][number] } | null {
  if (!req.reverseProviderModelKey) return null;
  for (const provider of req.providers) {
    if (provider.status !== 'connected' || !provider.baseUrl.trim()) continue;
    for (const model of provider.models) {
      if (`${provider.id}::${model.id}` !== req.reverseProviderModelKey) continue;
      // Models explicitly labelled as generation-only must not be sent to chat/vision endpoints.
      if (model.kind === 'image' || model.kind === 'video') return null;
      return { provider, model };
    }
  }
  return null;
}

function resolveEndpoint(req: ReverseRequest): EndpointResolved | null {
  if (!req.reverseAiAssist) return null;
  const selected = selectedProviderModel(req);
  if (selected) {
    return {
      mode: 'provider_model',
      sourceLabel: `${selected.provider.name} / ${selected.model.label}`,
      baseUrl: selected.provider.baseUrl.replace(/\/$/, ''),
      apiKey: selected.provider.apiKey,
      model: selected.model.id,
    };
  }
  if (req.reverseApiConfigured) {
    return {
      mode: 'reverse_api',
      sourceLabel: 'reverse-api',
      baseUrl: req.reverseApi.baseUrl.replace(/\/$/, ''),
      apiKey: req.reverseApi.apiKey,
      model: req.reverseApi.model.trim(),
    };
  }
  return null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function reverseViaGateway(opts: EndpointResolved & { dataUrl: string; focus: ReverseFocus[]; locale: Locale }): Promise<string> {
  const response = await fetch('/api/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await response.json().catch(() => ({})) as { prompt?: string; error?: string };
  if (!response.ok || !data.prompt) throw new Error(data.error || `HTTP ${response.status}`);
  return data.prompt;
}

export async function reverseImageToPrompt(req: ReverseRequest): Promise<ReverseResult> {
  const focus = resolveFocus(req.hint?.trim() ?? '');
  if (!req.reverseAiAssist) {
    return {
      ...(await reverseLocal(req.file, focus, req.locale)),
      mode: 'local',
      sourceLabel: req.locale === 'zh' ? '本地视觉规则' : 'Local visual rules',
    };
  }
  const endpoint = resolveEndpoint(req);
  if (!endpoint) {
    return {
      ...(await reverseLocal(req.file, focus, req.locale)),
      mode: 'local',
      sourceLabel: req.locale === 'zh' ? '本地视觉规则（回退）' : 'Local visual rules (fallback)',
      warnings: [req.locale === 'zh' ? '未找到可用的 AI 服务，已回退本地视觉规则。' : 'No AI service is available; used local visual rules.'],
    };
  }
  try {
    const prompt = await reverseViaGateway({ ...endpoint, dataUrl: await fileToDataUrl(req.file), focus, locale: req.locale });
    return { prompt, mode: endpoint.mode, sourceLabel: endpoint.sourceLabel, tags: [endpoint.model], warnings: [] };
  } catch (error) {
    return {
      ...(await reverseLocal(req.file, focus, req.locale)),
      mode: 'local',
      sourceLabel: req.locale === 'zh' ? '本地视觉规则（API 回退）' : 'Local visual rules (API fallback)',
      warnings: [req.locale === 'zh' ? `AI 反推失败（${error instanceof Error ? error.message : String(error)}），已回退本地视觉规则。` : `AI reverse failed; used local visual rules.`],
    };
  }
}

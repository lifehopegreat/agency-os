import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  genericImageSizeForRatio,
  isGptImageModel,
  isGrokImagineImageModel,
  referenceCapabilities,
  seedSupported,
} from './src/lib/modelCapabilities.js';

type GenerateRequest = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  prompt?: string;
  type?: 'image' | 'video';
  ratio?: string;
  quality?: string;
  duration?: number;
  seed?: string;
  references?: Array<{ kind?: 'image' | 'video'; url?: string }>;
  referenceMode?: 'image-reference' | 'image-to-video' | 'video-edit';
};

type ReverseGatewayRequest = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dataUrl?: string;
  focus?: Array<'style' | 'composition' | 'lighting' | 'color' | 'subject' | 'detail'>;
  locale?: 'zh' | 'en';
};

async function referenceBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(url);
    if (!match) throw new Error('Invalid reference image data.');
    const bytes = url.includes(';base64,')
      ? Buffer.from(match[2], 'base64')
      : Buffer.from(decodeURIComponent(match[2]));
    return new Blob([bytes], { type: match[1] || 'image/png' });
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to retrieve reference image (${response.status}).`);
  return new Blob([await response.arrayBuffer()], {
    type: response.headers.get('content-type') || 'image/png',
  });
}

function isGeminiImageModel(model: string | undefined): boolean {
  return /gemini|nano\s*banana|imagen/i.test(model ?? '');
}

function isGeminiVideoModel(model: string | undefined): boolean {
  return /veo|gemini.*video|omni.*video/i.test(model ?? '');
}

function isNativeGeminiApi(baseUrl: URL): boolean {
  return baseUrl.hostname === 'generativelanguage.googleapis.com';
}

function normalizeProviderBaseUrl(baseUrl: URL): URL {
  if (isNativeGeminiApi(baseUrl) || (baseUrl.pathname !== '/' && baseUrl.pathname !== '')) return baseUrl;
  const normalized = new URL(baseUrl.href);
  normalized.pathname = '/v1';
  return normalized;
}

async function readUpstreamJson<T>(response: Response, operation: string): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const contentType = response.headers.get('content-type') ?? '';
    const format = contentType.includes('text/html') ? 'HTML error page' : 'non-JSON response';
    throw new Error(`${operation} returned ${response.status} ${response.statusText} (${format}).`);
  }
}

function extensionForMime(mime: string, fallback: 'png' | 'mp4'): string {
  const subtype = mime.split('/')[1]?.split(';')[0]?.toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  if (subtype && /^[a-z0-9]+$/.test(subtype)) return subtype;
  return fallback;
}

function numericSeed(seed: string | undefined): number | undefined {
  if (!seed || !/^\d+$/.test(seed)) return undefined;
  const value = Number(seed);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

async function saveGeneratedMedia(base64: string, mime: string, fallback: 'png' | 'mp4') {
  const filename = `${randomUUID()}.${extensionForMime(mime, fallback)}`;
  const outputDir = resolve(process.cwd(), 'public', 'generated');
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, filename), Buffer.from(base64, 'base64'));
  return `/generated/${filename}`;
}

async function asGeminiInlineData(url: string) {
  const blob = await referenceBlob(url);
  return {
    mimeType: blob.type || 'image/png',
    data: Buffer.from(await blob.arrayBuffer()).toString('base64'),
  };
}

function geminiImageData(data: unknown): { data: string; mimeType: string } | null {
  const payload = data as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }> } }>;
  };
  for (const part of payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? []) {
    if (part.inlineData?.data) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType ?? 'image/png' };
    if (part.inline_data?.data) return { data: part.inline_data.data, mimeType: part.inline_data.mime_type ?? 'image/png' };
  }
  return null;
}

function reversePromptFromOpenAI(data: {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}): string {
  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string'
    ? content.trim()
    : Array.isArray(content)
      ? content.map((part) => part.text ?? '').join('').trim()
      : '';
}

function reversePromptFromGemini(data: unknown): string {
  const payload = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim() ?? '';
}

async function reverseNativeGemini(
  input: ReverseGatewayRequest,
  baseUrl: URL,
  system: string,
  priority: string,
): Promise<string> {
  const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/models/${encodeURIComponent(input.model ?? '')}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': input.apiKey ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{
        role: 'user',
        parts: [
          { text: priority },
          { inlineData: await asGeminiInlineData(input.dataUrl ?? '') },
        ],
      }],
    }),
  });
  const data = await readUpstreamJson<{ error?: { message?: string } }>(upstream, 'Gemini reverse request');
  if (!upstream.ok) throw new Error(data.error?.message || `Gemini reverse request failed (${upstream.status}).`);
  const prompt = reversePromptFromGemini(data);
  if (!prompt) throw new Error('Gemini reverse model returned no prompt.');
  return prompt;
}

async function generateNativeGeminiImage(input: GenerateRequest, baseUrl: URL, references: Array<{ kind: 'image' | 'video'; url: string }>) {
  const imageReferences = references.filter((reference) => reference.kind === 'image');
  if (references.length !== imageReferences.length) throw new Error('Gemini image generation accepts image references only.');
  const caps = referenceCapabilities(input.model, 'image');
  if (imageReferences.length > caps.imageLimit) {
    throw new Error(caps.imageLimit
      ? `This model accepts up to ${caps.imageLimit} image references in the selected mode.`
      : 'This Gemini image model does not support reference images.');
  }
  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  for (const reference of imageReferences) parts.push({ inlineData: await asGeminiInlineData(reference.url) });
  const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/models/${encodeURIComponent(input.model ?? '')}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': input.apiKey ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: input.ratio ?? '16:9', imageSize: input.quality === 'high' ? '2K' : '1K' },
      },
    }),
  });
  const data = await upstream.json() as { error?: { message?: string };
  };
  if (!upstream.ok) throw new Error(data.error?.message || `Gemini image request failed (${upstream.status}).`);
  const image = geminiImageData(data);
  if (!image) throw new Error('Gemini returned no image data.');
  return saveGeneratedMedia(image.data, image.mimeType, 'png');
}

async function generateResponsesGeminiImage(input: GenerateRequest, baseUrl: URL, references: Array<{ kind: 'image' | 'video'; url: string }>) {
  const imageReferences = references.filter((reference) => reference.kind === 'image');
  if (references.length !== imageReferences.length) throw new Error('Gemini image generation accepts image references only.');
  const content: Array<Record<string, string>> = [{ type: 'input_text', text: input.prompt ?? '' }];
  for (const reference of imageReferences) content.push({ type: 'input_image', image_url: reference.url });
  const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: input.model, input: [{ role: 'user', content }] }),
  });
  const data = await readUpstreamJson<{ output?: Array<{ type?: string; result?: string; image_url?: string; url?: string }>; error?: { message?: string } }>(upstream, 'Gemini gateway request');
  if (!upstream.ok) throw new Error(data.error?.message || `Gemini gateway request failed (${upstream.status}).`);
  const image = data.output?.find((item) => item.type === 'image_generation_call');
  if (image?.result) return saveGeneratedMedia(image.result, 'image/png', 'png');
  if (image?.image_url || image?.url) return image.image_url ?? image.url as string;
  throw new Error('Gemini gateway returned no image output.');
}

async function generateNativeGeminiVideo(input: GenerateRequest, baseUrl: URL, references: Array<{ kind: 'image' | 'video'; url: string }>) {
  const imageReferences = references.filter((reference) => reference.kind === 'image');
  if (references.some((reference) => reference.kind === 'video')) throw new Error('Gemini video extension requires a previously generated Veo video and is not available for uploaded videos.');
  const mode = input.referenceMode ?? 'image-reference';
  const caps = referenceCapabilities(input.model, 'video', mode);
  if (imageReferences.length > caps.imageLimit) {
    throw new Error(caps.imageLimit
      ? `This Veo model accepts up to ${caps.imageLimit} image references in the selected mode.`
      : 'This Veo model does not support reference images in the selected mode.');
  }
  if (mode === 'image-to-video' && imageReferences.length !== 1) throw new Error('Image-to-video accepts exactly one image.');
  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (mode === 'image-to-video' && imageReferences[0]) instance.image = { inlineData: await asGeminiInlineData(imageReferences[0].url) };
  if (mode === 'image-reference' && imageReferences.length) {
    instance.referenceImages = await Promise.all(imageReferences.map(async (reference) => ({
      image: { inlineData: await asGeminiInlineData(reference.url) },
      referenceType: 'asset',
    })));
  }
  const requestedDuration = [4, 6, 8].includes(input.duration ?? 6) ? input.duration ?? 6 : 6;
  const duration = imageReferences.length ? 8 : requestedDuration;
  const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/models/${encodeURIComponent(input.model ?? '')}:predictLongRunning`, {
    method: 'POST',
    headers: { 'x-goog-api-key': input.apiKey ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [instance],
      parameters: { aspectRatio: input.ratio ?? '16:9', durationSeconds: String(duration), resolution: input.quality === 'high' ? '1080p' : '720p' },
    }),
  });
  const started = await upstream.json() as { name?: string; error?: { message?: string } };
  if (!upstream.ok || !started.name) throw new Error(started.error?.message || `Gemini video request failed (${upstream.status}).`);
  for (let attempt = 0; attempt < 72; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const statusResponse = await fetch(`${baseUrl.href.replace(/\/$/, '')}/${started.name}`, { headers: { 'x-goog-api-key': input.apiKey ?? '' } });
    const status = await statusResponse.json() as { done?: boolean; error?: { message?: string }; response?: { generatedVideos?: Array<{ video?: { uri?: string; videoBytes?: string; mimeType?: string } }>; generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string; videoBytes?: string; mimeType?: string } }> } } };
    if (!statusResponse.ok) throw new Error(status.error?.message || `Gemini video status failed (${statusResponse.status}).`);
    if (!status.done) continue;
    const video = status.response?.generatedVideos?.[0]?.video ?? status.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
    if (video?.videoBytes) return saveGeneratedMedia(video.videoBytes, video.mimeType ?? 'video/mp4', 'mp4');
    if (!video?.uri) throw new Error('Gemini returned no video data.');
    const download = await fetch(video.uri, { headers: { 'x-goog-api-key': input.apiKey ?? '' } });
    if (!download.ok) throw new Error(`Gemini video download failed (${download.status}).`);
    const buffer = Buffer.from(await download.arrayBuffer());
    return saveGeneratedMedia(buffer.toString('base64'), download.headers.get('content-type') || 'video/mp4', 'mp4');
  }
  throw new Error('Gemini video generation timed out after 6 minutes.');
}

function imageGateway(): Plugin {
  return {
    name: 'local-image-gateway',
    configureServer(server) {
      server.middlewares.use('/api/models', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        try {
          const input = JSON.parse(Buffer.concat(chunks).toString()) as GenerateRequest;
          const baseUrl = normalizeProviderBaseUrl(new URL(input.baseUrl ?? ''));
          if (baseUrl.protocol !== 'https:' || !input.apiKey) throw new Error('Missing provider configuration.');
          const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/models`, {
            headers: isNativeGeminiApi(baseUrl)
              ? { 'x-goog-api-key': input.apiKey }
              : { Authorization: `Bearer ${input.apiKey}` },
          });
          const data = await readUpstreamJson<{
            data?: Array<{ id?: string; display_name?: string; name?: string }>;
            models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>;
            error?: { message?: string };
          }>(upstream, 'Model sync request');
          if (!upstream.ok) throw new Error(data.error?.message || `Upstream request failed (${upstream.status}).`);
          const models: Array<{ id: string; label: string; kind: 'image' | 'video' | 'vision' }> = [];
          const rawModels = data.data ?? data.models?.map((model) => ({
            id: model.name?.replace(/^models\//, ''),
            display_name: model.displayName,
            name: model.name,
          })) ?? [];
          for (const model of rawModels) {
            const id = model.id ?? '';
            const label = model.display_name ?? model.name ?? id;
            if (/video|sora|veo|kling|runway|wan|hunyuan|omni.*video/i.test(id)) models.push({ id, label, kind: 'video' });
            else if (/image|dall|imagine|nano\s*banana|imagen/i.test(id)) models.push({ id, label, kind: 'image' });
            else if (/vision|vlm|gpt-(?:4o|4\.1|5)|grok-(?!imagine)|gemini-(?:2|3)|claude/i.test(id)) models.push({ id, label, kind: 'vision' });
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ models }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Model sync failed.' }));
        }
      });
      server.middlewares.use('/api/reverse', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        try {
          const input = JSON.parse(Buffer.concat(chunks).toString()) as ReverseGatewayRequest;
          const baseUrl = normalizeProviderBaseUrl(new URL(input.baseUrl ?? ''));
          if (baseUrl.protocol !== 'https:' || !input.model || !input.dataUrl) {
            throw new Error('Missing reverse model or image input.');
          }
          const zh = input.locale === 'zh';
          const focus = Array.isArray(input.focus) ? input.focus : [];
          const focusLabels = {
            style: zh ? '风格与渲染' : 'style and rendering',
            composition: zh ? '构图与镜头' : 'composition and camera',
            lighting: zh ? '光影' : 'lighting',
            color: zh ? '色彩' : 'color palette',
            subject: zh ? '主体与表情' : 'subject and expression',
            detail: zh ? '服装、材质与细节' : 'wardrobe, materials, and details',
          };
          const priority = focus.length
            ? (zh ? `优先加深：${focus.map((item) => focusLabels[item]).join('、')}。这只是权重，不要删掉主体与构图。` : `Give extra weight to: ${focus.map((item) => focusLabels[item]).join(', ')}. This is a weighting, not a request to remove subject or composition.`)
            : (zh ? '均衡还原所有可见层次。' : 'Reconstruct all visible layers evenly.');
          const system = zh
            ? '你是专业的图片提示词反推助手。先在内部观察，再只输出一段可直接用于文生图的中文提示词，不要 Markdown 或解释。按重要性组织：①可见主体与媒介；②构图、景别、镜头、姿势和必要的背景关系；③线条/渲染、光影、主色、材质和氛围；④仅在画面明确可见时加入有辨识度的细节。优先准确与可复现，避免穷举、重复和臆造。用户备注已被转换为分析权重，绝不能在结果中出现或被复述。禁止输出文件名、尺寸、格式、图片链接、提示词分析过程或任何元信息。完整提示词控制在约 90–220 个中文字符，且仅保留能明显改变生成结果的细节。'
            : 'You reverse-engineer image prompts. Observe internally, then output one generation-ready prompt only, with no markdown or explanation. Order information by: visible subject and medium; composition, framing, camera, pose, and necessary background relation; rendering, lighting, palette, materials, and mood; then distinctive details only when plainly visible. Favor faithful, reproducible observations over exhaustive lists, repetition, or invented details. User notes have already been converted to analysis weights and must never appear in or be paraphrased by the result. Never include filenames, dimensions, formats, URLs, analysis, or other metadata. Keep the final prompt concise and include only details that materially affect generation.';
          let prompt = '';
          if (isNativeGeminiApi(baseUrl)) {
            prompt = await reverseNativeGemini(input, baseUrl, system, priority);
          } else {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (input.apiKey?.trim()) headers.Authorization = `Bearer ${input.apiKey.trim()}`;
            const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: input.model,
                messages: [
                  { role: 'system', content: system },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: priority },
                      { type: 'image_url', image_url: { url: input.dataUrl } },
                    ],
                  },
                ],
                max_tokens: 480,
              }),
            });
            const data = await readUpstreamJson<{
              choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
              error?: { message?: string };
            }>(upstream, 'Reverse request');
            if (!upstream.ok) throw new Error(data.error?.message || `Reverse request failed (${upstream.status}).`);
            prompt = reversePromptFromOpenAI(data);
          }
          if (!prompt) throw new Error('Reverse model returned no prompt.');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ prompt }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Reverse request failed.' }));
        }
      });
      server.middlewares.use('/api/generate', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        try {
          const input = JSON.parse(Buffer.concat(chunks).toString()) as GenerateRequest;
          const baseUrl = normalizeProviderBaseUrl(new URL(input.baseUrl ?? ''));
          if (baseUrl.protocol !== 'https:' || !input.apiKey || !input.model || !input.prompt) {
            throw new Error('缺少有效的供应商配置或提示词。');
          }
          const references = (input.references ?? []).filter((reference) => typeof reference.url === 'string' && reference.url.length > 0) as Array<{ kind: 'image' | 'video'; url: string }>;
          if (isNativeGeminiApi(baseUrl) && input.type === 'image' && isGeminiImageModel(input.model)) {
            const url = await generateNativeGeminiImage(input, baseUrl, references);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url }));
            return;
          }
          if (!isNativeGeminiApi(baseUrl) && input.type === 'image' && isGeminiImageModel(input.model)) {
            const url = await generateResponsesGeminiImage(input, baseUrl, references);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url }));
            return;
          }
          if (isNativeGeminiApi(baseUrl) && input.type === 'video' && isGeminiVideoModel(input.model)) {
            const url = await generateNativeGeminiVideo(input, baseUrl, references);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url }));
            return;
          }
          if (input.type === 'video') {
            const mode = input.referenceMode ?? 'image-reference';
            const imageReferences = references.filter((reference) => reference.kind === 'image');
            const videoReferences = references.filter((reference) => reference.kind === 'video');
            if (input.model.includes('grok-imagine-video')) {
              if (input.model.includes('video-1.5') && mode === 'image-reference' && imageReferences.length) {
                throw new Error('grok-imagine-video-1.5 does not support reference-to-video.');
              }
              if (mode === 'video-edit' && (videoReferences.length !== 1 || imageReferences.length)) {
                throw new Error('Reference-video mode accepts exactly one video and no images.');
              }
              if (mode === 'image-to-video' && (imageReferences.length !== 1 || videoReferences.length)) {
                throw new Error('Image-to-video mode accepts exactly one image.');
              }
              if (mode === 'image-reference' && (imageReferences.length > 7 || videoReferences.length)) {
                throw new Error('Reference-image mode accepts up to seven images.');
              }
            } else if (references.length) {
              throw new Error('The selected video model does not support reference media.');
            }
            const endpoint = mode === 'video-edit' && videoReferences.length
              ? '/videos/edits'
              : '/videos/generations';
            const videoBody: Record<string, unknown> = {
              model: input.model,
              prompt: input.prompt,
              duration: Math.max(1, Math.min(10, input.duration ?? 6)),
              aspect_ratio: input.ratio ?? '16:9',
              resolution: input.quality === 'high' ? '720p' : '480p',
            };
            if (mode === 'video-edit' && videoReferences.length) {
              videoBody.video = { url: videoReferences[0].url };
              delete videoBody.duration;
              delete videoBody.aspect_ratio;
              delete videoBody.resolution;
            } else if (mode === 'image-to-video' && imageReferences.length) {
              videoBody.image = { url: imageReferences[0].url };
            } else if (mode === 'image-reference' && imageReferences.length) {
              videoBody.reference_images = imageReferences.map((reference) => ({ url: reference.url }));
            }
            const upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}${endpoint}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(videoBody),
            });
            const started = await upstream.json() as { request_id?: string; error?: { message?: string } };
            if (!upstream.ok || !started.request_id) throw new Error(started.error?.message || `Video request failed (${upstream.status}).`);
            for (let attempt = 0; attempt < 120; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 2_000));
              const statusResponse = await fetch(`${baseUrl.href.replace(/\/$/, '')}/videos/${started.request_id}`, {
                headers: { Authorization: `Bearer ${input.apiKey}` },
              });
              const status = await statusResponse.json() as { status?: string; video?: { url?: string }; error?: { message?: string } };
              if (!statusResponse.ok) throw new Error(status.error?.message || `Video status failed (${statusResponse.status}).`);
              if (status.status === 'done' && status.video?.url) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ url: status.video.url }));
                return;
              }
              if (status.status === 'failed' || status.status === 'expired') throw new Error(`Video generation ${status.status}.`);
            }
            throw new Error('Video generation timed out after 4 minutes.');
          }
          const size = genericImageSizeForRatio(input.ratio);
          const grokImage = isGrokImagineImageModel(input.model);
          const gptImage = isGptImageModel(input.model);
          const imageReferences = references.filter((reference) => reference.kind === 'image');
          if (references.some((reference) => reference.kind === 'video')) {
            throw new Error('Image generation accepts image references only.');
          }
          if (imageReferences.length && !gptImage && !grokImage) {
            throw new Error('The selected image model does not support reference images.');
          }
          if (grokImage && imageReferences.length > 3) {
            throw new Error('Grok image editing accepts up to three source images.');
          }
          let upstream: Response;
          if (gptImage && imageReferences.length) {
            const form = new FormData();
            form.set('model', input.model);
            form.set('prompt', input.prompt);
            form.set('size', size);
            form.set('quality', input.quality === 'high' ? 'high' : 'low');
            for (let index = 0; index < imageReferences.length; index += 1) {
              const blob = await referenceBlob(imageReferences[index].url);
              form.append('image[]', blob, `reference-${index + 1}.png`);
            }
            upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}/images/edits`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${input.apiKey}` },
              body: form,
            });
          } else {
          const body: Record<string, unknown> = { model: input.model, prompt: input.prompt, n: 1 };
          if (gptImage) {
            body.size = size;
            body.quality = input.quality === 'high' ? 'high' : 'low';
          } else if (grokImage) {
            body.aspect_ratio = input.ratio ?? '16:9';
            body.resolution = input.quality === 'high' ? '2k' : '1k';
            if (imageReferences.length) {
              body.images = imageReferences.map((reference) => ({ type: 'image_url', url: reference.url }));
            }
          } else {
            body.size = size;
            const seed = seedSupported(input.model, 'image') ? numericSeed(input.seed) : undefined;
            if (seed !== undefined) body.seed = seed;
          }
          const imageEndpoint = grokImage && imageReferences.length
            ? '/images/edits'
            : '/images/generations';
          upstream = await fetch(`${baseUrl.href.replace(/\/$/, '')}${imageEndpoint}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          }
          const data = await upstream.json() as { data?: Array<{ url?: string; b64_json?: string }>; error?: { message?: string } };
          if (!upstream.ok) throw new Error(data.error?.message || `上游请求失败（${upstream.status}）。`);
          const item = data.data?.[0];
          if (!item?.url && !item?.b64_json) throw new Error('上游未返回图片。');
          let url = item.url;
          if (!url && item.b64_json) {
            const filename = `${randomUUID()}.png`;
            const outputDir = resolve(process.cwd(), 'public', 'generated');
            await mkdir(outputDir, { recursive: true });
            await writeFile(resolve(outputDir, filename), Buffer.from(item.b64_json, 'base64'));
            url = `/generated/${filename}`;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : '生成失败。' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), imageGateway()],
  // ponytail: provider settings live in browser storage, so never silently move dev to a new origin.
  server: { port: 5173, strictPort: true },
})

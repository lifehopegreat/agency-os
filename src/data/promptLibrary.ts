import type { Locale } from '../i18n/locales';

export type PromptCategoryId =
  | 'ui'
  | 'infographic'
  | 'poster'
  | 'portrait'
  | 'landscape'
  | 'product'
  | 'architecture'
  | 'anime'
  | 'cinematic'
  | 'cyberpunk'
  | 'food'
  | 'fashion'
  | 'abstract';

export type LocalizedText = Record<Locale, string>;

export type PromptTemplate = {
  id: string;
  category: PromptCategoryId;
  title: LocalizedText;
  body: LocalizedText;
  tags: LocalizedText;
  ratio?: '1:1' | '16:9' | '9:16';
  builtIn: boolean;
};

export type UserPrompt = {
  id: string;
  title: string;
  body: string;
  category: PromptCategoryId | 'custom';
  createdAt: number;
  favorite?: boolean;
};

export const PROMPT_CATEGORY_ORDER: PromptCategoryId[] = [
  'ui', 'infographic', 'poster', 'product', 'portrait', 'cinematic',
  'architecture', 'anime', 'fashion', 'food', 'landscape', 'cyberpunk', 'abstract',
];

const template = (
  id: string,
  category: PromptCategoryId,
  ratio: PromptTemplate['ratio'],
  title: LocalizedText,
  body: LocalizedText,
  tags: LocalizedText,
): PromptTemplate => ({ id, category, ratio, title, body, tags, builtIn: true });

/**
 * Curated, rewritten production templates. Their structure is informed by the
 * MIT-licensed freestylefly/awesome-gpt-image-2 template collection.
 */
export const BUILTIN_PROMPTS: PromptTemplate[] = [
  template('ui-mobile-product', 'ui', '9:16',
    { zh: '移动端产品界面', en: 'Mobile product interface' },
    {
      zh: '为「[产品名称]」生成一张完整的 [iOS/Android] 移动端首页界面，画幅 9:16。核心任务是 [用户要完成的事]。信息层级：顶部状态与欢迎信息；中部一个最重要的主卡片；下方 2-4 个次级模块；底部导航。视觉方向：[极简 / 编辑感 / 深色科技 / 温暖生活]，主色 [颜色]，强调色 [颜色]，使用真实且克制的中文文案。要求：间距一致、组件对齐、文字清晰可读、数据合理、无品牌 Logo、无乱码、不要把界面做成海报或概念拼贴。输出高保真 app screenshot。',
      en: 'Create one complete 9:16 [iOS/Android] home screen for "[product name]". The primary job is [user task]. Hierarchy: status and welcome at top, one decisive hero card, 2–4 secondary modules, bottom navigation. Direction: [minimal/editorial/dark-tech/warm lifestyle], primary [color], accent [color], with restrained realistic copy. Keep spacing and alignment consistent, text legible, data plausible; no logo, gibberish, poster treatment, or concept collage. Output a high-fidelity app screenshot.'
    },
    { zh: 'UI, 移动端, 产品设计', en: 'UI, mobile, product design' }),
  template('ui-web-dashboard', 'ui', '16:9',
    { zh: '桌面端工作台', en: 'Desktop workspace' },
    {
      zh: '生成「[产品名称]」的桌面端 Web 工作台截图，16:9。用户角色是 [角色]，当前目标是 [任务]。布局：左侧窄导航；顶部工具栏；主区展示 [核心内容]；右侧可选的详情/参数面板。视觉风格：[工业控制台 / 高级编辑系统 / 明亮 SaaS]，使用 [主色] 与 [强调色]。把信息组织成明确的标题、状态、表格/卡片和可操作控件；只出现必要的短中文文案。要求：真实网页比例、严格网格、可读文字、留白克制、没有随机图标或虚构 Logo。',
      en: 'Generate a 16:9 desktop web workspace for "[product name]". The user is a [role] completing [task]. Layout: narrow left navigation, top toolbar, main area for [core content], optional right detail/settings panel. Style: [industrial console/premium editorial system/bright SaaS], using [primary] and [accent]. Organize clear headings, states, tables/cards, and actionable controls with only necessary short copy. Use a strict grid, believable web proportions, readable text, disciplined whitespace, no random icons or invented logos.'
    },
    { zh: 'UI, Web, 仪表盘', en: 'UI, web, dashboard' }),
  template('infographic-process', 'infographic', '9:16',
    { zh: '流程信息图', en: 'Process infographic' },
    {
      zh: '设计一张 9:16 中文信息图，主题「[主题]」，面向 [目标读者]。结构：顶部一个准确标题与一句副标题；中部按顺序展示 4 个步骤「[步骤1] / [步骤2] / [步骤3] / [步骤4]」；每步包含一个简洁图标、短标题和不超过 16 字的说明；底部给出一个可执行结论。视觉语言：[科学编辑 / 极简科技 / 温暖科普]，主色 [颜色]，用一条清晰的视觉路径连接步骤。要求：内容层级一眼可扫、中文清晰、图标含义明确、不过度装饰、不要长段落、不要乱码。',
      en: 'Design a 9:16 infographic in [language] about "[topic]" for [audience]. Structure: an exact title and short subtitle; four ordered steps, [step 1] / [step 2] / [step 3] / [step 4]; each with a simple icon, short heading, and a description under 16 words; one actionable conclusion at the bottom. Direction: [scientific editorial/minimal tech/warm education], primary [color], with one clear visual route through the steps. Make hierarchy scannable, copy legible, icons meaningful, and avoid clutter, long paragraphs, or gibberish.'
    },
    { zh: '信息图, 流程, 中文排版', en: 'infographic, process, layout' }),
  template('infographic-comparison', 'infographic', '16:9',
    { zh: '双方案对比图', en: 'Two-option comparison' },
    {
      zh: '生成一张 16:9 的「[方案 A] vs [方案 B]」对比信息图。顶部标题「[标题]」；主体为左右两列，分别用 3-5 个相同维度对比 [维度1、维度2、维度3、维度4]；每列只保留短句、数值或图标；底部写出适用建议「[结论]」。视觉风格：[咨询报告 / 产品决策卡 / 科技杂志]，A 使用 [颜色A]，B 使用 [颜色B]，确保对比关系优先于装饰。要求：严格对齐、中文或英文文字完全可读、不要虚构数据、不要塞入多余模块。',
      en: 'Create a 16:9 comparison infographic: "[Option A] vs [Option B]". Put "[title]" at top. Use two aligned columns comparing 3–5 identical dimensions: [dimension 1, 2, 3, 4]. Keep each cell to a short phrase, number, or icon; end with "[recommendation]". Direction: [consulting report/product decision card/tech magazine]; A uses [color A], B [color B]. Prioritize comparison over decoration: strict alignment, fully legible copy, no invented metrics, no extra modules.'
    },
    { zh: '信息图, 对比, 决策', en: 'infographic, comparison, decision' }),
  template('poster-typography', 'poster', '9:16',
    { zh: '概念字体海报', en: 'Concept typography poster' },
    {
      zh: '为标题「[标题]」设计一张完成度极高的 9:16 概念字体海报，只输出一张成品。标题必须巨大、拼写准确、是唯一主视觉；围绕它构建一个视觉隐喻 [隐喻/情绪]。使用 [主色]、[辅助色]、[点缀色] 三色系统，版式 [居中 / 左对齐 / 对角线]，留白充足。质感为 [丝网印刷 / 杂志编辑 / 平版印刷 / 纸纤维]。不要 moodboard、不要样机、不要网格展示板、不要无关文字、不要 Logo、不要默认字体效果。',
      en: 'Create one finished 9:16 conceptual typography poster for the exact title "[title]". The title must be huge, spelled exactly, and be the sole hero. Build one visual metaphor around [metaphor/mood]. Use [primary], [secondary], and [accent] as a restrained three-color system; composition [centered/left-aligned/diagonal] with generous whitespace. Material: [silkscreen/editorial/lithograph/paper fiber]. No moodboard, mockup, presentation grid, unrelated copy, logo, or default-font effect.'
    },
    { zh: '海报, 字体, 平面设计', en: 'poster, typography, graphic design' }),
  template('poster-campaign', 'poster', '9:16',
    { zh: '品牌活动主视觉', en: 'Campaign key visual' },
    {
      zh: '为 [品牌/活动] 设计一张 9:16 商业活动主视觉海报。核心主题：[主题]；主体：[人物/产品/场景]；动作或姿态：[动作]；标题文字必须准确显示「[标题]」，副标题「[副标题]」。构图采用 [近景强主视觉 / 对角线动态 / 极简留白]，将主体置于视觉重心，背景只服务主题。风格：[高级运动 / 音乐现场 / 奢侈品 / 青年文化]，光线 [光线]，色彩 [配色]。要求：高辨识度、字少且可读、像真实品牌 campaign，不要复制现有品牌或海报。',
      en: 'Design a 9:16 commercial key visual for [brand/event]. Theme: [theme]; subject: [person/product/setting]; action: [action]. Exact headline: "[headline]"; exact subtitle: "[subtitle]". Compose as [tight hero/diagonal motion/minimal whitespace], place the subject at the visual center, and let the background only support the idea. Style: [premium sport/music event/luxury/youth culture], lighting [lighting], palette [palette]. Keep it distinctive and brand-ready, with sparse readable text; do not copy an existing brand or poster.'
    },
    { zh: '海报, 活动, 品牌视觉', en: 'poster, campaign, brand visual' }),
  template('product-hero', 'product', '1:1',
    { zh: '电商产品主图', en: 'E-commerce product hero' },
    {
      zh: '为 [产品名称] 生成一张 1:1 电商产品主图。产品材质：[材质]，颜色：[颜色]，最重要卖点：[卖点]。让产品占画面 65%-75%，三分之二视角，背景为 [纯色 / 柔和渐变 / 极简场景]；使用 [柔光箱 / 侧逆光 / 高反差] 布光，保留真实边缘、高光和投影。只出现产品本身与必要道具 [道具]。要求：商业摄影级清晰度、干净背景、无文字、无水印、无额外产品、无虚构品牌 Logo。',
      en: 'Create a 1:1 e-commerce hero for [product name]. Material: [material], color: [color], key benefit: [benefit]. Let the product occupy 65–75% of frame in a three-quarter view, against [solid/soft gradient/minimal setting]. Light with [softbox/rim light/high contrast], preserving believable edges, highlights, and shadow. Include only the product and necessary props [props]. Commercial-photo clarity; clean background; no text, watermark, extra products, or invented brand logo.'
    },
    { zh: '产品, 电商, 商业摄影', en: 'product, e-commerce, commercial photo' }),
  template('product-cutaway', 'product', '16:9',
    { zh: '产品剖面功能图', en: 'Product cutaway explainer' },
    {
      zh: '生成一张 16:9 产品功能剖面视觉，产品是 [产品]。展示 [3 个核心部件/功能] 如何协同：用干净的爆炸视图或半透明剖面，部件之间保持真实装配关系。背景为 [浅色实验室 / 深色科技棚拍]，产品采用 [材质与颜色]。只标注 3 个短标签：「[标签1]」「[标签2]」「[标签3]」，使用细引线且不遮挡主体。要求：工业设计合理、信息层级清楚、文字完全可读、不要科幻乱码、不要多余装饰。',
      en: 'Create a 16:9 product cutaway for [product]. Show how [three core parts/features] work together through a clean exploded view or transparent sectional view, while keeping real assembly relationships. Background: [light lab/dark tech studio]; material and color: [material/color]. Label only three elements—"[label 1]", "[label 2]", "[label 3]"—with fine leader lines that never cover the product. Make industrial design plausible, hierarchy clear, labels legible; no sci-fi gibberish or decorative clutter.'
    },
    { zh: '产品, 剖面, 功能图', en: 'product, cutaway, explainer' }),
  template('portrait-editorial', 'portrait', '9:16',
    { zh: '编辑肖像摄影', en: 'Editorial portrait' },
    {
      zh: '拍摄一张 9:16 编辑肖像：[人物描述]，年龄与气质 [描述]，服装 [服装]。镜头语言： [半身/近景]，视线 [视线]，姿态 [姿态]，背景 [背景]。使用 [窗边柔光 / 阴天散射光 / 单侧硬光]，强调真实皮肤纹理、发丝、布料和自然阴影；色彩为 [色彩方向]，镜头感 [35mm / 50mm / 85mm]。要求：人物五官自然、手部合理、没有美颜塑料感、没有文字、没有水印、不要过度电影滤镜。',
      en: 'Shoot a 9:16 editorial portrait of [person description], with [age/mood], wearing [wardrobe]. Framing: [half body/close], gaze [gaze], pose [pose], background [background]. Use [soft window/overcast diffuse/single hard-side] light; preserve real skin texture, hair, fabric, and natural shadows. Color direction [palette], lens feel [35/50/85mm]. Natural facial features and hands, no plastic beauty filter, text, watermark, or excessive cinematic grading.'
    },
    { zh: '人像, 编辑摄影, 写实', en: 'portrait, editorial, photography' }),
  template('portrait-character-sheet', 'portrait', '9:16',
    { zh: '角色设定板', en: 'Character design sheet' },
    {
      zh: '制作一张 9:16 角色设定板，角色：[角色身份]，年龄 [年龄]，气质 [气质]。主区域是一张清晰半身正面肖像；周围附 3 个小区域：服装细节、随身物件、表情或侧脸。统一风格为 [动画 / 游戏写实 / 时装插画]，配色 [配色]，背景简洁如设计工作室。只允许标题「[角色名]」和 3 个极短标注，文字必须清晰。要求：同一角色特征在所有区域一致、信息板干净、不要变成多人物拼贴或杂乱 moodboard。',
      en: 'Make a 9:16 character design sheet for [role], age [age], personality [mood]. The main area is one clear front-facing half-body portrait; three smaller areas show wardrobe detail, personal item, and expression or profile. Keep one consistent [anime/game-realism/fashion illustration] style and [palette], on a clean design-studio background. Only allow the title "[character name]" and three tiny labels, all legible. Keep identity consistent across every panel; no multi-character collage or messy moodboard.'
    },
    { zh: '人像, 角色, 设定板', en: 'portrait, character, design sheet' }),
  template('cinematic-film-still', 'cinematic', '16:9',
    { zh: '电影剧照', en: 'Cinematic film still' },
    {
      zh: '生成一张 16:9 电影剧照。场景：[地点与时间]；主角：[人物]；正在发生的关键动作：[动作]；画面情绪：[情绪]。镜头为 [近景/中景/广角建立镜头]，前景 [前景元素]，背景 [背景元素]，用 [主光来源] 塑造清晰的明暗关系。色彩为 [配色]，质感 [35mm 胶片 / 数码大片 / 低饱和纪实]。要求：一帧就能读懂戏剧关系，主体明确，环境有叙事但不抢戏；没有字幕、Logo、海报文字。',
      en: 'Generate one 16:9 cinematic film still. Setting: [place and time]; protagonist: [person]; decisive action: [action]; emotion: [mood]. Camera: [close/medium/wide establishing], foreground [element], background [element], and [key light source] creating clear light–shadow logic. Palette [palette], texture [35mm film/digital feature/low-saturation documentary]. The dramatic relationship should read in one frame; subject stays clear and environment supports rather than steals focus. No subtitles, logo, or poster copy.'
    },
    { zh: '电影感, 剧照, 叙事', en: 'cinematic, film still, narrative' }),
  template('cinematic-travel', 'cinematic', '16:9',
    { zh: '旅行纪录片镜头', en: 'Travel documentary frame' },
    {
      zh: '拍摄一张 16:9 旅行纪录片画面：[地点] 的 [季节/天气]。主视觉是 [人物/交通工具/地标]，它位于画面 [位置]；环境细节包含 [三个真实细节]。使用 [清晨/黄昏/阴天] 自然光，镜头 [24mm 广角 / 50mm 纪实]，色彩克制且接近真实。构图有明确前中后景和空间尺度。要求：真实旅行摄影，不要旅游海报排版、不要饱和滤镜、不要文字或水印。',
      en: 'Shoot a 16:9 travel-documentary frame in [place] during [season/weather]. The visual anchor is [person/vehicle/landmark] at [position], with [three real environmental details]. Use [morning/golden-hour/overcast] natural light and a [24mm wide/50mm documentary] lens. Keep color restrained and believable, with clear foreground/midground/background and a sense of scale. Real travel photography only: no tourism-poster layout, saturated filter, text, or watermark.'
    },
    { zh: '电影感, 旅行, 纪实', en: 'cinematic, travel, documentary' }),
  template('architecture-exterior', 'architecture', '16:9',
    { zh: '建筑外立面摄影', en: 'Architectural exterior' },
    {
      zh: '拍摄 [建筑类型] 的 16:9 建筑外立面，地点 [环境]，建筑语言 [极简混凝土 / 红砖 / 玻璃幕墙 / 木结构]。机位 [仰视 / 平视 / 对称正面]，时间 [清晨/黄昏/阴天]，画面中只保留少量比例参照人物。强调真实结构、正确透视、材料接缝、光影和周边植被/街道关系。要求：建筑线条垂直、无鱼眼变形、无随机门窗、无 Logo、没有夸张科幻元素。',
      en: 'Photograph a 16:9 exterior of a [building type] in [environment], with [minimal concrete/red brick/glass curtain wall/timber] architecture. Camera [low angle/eye level/symmetrical frontal], time [morning/golden hour/overcast], with only a few people as scale reference. Emphasize credible structure, correct perspective, material joints, light, and its relationship to street or planting. Keep verticals straight: no fisheye, random windows, logo, or exaggerated sci-fi.'
    },
    { zh: '建筑, 外观, 摄影', en: 'architecture, exterior, photography' }),
  template('architecture-interior', 'architecture', '16:9',
    { zh: '室内空间设计', en: 'Interior design view' },
    {
      zh: '生成 [空间类型] 的 16:9 室内设计图，面积和动线感觉 [描述]。核心材质是 [材质1]、[材质2]、[材质3]；主家具为 [家具]；自然光从 [方向] 进入，辅以 [灯具]。画面采用 [一/两点透视]，镜头高度接近人的视线。风格 [日式克制 / 当代极简 / 温暖复古 / 精品酒店]，配色 [配色]。要求：比例合理、家具尺度真实、空间整洁但有人使用痕迹，不要杂乱陈列、不要无意义文字。',
      en: 'Generate a 16:9 interior for a [space type] with a sense of [size/circulation]. Core materials: [material 1], [material 2], [material 3]; hero furniture: [furniture]; daylight enters from [direction] and is supported by [fixture]. Use [one/two-point] perspective at human eye height. Style [restrained Japanese/contemporary minimal/warm retro/boutique hotel], palette [palette]. Keep proportions and furniture scale believable; tidy but lightly lived-in, with no clutter or meaningless text.'
    },
    { zh: '建筑, 室内, 空间设计', en: 'architecture, interior, spatial design' }),
  template('anime-key-visual', 'anime', '9:16',
    { zh: '动画关键视觉', en: 'Anime key visual' },
    {
      zh: '制作一张 9:16 动画关键视觉。角色：[角色描述]，服装 [服装]，动作 [动作]；场景 [地点与季节]；前景加入 [前景元素]。画面以 [日落逆光 / 雨夜霓虹 / 清晨薄雾] 为主光，线稿干净、上色明确、头发和衣物有自然动态。构图中角色是唯一明确焦点，背景有深度但不过载。风格：[赛璐璐 / 精细插画 / 电影动画]，色彩 [配色]。不要模仿任何在世艺术家，不要文字、Logo 或水印。',
      en: 'Make a 9:16 anime key visual. Character: [description], wardrobe [wardrobe], action [action]; setting [place and season]; foreground [element]. Use [sunset rim light/neon rain/morning mist] as the key light, with clean linework, deliberate color blocks, and natural motion in hair and clothing. The character is the sole clear focal point; background has depth without overload. Style [cel shading/detailed illustration/cinematic animation], palette [palette]. Do not imitate a living artist; no text, logo, or watermark.'
    },
    { zh: '动漫, 关键视觉, 角色', en: 'anime, key visual, character' }),
  template('anime-slice-of-life', 'anime', '16:9',
    { zh: '动画日常场景', en: 'Anime slice of life' },
    {
      zh: '绘制一张 16:9 日常动画场景：[人物关系] 在 [地点] 做 [普通动作]。重点是自然互动、手部动作和环境中的小细节：[细节1]、[细节2]、[细节3]。光线 [午后窗光 / 阴天柔光 / 夜间台灯]，情绪 [情绪]，采用 [细线稿 + 柔和赛璐璐 / 水彩背景]。要求：构图像叙事中的一帧，人物比例自然、道具符合使用方式、画面干净，不要过度特效或大段文字。',
      en: 'Draw a 16:9 slice-of-life anime scene: [relationship] in [place] doing [ordinary action]. Emphasize natural interaction, hands, and small environmental details: [detail 1], [detail 2], [detail 3]. Lighting [afternoon window/overcast soft/night lamp], mood [mood], using [fine linework with soft cel shading/watercolor background]. It should read as one narrative frame, with natural proportions and plausible prop use; clean composition, no excessive effects or long text.'
    },
    { zh: '动漫, 日常, 叙事', en: 'anime, slice of life, narrative' }),
  template('fashion-editorial', 'fashion', '9:16',
    { zh: '时装编辑大片', en: 'Fashion editorial' },
    {
      zh: '拍摄一张 9:16 高级时装编辑照。模特：[人物特征]，穿着 [完整造型]，姿态 [姿态]；场景 [地点]。构图 [全身 / 半身 / 局部裁切]，镜头 [50mm / 85mm]，光线 [硬闪光 / 侧窗光 / 阴天柔光]，色彩 [配色]。必须强调服装的版型、面料、层次和配饰 [配饰]，同时让人物表情克制。要求：像真实杂志 editorial，皮肤和衣物纹理真实、不要品牌 Logo、不要多余文字、不要塑料磨皮。',
      en: 'Shoot a 9:16 high-fashion editorial. Model: [features], wearing [full look], pose [pose], setting [place]. Frame [full body/half body/cropped detail], lens [50/85mm], light [hard flash/side window/overcast soft], palette [palette]. Prioritize silhouette, fabric, layers, and [accessories], with a restrained expression. It should feel like a real magazine editorial: real skin and textile texture, no brand logo, extra text, or plastic retouching.'
    },
    { zh: '时尚, 编辑, 服装', en: 'fashion, editorial, clothing' }),
  template('fashion-lookbook', 'fashion', '16:9',
    { zh: '品牌 Lookbook 双人画面', en: 'Brand lookbook duo' },
    {
      zh: '生成一张 16:9 品牌 lookbook 画面：两位模特 [人物A] 与 [人物B]，分别穿 [造型A]、[造型B]，在 [地点]，动作关系 [关系]。画面强调两套服装的差异与统一，背景简洁，光线 [光线]，色彩 [配色]。构图像真实服装目录的跨页主图，留出少量干净空白但不要添加排版文字。要求：人物数量恰好为两人、服装细节清楚、肢体自然、没有第三人或多余商品。',
      en: 'Generate a 16:9 brand lookbook image with exactly two models: [person A] in [look A] and [person B] in [look B], at [place], with [relationship/action]. Make the outfits distinct yet cohesive, background minimal, light [lighting], palette [palette]. Compose like a real fashion-catalogue spread with a little clean negative space but no added layout text. Exactly two people, clear garments, natural limbs, no third person or extra product.'
    },
    { zh: '时尚, Lookbook, 双人', en: 'fashion, lookbook, duo' }),
  template('food-hero', 'food', '1:1',
    { zh: '餐饮主视觉', en: 'Food hero image' },
    {
      zh: '拍摄一张 1:1 美食主视觉：[菜品/饮品]，关键食材 [食材]，摆放在 [器皿] 上。角度 [俯拍 / 45 度 / 微距]，背景 [桌面材质]，搭配少量合理道具 [道具]。光线 [侧窗自然光 / 柔光棚拍 / 夜间暖光]，强调蒸汽、酱汁、冰珠或酥脆纹理 [质感]。要求：食物新鲜、分量真实、构图干净、没有手指变形、没有文字、没有额外餐具堆砌。',
      en: 'Shoot a 1:1 food hero: [dish/drink] with key ingredients [ingredients], served on [vessel]. Camera [overhead/45-degree/macro], background [table material], with only a few plausible props [props]. Light [side-window/soft studio/warm night], emphasizing [steam/sauce/condensation/crisp texture]. Food must look fresh with believable portions and a clean composition; no malformed fingers, text, or piled-up extra tableware.'
    },
    { zh: '美食, 餐饮, 商业摄影', en: 'food, dining, commercial photography' }),
  template('food-beverage-campaign', 'food', '9:16',
    { zh: '饮品广告图', en: 'Beverage campaign' },
    {
      zh: '为 [饮品名称/类型] 设计一张 9:16 饮品广告图。杯体/瓶体 [描述]，液体颜色 [颜色]，核心氛围 [清爽夏日 / 深夜城市 / 温暖冬季]。让饮品处于画面中央偏下，周围只放 [2-3 个原料或道具]，使用 [逆光透亮 / 高反差闪光 / 柔和日光]，突出冷凝水珠、液体透明度和杯壁反射。若有文字，只能是准确的「[品牌/短句]」。不要凭空添加品牌 Logo 或多余产品。',
      en: 'Design a 9:16 beverage campaign for [drink name/type]. Vessel [description], liquid [color], mood [fresh summer/late-night city/warm winter]. Place the drink lower-center, with only [2–3 ingredients or props]. Use [translucent backlight/high-contrast flash/soft daylight] to show condensation, liquid clarity, and vessel reflections. If text is needed, it may only be the exact "[brand/short line]". Do not invent logos or add extra products.'
    },
    { zh: '美食, 饮品, 广告', en: 'food, beverage, advertising' }),
  template('landscape-atmosphere', 'landscape', '16:9',
    { zh: '氛围风景摄影', en: 'Atmospheric landscape' },
    {
      zh: '拍摄一张 16:9 风景照片：地点 [地貌]，季节与天气 [条件]，时间 [清晨/日落/蓝调时刻]。前景 [前景元素]，中景 [主体]，远景 [远景]，三层关系清楚。光线 [光线]，色调 [配色]，镜头 [24mm / 35mm]。保留真实空气透视、地表纹理和自然尺度；只在需要时加入一个很小的人或车辆作比例参照。要求：不是奇幻壁纸，不要过度 HDR、饱和天空、文字或水印。',
      en: 'Shoot a 16:9 landscape at [landform], in [season/weather], at [morning/sunset/blue hour]. Foreground [element], midground [subject], distance [background], with clear three-layer depth. Light [lighting], palette [palette], lens [24/35mm]. Preserve real atmospheric perspective, surface texture, and natural scale; add only a tiny person or vehicle when scale is needed. Not a fantasy wallpaper: no excessive HDR, oversaturated sky, text, or watermark.'
    },
    { zh: '风景, 自然, 摄影', en: 'landscape, nature, photography' }),
  template('cyberpunk-story', 'cyberpunk', '16:9',
    { zh: '近未来城市叙事', en: 'Near-future city story' },
    {
      zh: '生成一张 16:9 近未来城市叙事画面。地点：[城市区域]；主角：[人物或载具]；正在发生：[动作]。科技元素只包括 [三个具体元素]，并服务现实城市逻辑：道路、店铺、雨水、公共交通或人流。光线 [雨夜霓虹 / 晨雾冷光 / 室内工业灯]，配色 [配色]，镜头 [镜头]。要求：有明确主角与故事线、材质可信、招牌文字极少且可读；不要满屏 HUD、无意义电线或随机亚洲文字。',
      en: 'Generate a 16:9 near-future city story. Place: [city district]; protagonist: [person or vehicle]; action: [action]. Limit technology to [three specific elements] and keep it grounded in a real urban logic—streets, shops, rain, transit, or crowds. Light [neon rain/cold morning fog/industrial interior], palette [palette], lens [lens]. Keep one clear protagonist and story, credible materials, and very little readable signage; no screen-filling HUD, meaningless cables, or random Asian text.'
    },
    { zh: '赛博朋克, 城市, 叙事', en: 'cyberpunk, city, narrative' }),
  template('abstract-brand-texture', 'abstract', '1:1',
    { zh: '品牌抽象材质', en: 'Abstract brand texture' },
    {
      zh: '创作一张 1:1 品牌抽象视觉，用于 [用途]。核心形态：[几何/流体/纸张/金属/玻璃]；主色 [颜色]，辅助色 [颜色]；光线 [柔和渐变 / 强高光 / 半透明背光]。画面必须有一个清晰的视觉重心和可用于排版的 [左侧/顶部/中央] 留白，细节围绕主形态逐渐减弱。质感精致、克制、可商用。不要文字、Logo、具象人物、廉价 3D 效果、杂乱粒子或壁纸式随机纹理。',
      en: 'Create a 1:1 abstract brand visual for [use]. Core form: [geometry/fluid/paper/metal/glass]; primary [color], secondary [color]; light [soft gradient/specular/transparent backlight]. It needs one clear visual center and usable [left/top/center] negative space for layout, with detail fading away from the hero form. Refined, restrained, commercial-ready material. No text, logo, human figure, cheap 3D effect, noisy particles, or random wallpaper texture.'
    },
    { zh: '抽象, 材质, 品牌背景', en: 'abstract, texture, brand background' }),
  template('abstract-illustration-system', 'abstract', '16:9',
    { zh: '系统概念插画', en: 'System concept illustration' },
    {
      zh: '为「[抽象概念]」绘制一张 16:9 系统概念插画。用 [核心隐喻] 表达概念，画面包含一个主要形态和 3 个有逻辑关联的辅助元素 [元素]。构图 [中心扩散 / 从左到右流动 / 环形关系]，主色 [颜色]，背景 [背景]，质感 [扁平编辑插画 / 轻 3D / 手工纸感]。要求：隐喻直观但不直白、层级清晰、元素关系可信、留白可用于标题；不要信息图标签、随机符号、过多角色或文字。',
      en: 'Illustrate the abstract concept "[concept]" in 16:9. Express it with [core metaphor], one main form, and three logically related supporting elements [elements]. Composition [radiating center/left-to-right flow/circular relationship], primary [color], background [background], material [flat editorial/light 3D/handmade paper]. Make the metaphor intuitive without being literal, hierarchy clear, relationships believable, and leave space for a title. No infographic labels, random symbols, excess characters, or text.'
    },
    { zh: '抽象, 概念插画, 系统', en: 'abstract, concept illustration, system' }),
];

export function normalizeRatio(
  ratio?: string,
): '1:1' | '16:9' | '9:16' | undefined {
  if (!ratio) return undefined;
  if (ratio === '1:1' || ratio === '16:9' || ratio === '9:16') return ratio;
  if (ratio === '3:4' || ratio === '4:5' || ratio === '2:3') return '9:16';
  if (ratio === '21:9' || ratio === '3:2') return '16:9';
  return undefined;
}

export function pickLocalized(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.zh ?? text.en;
}

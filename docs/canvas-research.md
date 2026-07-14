# 轻量资产画板方案

## 结论

做，但把它定义为**资产画板 / 灵感板**，不是通用白板或图像编辑器。它服务现有主链路：资产库选图 → 视觉对比与编排 → 作为有顺序的参考图送入创建页。

首版不引入画布依赖，使用 DOM 卡片 + CSS `transform` + Pointer Events 实现拖拽、平移和缩放。当前需求不包含连线、绘图或形状编辑；为这些能力引入图编辑器会把主流程变重。

## 调研判断

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 浏览器原生 DOM + Pointer Events | **首版采用** | 图片仍是可访问的原生元素；可复用现有资产 URL、缩略图和详情交互；零依赖。Pointer Events 支持触控捕获。|
| [React Flow](https://github.com/xyflow/xyflow) | 暂不引入 | MIT，内建节点拖拽、缩放、背景和小地图；当画板演变成“生成流程节点 + 连线”时再采用。|
| [Excalidraw](https://github.com/excalidraw/excalidraw) | 不采用 | MIT，已有无限白板、图片、导出、自由绘制；但手绘白板工具集远超本项目的选图与参考需求。|
| [tldraw](https://github.com/tldraw/tldraw) | 不采用 | SDK 很完整，但生产使用需要许可证密钥，不适合当前轻量功能。|
| [react-konva](https://github.com/konvajs/react-konva) | 暂不引入 | MIT，适合后续真正的拼贴渲染/导出；首版仍需自行实现选择、无障碍和业务交互。|

## MVP：一个画板就够

### 用户动作

1. 在资产卡片或详情中点击“添加到画板”。
2. 在 `/board` 中拖动图片卡片，滚轮缩放，空格拖动平移；“适配全部”一键回到可见范围。
3. 点击选中多张图；右上角“送到创建”将选中资产按选择顺序传给现有 `references`。
4. 创建页继续显示缩略图、调整参考顺序，并按现有模型能力限制图片/视频参考素材。

### 保留

- 画板标题、最多 30 个资产卡片。
- 卡片缩略图、资产 ID、尺寸、类型；双击打开现有详情。
- 拖动位置、缩放、选中态、删除卡片、自动排列（网格）。
- 本地持久化和缺失资产自动清理。

### 明确不做

- 自由画笔、文本框、图层、滤镜、蒙版、裁剪、协作、分享链接、无限画板。
- 将画板导出成 PNG；远端图片跨域时会污染 Canvas，导出可靠性不值得在首版承担。
- 生成节点连线、工作流执行、提示词节点；这些属于后续“流程编排”，不是资产画板。

## 与现有项目的适配

- 复用 `LibraryAsset` 的 `id`、`url`、`type`、`dim` 和 `prompt`；画板只保存 `assetId` 与位置，不复制图片 Blob 或 Base64。
- 新建独立 `boardStorage`，不修改 `agency_os_generation_v1` 的资产数据结构；建议 schema：

```ts
type BoardItem = { id: string; assetId: string; x: number; y: number; z: number };
type BoardState = { version: 1; title: string; zoom: number; offsetX: number; offsetY: number; items: BoardItem[] };
```

- 资产删除后按 `assetId` 清除对应画板项目；这样不会留下失效图片。
- “送到创建”复用现有 `CreateLocationState.references`；创建页已有模型能力校验，因此画板不重复写供应商规则。

## 验收标准

- 选 2–8 张资产后，30 秒内能完成视觉对比并送入创建页。
- 重载页面后，卡片位置和视图保持；删除资产后画板无空卡片。
- 鼠标、触屏和键盘可完成核心选择与删除；缩放不影响资产原始文件。
- 不新增供应商 API、后端接口或图片上传逻辑。

## 升级门槛

只有当用户明确需要“节点之间的生成依赖、参数连接或分支流程”时，才将画板升级到 React Flow；只有明确需要“拼贴导出成图”时，才评估 react-konva。

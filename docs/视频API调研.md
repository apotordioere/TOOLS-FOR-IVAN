# AI Torso：视频生成 API 接入参考

> 调研日期：2026-11-03。视频模型、价格、配额变化很快；上线前必须用实际账号控制台复核模型 ID、单价和并发配额。
>
> 目标输入：首帧图 + 尾帧图 + 运动提示词 + 4～5 秒；目标输出：9:16 MP4 下载到本地。
>
> 纪律说明：下文只把能由官方接口文档确认的字段写成确定值。需要登录、动态页面未能抓取或不同账号可能不同的内容标为“未验证”，不得据此直接写死生产代码。

## 1. 结论先行

### 1.1 能力矩阵

| 服务 | 中国大陆直连 | 首帧+尾帧 | 图片 URL | Base64 / data URL | 4/5 秒 | 9:16 | 推荐度 |
|---|---|---:|---:|---:|---:|---:|---:|
| 火山方舟 Seedance | 是 | **支持** | 支持 | data URL 支持情况随模型/文档版本，需实测 | 通常 5 秒；4 秒视模型 | 首帧决定或 `ratio` | **首选** |
| 可灵 Kling 开放平台 | 是 | **支持**（`image_tail`） | 支持 | 支持裸 Base64；不要带 `data:` 前缀（按官方示例） | 常见 5/10 秒，不支持 4 秒 | 首帧决定 | **首选/备份** |
| MiniMax 海螺 | 是 | **支持**（独立 FL2V） | 支持 | **支持 data URL** | Hailuo-02 首尾帧仅 6/10 秒 | 首帧决定 | 质量备选，但不满足 4～5 秒原生时长 |
| 阿里云百炼万相 2.7 | 是 | **支持** | 支持 HTTP(S)/OSS | **支持 data URL** | **2～15 秒整数，原生支持 4/5 秒** | 首帧决定 | **最贴合产品参数** |
| Vidu 原生 | 是 | **支持**（专用 start-end 任务） | 支持 | 官方当前页面需登录/动态加载，未验证 | 模型常见 4/8 秒，具体以模型为准 | 支持 9:16/首帧跟随，需按端点核验 | 值得接入 |
| fal.ai 聚合 | 大陆不保证，建议代理 | **支持**（如 Vidu Q1） | 支持 | 可先上传到 fal storage；直接 data URL 依端点 | 端点固定，Vidu Q1 schema 未暴露时长 | 由图片决定 | 海外统一接入 |
| 硅基流动 | 是 | 当前公开 Wan/Kling 路由多为首帧；尾帧依模型，**未验证** | 支持 | 依模型，未验证 | 依模型 | 依模型 | 国内聚合备选 |
| 302.AI | 是 | 依其所代理模型/接口 | 依模型 | 依模型 | 依模型 | 依模型 | 快速试验，不宜假设统一 schema |

**对当前需求的直接建议：**主通道优先用 **万相 2.7**（4/5 秒均能原生表达，首尾帧和 data URL 都明确支持），质量打样用 **Seedance**，备份用 **Kling**。MiniMax 首尾帧当前固定 6/10 秒，若产品必须严格 4～5 秒，需要生成后裁切，尾帧会因此丢失，不应作为严格首尾帧链路的默认通道。

来源：[万相 2.7 图生视频官方 API](https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference)、[MiniMax 首尾帧 API](https://platform.minimax.cn/docs/api-reference/video-generation-fl2v)、[Kling 图生视频 API](https://klingai.com/dev/document-api/apiReference/model/imageToVideo)、[fal Vidu Q1 OpenAPI](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/vidu/q1/start-end-to-video)。

### 1.2 建议的内部统一接口

各厂商字段差异很大，不要让业务层直接拼供应商 JSON。建议业务层固定为：

```ts
interface ShotVideoRequest {
  provider: "ark" | "kling" | "minimax" | "dashscope" | "vidu" | "fal";
  model: string;
  prompt: string;
  firstFrame: string; // https URL 或本地文件；adapter 负责上传/转 data URL
  lastFrame?: string;
  durationSec: 4 | 5;
  aspectRatio: "9:16";
  resolution: "720p" | "1080p";
  generateAudio?: boolean;
}

interface VideoJob {
  provider: string;
  providerTaskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "expired" | "cancelled";
  videoUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

Adapter 必须保存原始响应、请求参数快照和厂商 request ID；成功后立即流式下载 MP4 到临时文件，再原子改名。不要把厂商临时 URL 当永久资产。

---

## 2. 火山方舟 Seedance

官方入口：[视频生成任务 API](https://www.volcengine.com/docs/82379/1520757)、[方舟模型列表](https://www.volcengine.com/docs/82379/1330310)、[方舟错误码](https://www.volcengine.com/docs/82379/1299023)、[模型价格](https://www.volcengine.com/docs/82379/1099320)。部分旧链接会跳转或要求登录，实际控制台文档版本应作为最终依据。

### 2.1 模型与关键能力

常见模型 ID/接入点示例：

- `doubao-seedance-1-0-pro-250528`
- `doubao-seedance-1-0-pro-fast-251015`
- `doubao-seedance-1-0-lite-i2v-250428`
- `doubao-seedance-1-5-pro-251215`（账号是否开放、精确后缀需在方舟控制台核验）

方舟也可能要求使用用户创建的 **Endpoint ID**，而不是基础模型名。生产端应将模型字符串做配置项，不要硬编码。

**首尾帧：支持。**`content` 中首图使用 `role: "first_frame"`，尾图使用 `role: "last_frame"`。`generate_audio` 仅在支持音频生成的模型上生效；Seedance 1.0 系列是否支持及默认值应以对应模型页为准，不能跨模型假设。[来源](https://www.volcengine.com/docs/82379/1520757)

### 2.2 鉴权

使用方舟 API Key：

```http
Authorization: Bearer $ARK_API_KEY
Content-Type: application/json
```

不是 AK/SK 签名，不需要 `GroupId`。[来源](https://www.volcengine.com/docs/82379/1399008)

### 2.3 创建任务

```http
POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
Authorization: Bearer $ARK_API_KEY
Content-Type: application/json
```

```json
{
  "model": "doubao-seedance-1-0-pro-250528",
  "content": [
    {
      "type": "text",
      "text": "人物缓慢向镜头走近，衣摆随风摆动，镜头轻微推进，动作连续自然"
    },
    {
      "type": "image_url",
      "image_url": { "url": "https://cdn.example.com/shot-001-first.jpg" },
      "role": "first_frame"
    },
    {
      "type": "image_url",
      "image_url": { "url": "https://cdn.example.com/shot-001-last.jpg" },
      "role": "last_frame"
    }
  ],
  "ratio": "adaptive",
  "duration": 5,
  "resolution": "720p",
  "generate_audio": false,
  "watermark": false
}
```

字段：

- `model`：模型 ID 或账号中可调用的推理接入点。
- `content[].type=text` / `text`：运动、主体动作和运镜提示词。
- `content[].type=image_url` / `image_url.url`：模型可拉取的图片地址。
- `role`：`first_frame` 或 `last_frame`，这是首尾帧关键字段。
- `ratio`：首尾帧模式建议 `adaptive`，让输出跟随输入图；若模型接受固定比例，可用模型页列出的 `9:16`。
- `duration`：秒。不同模型允许值不同；本项目先传 `5`，`4` 必须按模型页验证。
- `resolution`：常见 `480p` / `720p` / `1080p`，具体由模型决定。
- `generate_audio`：是否同时生成音频；只有模型明确支持时才传。
- `watermark`：是否加“AI 生成”水印；可用性和合规要求以账号地域为准。

创建成功示意：

```json
{
  "id": "cgt-20261103123456-abcd",
  "model": "doubao-seedance-1-0-pro-250528",
  "status": "queued",
  "created_at": 1793676896
}
```

任务 ID 在顶层 `id`。响应的附加字段可能随版本变化，解析时只依赖官方稳定字段。[来源](https://www.volcengine.com/docs/82379/1520757)

### 2.4 轮询与下载

```http
GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
Authorization: Bearer $ARK_API_KEY
```

`status`：`queued`、`running`、`succeeded`、`failed`、`expired`、`cancelled`。成功时视频地址通常在响应 `content.video_url`（精确响应层级需用账号调用一次固定测试确认；不要只按示意代码上线）。建议 5～10 秒轮询一次，指数退避，上限 10 分钟。常见生成耗时约 1～5 分钟，拥塞时更长，不属于 SLA 保证。

错误处理重点：HTTP `400` 参数/图片问题，`401` Key 错误，`403` 模型或配额权限，`429` 限流，`5xx` 服务端错误；同时记录响应内 `error.code`、`error.message` 和 request ID。完整枚举以[方舟错误码](https://www.volcengine.com/docs/82379/1299023)为准。

### 2.5 图片、画幅、价格、网络

- 公网 HTTPS URL：支持，推荐使用无鉴权或有效期不少于 30 分钟的签名 URL。
- Base64 / data URL：不同模型文档版本有差异，本次未从可公开抓取页面确认；生产前用小图实测。保守方案是对象存储。
- 9:16：首尾帧都先裁成同尺寸 720×1280 或 1080×1920，`ratio: "adaptive"`。
- 价格：按生成视频秒数、模型和分辨率计费；公开价会调整。历史量级约为每秒数角人民币，5 秒约 **¥1～¥5**，1080p/带音频可能更高；这是预算量级，不是报价，须以[方舟价格页](https://www.volcengine.com/docs/82379/1099320)和账号账单为准。未确认首尾帧有独立溢价。
- 中国大陆：北京域名可直连，无需代理。

---

## 3. 可灵 Kling 开放平台

官方入口：[图生视频 API](https://klingai.com/dev/document-api/apiReference/model/imageToVideo)、[鉴权说明](https://klingai.com/dev/document-api/quickStart/authentication)、[价格/资源包](https://klingai.com/dev/pricing)。文档页面为动态站，若链接页面结构变化请从开发者平台导航进入。

### 3.1 鉴权：AK/SK 生成 HS256 JWT

可灵不是直接把 SK 放请求头。使用 AK 作为 JWT `iss`，SK 作为 HS256 密钥。Payload：

```json
{
  "iss": "YOUR_ACCESS_KEY",
  "exp": 1793678696,
  "nbf": 1793676891
}
```

- `iss`：Access Key。
- `exp`：过期 Unix 秒，官方示例通常 `now + 1800`。
- `nbf`：生效 Unix 秒，建议 `now - 5` 规避时钟偏差。
- Header：`{"alg":"HS256","typ":"JWT"}`。

Node.js 示例：

```ts
import jwt from "jsonwebtoken";

const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  { iss: process.env.KLING_AK, exp: now + 1800, nbf: now - 5 },
  process.env.KLING_SK!,
  { algorithm: "HS256", header: { alg: "HS256", typ: "JWT" } }
);
```

请求头：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

不要把 AK/SK 或 JWT 发到浏览器端。[来源](https://klingai.com/dev/document-api/quickStart/authentication)

### 3.2 创建任务

```http
POST https://api.klingai.com/v1/videos/image2video
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "model_name": "kling-v1-6",
  "mode": "pro",
  "duration": "5",
  "image": "https://cdn.example.com/shot-001-first.jpg",
  "image_tail": "https://cdn.example.com/shot-001-last.jpg",
  "prompt": "人物缓慢向前一步，镜头轻微推进，头发和衣摆自然摆动",
  "negative_prompt": "画面抖动，人物变形，闪烁，额外肢体",
  "cfg_scale": 0.5
}
```

字段：

- `model_name`：示例 `kling-v1`、`kling-v1-5`、`kling-v1-6`；账号当前支持列表以控制台为准。
- `mode`：`std` 或 `pro`，可用值随模型变化。
- `duration`：官方常用字符串 `"5"` / `"10"`；4 秒通常不支持。
- `image`：首帧。
- `image_tail`：尾帧；模型/版本支持时同时传入。
- `prompt` / `negative_prompt`：正、负提示词。
- `cfg_scale`：提示词约束强度；范围以模型页为准，不要跨版本固定。

成功示意：

```json
{
  "code": 0,
  "message": "SUCCEED",
  "request_id": "req_xxx",
  "data": {
    "task_id": "kling_xxx",
    "task_status": "submitted",
    "created_at": 1793676896000,
    "updated_at": 1793676896000
  }
}
```

任务 ID：`data.task_id`。[来源](https://klingai.com/dev/document-api/apiReference/model/imageToVideo)

### 3.3 查询

```http
GET https://api.klingai.com/v1/videos/image2video/{task_id}
Authorization: Bearer <JWT>
```

`data.task_status` 常见值：`submitted`、`processing`、`succeed`、`failed`。成功时：

```json
{
  "code": 0,
  "message": "SUCCEED",
  "data": {
    "task_id": "kling_xxx",
    "task_status": "succeed",
    "task_result": {
      "videos": [
        {
          "id": "video_xxx",
          "url": "https://.../result.mp4",
          "duration": "5.0"
        }
      ]
    }
  }
}
```

视频地址：`data.task_result.videos[0].url`。典型耗时约 1～5 分钟；高峰期可能更长。建议 10 秒轮询，8～10 分钟超时后保留任务 ID 后台继续查，不要重新扣费创建。

### 3.4 图片、画幅、价格、网络

- `image` / `image_tail` 接受公网 URL，或图片字节的 **Base64 字符串**。官方示例要求不要加 `data:image/...;base64,` 前缀；大小/像素/宽高比限制以当前模型页为准。[来源](https://klingai.com/dev/document-api/apiReference/model/imageToVideo)
- 竖屏由首帧尺寸决定；首尾帧应同为 9:16、同分辨率。接口不应假设存在统一 `aspect_ratio` 字段。
- 4 秒：一般不能直接传；5 秒：支持。720p/1080p 取决于 `mode` 与模型，不能仅靠一个通用 resolution 字段控制。
- 计费通常按可灵资源点/套餐折算，模型、`std/pro`、5/10 秒差异明显。现金折算量级约 **¥2～¥10/5 秒**，首尾帧是否额外消耗以订单页为准；这不是固定官方报价。上线预算必须以[开发平台价格页](https://klingai.com/dev/pricing)及实际扣点测试为准。
- 中国大陆：官方 API 可直连；域名、账号主体和并发配额需企业账号实测。

---

## 4. MiniMax 海螺

官方入口：[首尾帧生成视频](https://platform.minimax.cn/docs/api-reference/video-generation-fl2v)、[查询任务](https://platform.minimax.cn/docs/api-reference/video-generation-query)、[下载文件](https://platform.minimax.cn/docs/api-reference/video-generation-download)、[视频指南](https://platform.minimax.cn/docs/guides/video-generation)、[价格](https://platform.minimax.cn/docs/pricing/overview#视频)。

### 4.1 鉴权

```http
Authorization: Bearer $MINIMAX_API_KEY
Content-Type: application/json
```

当前新版接口不需要 `GroupId`。旧版部分 MiniMax API 曾要求 URL query `GroupId`，不要把旧示例混入新版 `/v1/video_generation`。[来源](https://platform.minimax.cn/docs/api-reference/video-generation-fl2v)

### 4.2 创建首尾帧任务

```http
POST https://api.minimax.cn/v1/video_generation
Authorization: Bearer $MINIMAX_API_KEY
Content-Type: application/json
```

```json
{
  "model": "MiniMax-Hailuo-02",
  "prompt": "人物从远景缓慢走到近景，[推进]，动作连续自然",
  "first_frame_image": "https://cdn.example.com/shot-001-first.jpg",
  "last_frame_image": "https://cdn.example.com/shot-001-last.jpg",
  "duration": 6,
  "resolution": "1080P",
  "prompt_optimizer": false,
  "aigc_watermark": false
}
```

字段：

- `model`：首尾帧接口官方列出的值为 `MiniMax-Hailuo-02`。
- `first_frame_image`：起始帧；官方 schema 中非必填，但本项目必须传。
- `last_frame_image`：结束帧，必填。
- `prompt`：最多 2000 字符，支持 `[推进]`、`[拉远]`、`[左摇]`、`[固定]` 等运镜指令。
- `duration`：768P 支持 6/10 秒；1080P 支持 6 秒。**不支持 4/5 秒。**
- `resolution`：`768P` / `1080P`；首尾帧不支持 512P。
- `prompt_optimizer`：默认 `true`；为了镜头控制稳定可设 `false`。
- `aigc_watermark`：默认 `false`。

创建成功示意：

```json
{
  "task_id": "106916112212032",
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```

任务 ID：顶层 `task_id`。[来源](https://platform.minimax.cn/docs/api-reference/video-generation-fl2v)

### 4.3 查询与下载

```http
GET https://api.minimax.cn/v1/query/video_generation?task_id={task_id}
Authorization: Bearer $MINIMAX_API_KEY
```

状态字段 `status`：`Preparing`、`Queueing`、`Processing`、`Success`、`Fail`。成功返回 `file_id`，不是直接视频 URL：

```json
{
  "task_id": "176843862716480",
  "status": "Success",
  "file_id": "176844028768320",
  "video_width": 1080,
  "video_height": 1920,
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```

再下载：

```http
GET https://api.minimax.cn/v1/files/retrieve?file_id={file_id}
Authorization: Bearer $MINIMAX_API_KEY
```

下载接口响应中的 `file.download_url` 为临时地址（精确有效期以返回/官方页为准），立即下载落盘。[来源](https://platform.minimax.cn/docs/api-reference/video-generation-download)

典型耗时约 1～5 分钟，建议 10 秒轮询。也可在创建时传 `callback_url`；MiniMax 会先 POST `challenge`，服务端必须 3 秒内原样返回，之后状态变化回调。

### 4.4 图片、价格、网络

- 首尾图支持公网 URL 或 **Base64 data URL**，例如 `data:image/jpeg;base64,...`。
- JPG/JPEG/PNG/WebP；小于 20MB；短边 >300px；宽高比 2:5～5:2；首尾尺寸不同会按首帧裁尾帧。[来源](https://platform.minimax.cn/docs/api-reference/video-generation-fl2v)
- 竖屏：首图使用 720×1280 或 1080×1920，尾图完全一致。
- 官方按次/分辨率/时长计费；当前价格页可能随 H3/Hailuo 系列调整。历史量级为 **数元人民币/6 秒**，1080P 高于 768P；首尾帧没有在 schema 中显示单独附加价。精确值必须从[价格页](https://platform.minimax.cn/docs/pricing/overview#视频)读取后录入配置。
- 中国大陆：`api.minimax.cn` 可直连。

---

## 5. 阿里云百炼：通义万相 2.7

官方入口：[万相 2.7 图生视频 API](https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference)、[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)、[错误码](https://help.aliyun.com/zh/model-studio/error-code)。

### 5.1 鉴权与地域

API Key Bearer 鉴权，创建任务必须额外带异步头：

```http
Authorization: Bearer $DASHSCOPE_API_KEY
Content-Type: application/json
X-DashScope-Async: enable
```

模型、API Key、Endpoint 必须属于同一地域。北京推荐业务空间专属域名：

```text
https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com
```

老域名 `https://dashscope.aliyuncs.com` 当前仍可用，但新项目优先专属域名。[来源](https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference)

### 5.2 创建任务

```http
POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis
```

```json
{
  "model": "wan2.7-i2v-2026-04-25",
  "input": {
    "prompt": "人物缓慢向镜头走近，衣摆随风摆动，镜头轻微推进，动作自然连续",
    "negative_prompt": "闪烁，变形，多余肢体，低清晰度",
    "media": [
      {
        "type": "first_frame",
        "url": "data:image/jpeg;base64,/9j/4AAQSk..."
      },
      {
        "type": "last_frame",
        "url": "data:image/jpeg;base64,/9j/4AAQSk..."
      }
    ]
  },
  "parameters": {
    "resolution": "720P",
    "duration": 5,
    "prompt_extend": false,
    "watermark": false,
    "seed": 123456
  }
}
```

字段：

- `model`：新版协议只支持 wan2.7；官方示例 `wan2.7-i2v-2026-04-25`，上线时从模型列表读取当前 ID。
- `input.prompt`：最多 5000 字符。
- `input.negative_prompt`：最多 500 字符。
- `input.media`：素材数组；首尾帧组合是 `first_frame` + `last_frame`。
- `media[].url`：HTTP(S)、百炼 OSS 临时 URL 或 data URL。
- `parameters.resolution`：`720P` / `1080P`，默认 1080P。
- `parameters.duration`：2～15 的整数，默认 5；**原生支持 4 和 5 秒**。
- `prompt_extend`：默认 `true`；作品分镜要忠实执行运镜时建议 `false` 后 A/B 测试。
- `watermark`：默认 `false`。
- `seed`：0～2147483647。

创建响应：

```json
{
  "output": {
    "task_status": "PENDING",
    "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx"
  },
  "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx"
}
```

任务 ID：`output.task_id`，查询有效期 24 小时。[来源](https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference)

### 5.3 查询与下载

```http
GET https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/tasks/{task_id}
Authorization: Bearer $DASHSCOPE_API_KEY
```

状态 `output.task_status`：`PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`CANCELED`、`UNKNOWN`。成功视频地址：`output.video_url`。

```json
{
  "output": {
    "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx",
    "task_status": "SUCCEEDED",
    "video_url": "https://.../output.mp4",
    "submit_time": "2026-11-03 12:00:00.000",
    "end_time": "2026-11-03 12:02:10.000"
  },
  "request_id": "..."
}
```

官方说明典型耗时 1～5 分钟，建议每 15 秒查询；查询接口默认 RPS 20。`task_id` 和成功链接均只保留 24 小时，立即下载。[来源](https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference)

### 5.4 图片、价格、网络

- 图片：HTTP/HTTPS 公网 URL、`oss://dashscope-instant/...` 临时 URL、或 `data:{MIME};base64,...`。
- 格式 JPEG/JPG/PNG（无透明通道）/BMP/WebP；宽高 240～8000px；宽高比 1:8～8:1；≤20MB。
- 画幅由首帧尽量保持；首尾图预处理为同一 9:16。
- 价格按秒和分辨率。模型价格页是唯一报价来源；预算可先按 **约 ¥1～¥5/5 秒**预留，1080P 高于 720P。官方页面未显示“首尾帧额外溢价”字段，但不能据此保证促销/账号价格一致。[价格来源](https://help.aliyun.com/zh/model-studio/model-pricing)
- 中国大陆：北京地域可直连，无需代理。

---

## 6. Vidu 原生 API

官方入口：[Vidu API 文档](https://platform.vidu.com/docs)、[API Reference](https://platform.vidu.com/docs/api-reference)、[价格](https://platform.vidu.com/pricing)。Vidu 文档为动态站，本次公开抓取未能稳定取得当前 start-end 页的完整 schema；以下只列已确认的产品能力，精确 endpoint/字段必须登录控制台后再做一次契约固化。

### 6.1 能力与鉴权

- 支持 start-end-to-video / 首尾帧生成，是 Vidu 的明确产品能力。
- Bearer API Key 鉴权：`Authorization: Bearer <VIDU_API_KEY>`。
- 中国大陆官方站和服务通常可直连。

### 6.2 原生接口接入模板（**待账号验证，不能直接上线**）

Vidu 不同 API 代际路径可能为 `/ent/v2/...`，且模型参数持续更新。本次未从可公开抓取的官方页面确认完整 URL，因此不在这里伪造 endpoint。实现时应从控制台 API Reference 复制：

```json
{
  "model": "<控制台列出的模型 ID>",
  "images": [
    "<首帧公网 URL 或官方允许的编码>",
    "<尾帧公网 URL 或官方允许的编码>"
  ],
  "prompt": "人物缓慢向前，镜头推进",
  "duration": 4,
  "resolution": "720p",
  "aspect_ratio": "9:16"
}
```

上面的字段名只是“需要映射的信息”，**不是已验证的原生请求 schema**。正式接入的验收项：创建 URL、模型 ID、首尾图字段、任务 ID 字段、状态枚举、视频 URL 字段、URL/Base64 限制和链接有效期。

若急需稳定 schema，可先走下节 fal.ai 的 Vidu Q1 聚合端点；其 OpenAPI 已公开可抓取。

### 6.3 时长、价格、网络

Vidu 不同模型常见 4/8 秒或 5 秒档，需按控制台模型确认。计费通常按 credits/次，现金量级约 **数元/条**，首尾帧与分辨率可能改变消耗；精确值以[官方价格页](https://platform.vidu.com/pricing)为准。国内一般直连；仍应在部署机做 DNS、TLS 和上传/下载测速。

---

## 7. 聚合平台

### 7.1 fal.ai：已验证的 Vidu Q1 首尾帧端点

官方 OpenAPI：[Vidu Q1 start-end schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/vidu/q1/start-end-to-video)、[模型页](https://fal.ai/models/fal-ai/vidu/q1/start-end-to-video/api)、[队列文档](https://fal.ai/docs/model-endpoints/queue)。

鉴权：

```http
Authorization: Key $FAL_KEY
Content-Type: application/json
```

创建：

```http
POST https://queue.fal.run/fal-ai/vidu/q1/start-end-to-video
```

```json
{
  "prompt": "人物从走廊尽头走到门前，镜头缓慢推进",
  "start_image_url": "https://cdn.example.com/shot-001-first.jpg",
  "end_image_url": "https://cdn.example.com/shot-001-last.jpg",
  "movement_amplitude": "medium",
  "seed": 123456
}
```

字段均来自 OpenAPI：`prompt` 最大 1500 字符；`start_image_url` / `end_image_url` 必填；`movement_amplitude` 为 `auto|small|medium|large`。该 endpoint schema **没有 duration/resolution/aspect_ratio 参数**，因此不能承诺严格 4/5 秒或 720/1080p；画幅由输入图决定。

创建返回：

```json
{
  "status": "IN_QUEUE",
  "request_id": "req_xxx",
  "status_url": "https://queue.fal.run/.../requests/req_xxx/status",
  "response_url": "https://queue.fal.run/.../requests/req_xxx",
  "cancel_url": "https://queue.fal.run/.../requests/req_xxx/cancel",
  "queue_position": 2
}
```

查询状态：

```http
GET https://queue.fal.run/fal-ai/vidu/q1/start-end-to-video/requests/{request_id}/status
Authorization: Key $FAL_KEY
```

状态：`IN_QUEUE`、`IN_PROGRESS`、`COMPLETED`。完成后再取结果：

```http
GET https://queue.fal.run/fal-ai/vidu/q1/start-end-to-video/requests/{request_id}
Authorization: Key $FAL_KEY
```

```json
{
  "video": {
    "url": "https://fal.media/files/.../output.mp4",
    "content_type": "video/mp4",
    "file_size": 4404019
  }
}
```

视频地址：`video.url`。图片 schema 明确为 URL；本地文件建议先用 fal storage 上传。直接把 data URL 放进 `*_image_url` 是否接受，OpenAPI 未承诺，不要依赖。

fal 按模型/计算量计费，模型页显示实时价格；预算量级通常为 **约 US$0.5～数美元/条**，不是固定价。大陆网络对 `fal.run`、Google Cloud 存储等链路不稳定，生产环境建议合规海外出口/代理并做断点下载。

### 7.2 硅基流动 SiliconFlow

官方入口：[视频提交 API](https://docs.siliconflow.cn/cn/api-reference/videos/videos_submit)、[视频状态 API](https://docs.siliconflow.cn/cn/api-reference/videos/videos_status)、[模型价格](https://cloud.siliconflow.cn/models)。

常见统一形态（字段随模型变化，必须按当前模型页核验）：

```http
POST https://api.siliconflow.cn/v1/video/submit
Authorization: Bearer $SILICONFLOW_API_KEY
Content-Type: application/json
```

```json
{
  "model": "Wan-AI/Wan2.2-I2V-A14B",
  "prompt": "人物缓慢向镜头走近",
  "image": "https://cdn.example.com/shot-001-first.jpg"
}
```

返回通常给 `requestId`；查询形态：

```http
POST https://api.siliconflow.cn/v1/video/status
Authorization: Bearer $SILICONFLOW_API_KEY
Content-Type: application/json

{"requestId":"..."}
```

本次官方文档链接返回结构未能完整抓取，**上面 endpoint、HTTP 方法、字段和状态值均须在账号控制台再验证后才能编码**。尤其不要假设所有路由都支持尾帧；公开 Wan I2V 路由通常只接受首帧。优势是大陆直连、人民币结算；价格以具体模型页为准，通常是数元/条量级。

### 7.3 302.AI

官方入口：[302.AI API 文档](https://doc.302.ai/)、[价格](https://302.ai/pricing)。302.AI 是多模型聚合，不存在一个能安全概括所有视频模型的统一首尾帧 schema：不同模型可能透传上游字段，也可能提供 OpenAI 风格包装。

接入原则：

1. 在 302 控制台选定**具体模型和具体 API 文档页**。
2. 把 endpoint、鉴权、请求、状态枚举和结果字段作为单独 adapter 固化。
3. 做一条首尾帧测试，确认尾帧确实生效，不能只凭参数被 HTTP 200 接收。
4. 记录 302 账单与上游模型版本；聚合平台可能无预告切换模型快照。

鉴权通常为 `Authorization: Bearer <API_KEY>`，但每个产品页为准。大陆可直连。价格是上游价加平台计费/汇率，5 秒量级从数元到数十元；本次未取得可验证的具体视频模型价格，标为**未验证**。

---

## 8. 价格量级对比（仅用于预算，不作为报价）

| 通道 | 5 秒预算量级 | 币种 | 首尾帧溢价 | 说明 |
|---|---:|---|---|---|
| Seedance 方舟 | ¥1～¥5 | CNY | 未发现稳定公开的独立溢价，未验证 | 模型/分辨率/音频影响大 |
| Kling | ¥2～¥10 | CNY/资源点 | 依模型/套餐，未验证 | `pro`、10 秒更贵 |
| MiniMax | 数元/6 秒 | CNY | 价格页未明确独立溢价 | 首尾帧最短 6 秒，不能直接按 5 秒算 |
| 万相 2.7 | ¥1～¥5 | CNY | 未见独立字段 | 按秒、分辨率计费 |
| Vidu | 数元/条 | CNY/credits | 依模型 | 4/8 秒档常见 |
| fal.ai | US$0.5～数美元 | USD | 已体现在 endpoint 价 | 另有汇率和网络成本 |
| 硅基流动/302 | 数元～数十元 | CNY | 依上游 | 聚合加价、模型快照需关注 |

**为什么不给伪精确的“¥x.xx/5 秒”：**这些平台在 2026 年频繁更新模型、促销价、资源包和区域价；部分价格页需登录并按账号显示。工程上应把单价写入配置表，并每天/每周由运营更新。上线前对每家实际创建 10 条相同规格任务，用账单差额计算真实单条成本。

---

## 9. 推荐组合方案

### 方案 A：万相 2.7 主通道 + Seedance 质量打样 + Kling 灾备（最推荐）

- 万相 2.7 原生支持 2～15 秒整数，完全覆盖 4/5 秒；首尾帧和 data URL 均有官方定义。
- Seedance 用于重点镜头、动作和画质 A/B 测试。
- Kling 作为第二供应商灾备，5 秒任务直接映射；4 秒需求生成 5 秒后裁切，但裁切前要评估尾帧约束损失。
- 全部中国大陆直连，结算与合规路径更顺。

### 方案 B：Seedance 主通道 + Kling 双供应商

- 两家成熟、行业生态强，先用 Seedance 打样，失败/审核/排队时切 Kling。
- 业务层只承诺 5 秒；若必须 4 秒，输出后裁切。
- 图片统一上传到自有 OSS/TOS，签名 URL 有效期至少 30 分钟。

### 方案 C：fal.ai 单聚合层（适合海外部署或快速 PoC）

- 一个 Key、统一队列模式，能快速切 Vidu/Kling/Seedance 等模型。
- 代价是大陆网络、美元结算、聚合加价和模型字段不统一；不能因为“统一平台”就假设参数统一。
- 国内生产建议保留至少一个原生厂商直连作为兜底。

---

## 10. 必须处理的坑

1. **4 秒并非通用值。**Kling 常见 5/10 秒，MiniMax 首尾帧 6/10 秒；只有万相 2.7 明确允许 2～15 秒整数。Adapter 要做能力校验，不能静默改时长。
2. **尾帧参数被接受不等于尾帧有效。**对每个模型做“明显不同的首尾帧”回归测试，并用最后 3 帧图像相似度检查。
3. **图片地址必须能被厂商服务器访问。**localhost、内网地址、短时签名 URL 会失败。建议自有对象存储；任务结束后按策略删除。
4. **首尾尺寸必须一致。**统一转为 sRGB、无透明通道、9:16、偶数宽高；建议 720×1280 起步。
5. **任务与结果 URL 会过期。**万相 task/link 24 小时；其他家也多为临时链接。成功后立即下载，校验 HTTP 状态、`Content-Type`、文件大小和 `ffprobe`。
6. **轮询不能过密。**5～15 秒 + 抖动 + 指数退避；服务重启后从数据库恢复未完成任务。
7. **超时不等于失败。**本地超时后不要直接重新创建，以免重复扣费；保留厂商 task ID 后台继续查。
8. **并发限制按账号变化。**区分“创建 QPS”“同时运行任务数”“查询 QPS”，收到 429 按 `Retry-After` 或退避处理。
9. **审核拦截。**真人、未成年人、暴力、色情、商标、政治人物等可能失败；保存厂商错误码，前端给可操作提示，不要无限重试。
10. **音频不是跨模型通用能力。**Seedance 的 `generate_audio`、万相 2.7 的音频能力和各模型计费不同；视频和配音最好先解耦。
11. **JWT 时钟偏差。**Kling 服务器验 `nbf/exp`，部署机要 NTP 对时。
12. **幂等与成本。**若厂商无幂等键，本地用 `shotId + 参数哈希` 防重复提交；参数变化则生成新版本。

---

## 11. 上线前最小验收清单

对每个拟接厂商执行并存档：

- 1 条首帧任务、1 条明显首尾变化任务、1 条 9:16 任务。
- URL 图片、data URL/Base64 各 1 条（官方不支持则记录跳过）。
- 4 秒、5 秒、720p、1080p 各自验证；不支持时 adapter 必须同步报错。
- 记录完整创建响应、轮询响应、状态流转、真实耗时、最终文件分辨率/时长/编码。
- 记录实际账单差额与失败任务是否计费。
- 人为制造错误 Key、坏 URL、超大图片、429、审核失败，验证错误映射。
- 断网/重启后确认任务能恢复轮询并下载。

## 12. 本次未完全验证的项目

- 方舟当前账号可见的完整 Seedance 模型 ID、各模型 `generate_audio` 支持矩阵、4 秒可用性和实时单价。
- 方舟成功响应中视频 URL 的最终层级，需用真实账号任务固定契约。
- Kling 当前模型列表、`image_tail` 在每个版本/模式下的可用性、Base64 大小限制和实时扣点。
- Vidu 原生当前完整 endpoint、字段、状态枚举、Base64 规则和实时价格；官方动态文档未能稳定抓取。
- 302.AI 和硅基流动中每个具体上游模型的首尾帧能力与统一状态 schema。
- 所有厂商的账号级并发限制与 SLA；这些通常只在控制台或商务合同中给出。

这些项不妨碍先建立 adapter 架构，但在取得真实 Key 后必须完成第 11 节的契约测试，才能标记为生产可用。

# Torso · 作品工作台

Torso（躯干）：一部作品的骨架——镜头、台词、首尾帧，都摆在一张画布上。

DeepSeek Harness 插件。侧边栏点「Torso」，中间是一张**画布式分镜台**：

- 每个作品 = 一个项目（一个 JSON 文件），里面是一串**镜头卡片**
- 每张卡片一件事：**镜头脚本**（镜号 / 景别 / 运镜 / 时长 / 台词 / 画面动作 / 备注）
- 每张卡片两个关键帧：**首帧**、**尾帧** —— 点「生成」直接调你配的图像模型出 9:16 竖图
- 每张卡片一条视频：提示词 + 视频渠道 → 调第三方视频 API 出片（支持首尾帧），完成后就地预览

## 安装

插件已经装进当前 DSH profile（`desktop`）。没看到时：

1. 重启 DSH 桌面版（替换已装包的 JS 需要重启才加载）
2. 侧边栏应出现「Torso」图标

### 从源码装到别的 profile

```bash
git clone https://github.com/apotordioere/TOOLS-FOR-IVAN.git
```

然后在 DSH 里让插件管理器安装这个**目录的绝对路径**（不是包名）：

```
plugin_manager { action: "install_bundle", target: "D:\\path\\to\\dsh-torso" }
```

装好后 `set_bundle` 停用再启用一次，让 `cordis.patch.yml` 里的配置生效。

## 配置渠道（右上角「渠道设置」）

### 图像渠道（任意 OpenAI 兼容网关）

| 字段 | 说明 |
| --- | --- |
| 名称 | 随便起，方便你认 |
| API 地址 | 完整地址，如 `https://api.example.com/v1`；也接受直接给到 `/images/generations` |
| 密钥 | 该网关的 API Key |
| 模型 | 如 `gpt-image-1`、`nano-banana`、`seedream-4.0` 等 |
| 尺寸 | 默认 `1024x1536`（9:16 方向），按你的模型支持改 |

请求按 OpenAI 标准 `POST {baseUrl}/images/generations`，优先取 `b64_json`，没有就下载 `url`。

> 已经预置了一条图像渠道 `image2`（`https://code28.ccwu.cc/v1` + `gpt-image-2` + `1024x1536`），**只差密钥**。
> 没填密钥直接点生成，会拿到 `401 Invalid token` —— 那不是插件坏了，是网关没认到 key。
> 密钥也支持放在环境变量 `IMAGE2_API_KEY` 里（插件会兜底读），不必存进 `设置.json`。

### 视频渠道

支持四种适配器：`ark`（火山方舟 Seedance）、`kling`（可灵）、`wan`（阿里云百炼通义万相）、`custom`（自己填模板，接海螺 / Vidu / 302.AI / fal 等长尾）。

- **ark**：`baseUrl=https://ark.cn-beijing.volces.com/api/v3`，`model=doubao-seedance-1-5-pro-251215`（或你开通的模型 id），首尾帧都支持
- **kling**：`apiKey` 填 `ak:sk`（冒号分隔），插件自己算 HS256 JWT
- **wan**：注意万相的参考图只认**公网可访问 URL**，本地素材会被拒绝
- **custom**：自己填模板，占位符 `{{prompt}} {{firstFrame}} {{lastFrame}} {{duration}} {{ratio}} {{model}} {{apiKey}} {{taskId}}`（值会按 JSON 字符串安全转义，prompt 里带引号也不会把请求体弄坏）：
  - 创建地址 `createUrl`、方法 `createMethod`（默认 POST）、请求体模板 `createBody`
  - 任务 id 路径 `taskIdPath`（如 `data.task_id`）
  - 查询地址 `queryUrl`（可含 `{{taskId}}`）、状态路径 `statusPath`、成功值 `successValues`（逗号分隔，默认 `succeeded,success,SUCCEEDED`）、失败值 `failValues`、视频地址路径 `videoPath`（默认 `content.video_url`）
  - 鉴权头 `authHeader`（默认 `Authorization`）、前缀 `authPrefix`（默认 `"Bearer "`）

密钥只存在本机 `设置.json` 里，不会上传。

## 数据存哪

默认 `D:\DESKTOP\DEEPSEEK专用\Torso\`：

```
设置.json
项目\<projectId>.json
素材\<projectId>\<shotId>-<first|last|video>-<时间戳>.<png|mp4>
```

写 JSON 走「临时文件 + rename」，不会写出半个文件。

## HTTP 接口（同源 `/api/torso`）

Agent / 脚本都能直接调，成功 `{ok:true,…}`，失败 HTTP 200 + `{ok:false,error}`：

```
GET  /ping
GET  /state?projectId=
GET  /project?id=
POST /project/create   {title}
POST /project/save     {project}
POST /project/delete   {id}
GET  /settings
POST /settings
POST /asset/upload     {projectId,shotId,slot,name,dataUrl}
GET  /asset?p=...
POST /generate/image   {channelId,projectId,shotId,slot,prompt,size}
POST /generate/video   {channelId,projectId,shotId,prompt,firstAsset,lastAsset,duration,ratio}
GET  /task?id=
```

生成任务不阻塞：立刻返回 `taskId`，客户端 2 秒轮一次 `/task`，服务端自己按 5 秒间隔问供应商（上限 20 分钟），出片后下载 mp4 落到 `素材\`。

## 已知限制（v0.1）

- 可灵官方文档是 JS 渲染，端点按公开实现写，**首次接入请小成本实测**
- 视频一旦开始生成，取消只在自定义适配器里做了 stub
- 不支持整本脚本批量导入，内容由「你口述 + Agent 写」直接落到镜头卡片里

## 目录

```
index.js                 入口：一条 prefix 路由 + 任务表 + 静态素材服务
src/store.js             项目/设置读写、原子写、路径穿越校验
src/image.js             OpenAI 兼容出图
src/video*.js            ark / kling / wan / custom 四个视频适配器
client/client.js         面板 UI（侧边栏图标 + 画布），单文件、无构建
locale/、icon.svg        显示名与图标
docs/接口契约.md          Host / Client / 数据格式的唯一规范
docs/视频API调研.md       各视频服务商接口与首尾帧支持对比
test/smoke-host.mjs      接口冒烟（假 ctx/req/res）
test/smoke-client.mjs    组件冒烟（假 React，把每个组件真渲染一遍）
```

### 自测

```bash
node test/smoke-host.mjs
node test/smoke-client.mjs
```

两个脚本都不需要浏览器、不需要真实密钥；改完代码先跑这两个，再刷新面板看效果。

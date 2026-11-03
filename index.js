import fs from 'node:fs'
import path from 'node:path'
import { createStore, makeAssetName } from './src/store.js'
import { generateImage } from './src/image.js'
import { getVideoAdapter } from './src/video.js'

export const name = 'dsh-torso'
export const inject = ['webServer']
const PREFIX = '/api/torso'
const TASK_TTL = 60 * 60 * 1000
const tasks = new Map()

function json(res, value) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}
function failure(error) { return { ok: false, error: error instanceof Error ? error.message : '处理请求时发生未知错误' } }
async function bodyJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
function clearTasks() {
  const cutoff = Date.now() - TASK_TTL
  for (const [id, task] of tasks) if (task.startedAt < cutoff) tasks.delete(id)
}
function newTask(kind) {
  clearTasks()
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const task = { id, kind, status: 'running', progress: '已提交，等待中', startedAt: Date.now(), result: null, error: '' }
  tasks.set(id, task)
  return task
}
function findChannel(settings, category, id) {
  const config = settings[category]
  return config?.channels?.find((item) => item.id === (id || config.defaultChannelId)) || null
}
function dataUrlBytes(dataUrl) {
  const match = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i.exec(dataUrl || '')
  if (!match) throw new Error('图片必须是 PNG、JPG 或 WebP 的 base64 Data URL')
  return { bytes: Buffer.from(match[2], 'base64'), ext: /^jpe?g$/i.test(match[1]) ? 'jpg' : match[1].toLowerCase() === 'webp' ? 'png' : 'png' }
}
function assetUrl(asset) { return `${PREFIX}/asset?p=${encodeURIComponent(asset)}` }

async function runImage(store, task, input, channel) {
  try {
    task.progress = '正在生成图片'
    const { bytes, ext } = await generateImage({ channel, prompt: input.prompt, size: input.size })
    const asset = store.saveAsset(input.projectId, makeAssetName(input.shotId, input.slot, ext), bytes, input.shotId, input.slot)
    task.status = 'done'; task.progress = '图片已生成'; task.result = { asset, url: assetUrl(asset) }
  } catch (error) { task.status = 'error'; task.error = error.message || '图片生成失败'; task.progress = '生成失败' }
}
async function runVideo(store, task, input, channel) {
  try {
    task.progress = '正在提交视频任务'
    const readFrame = (asset) => {
      if (!asset) return undefined
      const file = store.assetPath(asset)
      if (!fs.existsSync(file)) throw new Error('指定的参考帧素材不存在')
      const ext = path.extname(file).toLowerCase() === '.jpg' ? 'jpeg' : path.extname(file).slice(1) || 'png'
      return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`
    }
    const firstFrameDataUrl = readFrame(input.firstAsset)
    const lastFrameDataUrl = readFrame(input.lastAsset)
    const adapter = getVideoAdapter(channel)
    const { remoteTaskId } = await adapter.createVideoTask({ channel, prompt: input.prompt, firstFrameDataUrl, lastFrameDataUrl, firstAsset: input.firstAsset, lastAsset: input.lastAsset, duration: input.duration, ratio: input.ratio })
    task.remoteTaskId = remoteTaskId
    const deadline = Date.now() + 20 * 60 * 1000
    while (Date.now() < deadline) {
      task.progress = '视频生成中，正在等待供应商处理'
      await new Promise((resolve) => setTimeout(resolve, 5000))
      const result = await adapter.queryVideoTask({ channel, remoteTaskId })
      if (result.status === 'error') throw new Error(result.error || '视频任务失败')
      if (result.status !== 'done') continue
      if (!result.videoUrl) throw new Error('视频任务完成但没有返回视频地址')
      task.progress = '正在下载视频'
      const response = await fetch(result.videoUrl)
      if (!response.ok) throw new Error(`下载视频失败（${response.status}）`)
      const bytes = Buffer.from(await response.arrayBuffer())
      const asset = store.saveAsset(input.projectId, makeAssetName(input.shotId, 'video', 'mp4'), bytes, input.shotId, 'video')
      task.status = 'done'; task.progress = '视频已生成'; task.result = { asset, url: assetUrl(asset) }
      return
    }
    throw new Error('视频生成超过 20 分钟，已停止等待')
  } catch (error) { task.status = 'error'; task.error = error.message || '视频生成失败'; task.progress = '生成失败' }
}

export async function dispatch(req, res, store) {
  try {
    const url = new URL(req.url, 'http://localhost')
    const route = url.pathname.slice(PREFIX.length)
    const method = String(req.method || 'GET').toUpperCase()
    if (method === 'GET' && route === '/ping') return json(res, { ok: true, name, version: '0.1.0', root: store.root })
    if (method === 'GET' && route === '/state') {
      const projectId = url.searchParams.get('projectId')
      return json(res, { ok: true, projects: store.listProjects(), settings: store.readSettings(), project: projectId ? store.readProject(projectId) : null, root: store.root })
    }
    if (method === 'GET' && route === '/project') {
      const project = store.readProject(url.searchParams.get('id'))
      return json(res, project ? { ok: true, project } : { ok: false, error: '找不到该项目' })
    }
    if (method === 'POST' && route === '/project/create') return json(res, { ok: true, project: store.createProject((await bodyJson(req)).title) })
    if (method === 'POST' && route === '/project/save') {
      const updatedAt = store.saveProject((await bodyJson(req)).project)
      return json(res, { ok: true, updatedAt })
    }
    if (method === 'POST' && route === '/project/delete') { store.deleteProject((await bodyJson(req)).id); return json(res, { ok: true }) }
    if (method === 'GET' && route === '/settings') return json(res, { ok: true, settings: store.readSettings() })
    if (method === 'POST' && route === '/settings') { store.writeSettings((await bodyJson(req)).settings); return json(res, { ok: true }) }
    if (method === 'POST' && route === '/asset/upload') {
      const input = await bodyJson(req)
      const { bytes, ext } = dataUrlBytes(input.dataUrl)
      const requestedExt = path.extname(String(input.name || '')).slice(1).toLowerCase()
      const finalExt = requestedExt === 'jpg' || requestedExt === 'jpeg' ? 'jpg' : ext
      const asset = store.saveAsset(input.projectId, makeAssetName(input.shotId, input.slot, finalExt), bytes, input.shotId, input.slot)
      return json(res, { ok: true, asset, url: assetUrl(asset) })
    }
    if (method === 'GET' && route === '/asset') return serveAsset(req, res, store, url.searchParams.get('p'))
    if (method === 'POST' && (route === '/generate/image' || route === '/generate/video')) {
      const input = await bodyJson(req)
      const settings = store.readSettings()
      const category = route.endsWith('/image') ? 'image' : 'video'
      const channel = findChannel(settings, category, input.channelId)
      if (!channel) return json(res, failure(new Error(category === 'image' ? '先去设置里加一个图像渠道' : '先去设置里加一个视频渠道')))
      if (!input.projectId || !input.shotId || !String(input.prompt || '').trim()) return json(res, failure(new Error('缺少项目、镜头或提示词')))
      const task = newTask(category)
      if (category === 'image') void runImage(store, task, input, channel)
      else void runVideo(store, task, input, channel)
      return json(res, { ok: true, taskId: task.id })
    }
    if (method === 'GET' && route === '/task') {
      clearTasks()
      const task = tasks.get(url.searchParams.get('id'))
      return json(res, task ? { ok: true, task } : { ok: false, error: '找不到该生成任务' })
    }
    return json(res, { ok: false, error: '找不到该接口' })
  } catch (error) {
    try { return json(res, failure(error)) } catch { try { res.end() } catch {} }
  }
}

function serveAsset(req, res, store, relative) {
  try {
    const file = store.assetPath(relative)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, { ok: false, error: '找不到该素材' })
    const size = fs.statSync(file).size
    const ext = path.extname(file).toLowerCase()
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' }
    const headers = { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' }
    const range = req.headers?.range
    if (range && ext === '.mp4') {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end() }
      const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
      const end = match[2] && match[1] ? Math.min(Number(match[2]), size - 1) : size - 1
      if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end() }
      res.writeHead(206, { ...headers, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}` })
      return fs.createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, { ...headers, 'content-length': size })
    return fs.createReadStream(file).pipe(res)
  } catch (error) { return json(res, failure(error)) }
}

export function apply(ctx, config = {}) {
  const store = createStore(ctx, config)
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler: (req, res) => { void dispatch(req, res, store) } }), 'torso: api')
}

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export const DEFAULT_SETTINGS = {
  // 首次使用时先给一个填好的 image2 网关（用户 profile 里已有这个 provider），
  // 只差密钥：密钥留空，出图时回退读环境变量 IMAGE2_API_KEY，不落盘。
  image: {
    channels: [{ id: 'image2', name: 'image2', baseUrl: 'https://code28.ccwu.cc/v1', apiKey: '', model: 'gpt-image-2', size: '1024x1536' }],
    defaultChannelId: 'image2',
  },
  video: { channels: [], defaultChannelId: '' },
}

const validId = (id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)
const clone = (value) => JSON.parse(JSON.stringify(value))

export function createStore(ctx, config = {}) {
  let root
  try {
    const wd = ctx.get('workingDirectory')?.defaultDirectory
    root = config.root || (wd ? path.join(wd, 'Torso') : path.join(os.homedir(), '.dsh-torso'))
  } catch {
    root = config.root || path.join(os.homedir(), '.dsh-torso')
  }
  // 统一成绝对路径（配置里常写正斜杠，和 path.join 拼出来的反斜杠混用会让
  // assetPath 的前缀校验误判为越界），并去掉尾部分隔符。
  root = path.resolve(root)
  while (root.length > 3 && (root.endsWith(path.sep) || root.endsWith('/'))) root = root.slice(0, -1)
  const ensure = (dir = root) => fs.mkdirSync(dir, { recursive: true })
  const atomicWrite = (file, value) => {
    ensure(path.dirname(file))
    const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
    fs.renameSync(tmp, file)
  }
  const projectFile = (id) => {
    if (!validId(id)) throw new Error('项目编号无效')
    return path.join(root, '项目', `${id}.json`)
  }
  const readProject = (id) => {
    const file = projectFile(id)
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  const listProjects = () => {
    const dir = path.join(root, '项目')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((name) => /^[a-z0-9-]+\.json$/.test(name)).map((name) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
        const cover = p.shots?.find((s) => s.first?.asset)?.first.asset || ''
        return { id: p.id, title: p.title, updatedAt: p.updatedAt, shotCount: p.shots?.length || 0, cover }
      } catch { return null }
    }).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt)
  }
  const settingsFile = path.join(root, '设置.json')
  return {
    root, ensure,
    readSettings() {
      ensure()
      if (!fs.existsSync(settingsFile)) return clone(DEFAULT_SETTINGS)
      const value = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
      return { ...clone(DEFAULT_SETTINGS), ...value, image: { ...clone(DEFAULT_SETTINGS.image), ...value.image }, video: { ...clone(DEFAULT_SETTINGS.video), ...value.video } }
    },
    writeSettings(settings) { if (!settings || typeof settings !== 'object') throw new Error('设置内容无效'); atomicWrite(settingsFile, settings) },
    readProject, listProjects,
    createProject(title) {
      const now = Date.now()
      const id = `p-${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(2).toString('hex')}`
      const shotId = `s-${crypto.randomBytes(3).toString('hex')}-0001`
      const project = { id, title: typeof title === 'string' && title.trim() ? title.trim() : '未命名作品', createdAt: now, updatedAt: now, meta: { ratio: '1080x1920', style: '', logline: '' }, shots: [{ id: shotId, no: '1-1', ep: 1, size: '中景', move: '固定', duration: 5, dialogue: '', action: '', note: '', first: { prompt: '', status: 'idle', asset: '', error: '' }, last: { prompt: '', status: 'idle', asset: '', error: '' }, video: { prompt: '', status: 'idle', asset: '', error: '', channelId: '', remoteTaskId: '' }, pos: null }] }
      atomicWrite(projectFile(id), project)
      return project
    },
    saveProject(project) {
      if (!project || !validId(project.id)) throw new Error('项目内容或编号无效')
      const updatedAt = Date.now()
      atomicWrite(projectFile(project.id), { ...project, updatedAt })
      return updatedAt
    },
    deleteProject(id) { const file = projectFile(id); if (fs.existsSync(file)) fs.unlinkSync(file) },
    assetPath(relative) {
      if (typeof relative !== 'string' || !relative) throw new Error('素材路径无效')
      const target = path.resolve(root, relative.replace(/[\\/]/g, path.sep))
      if (target !== root && !target.startsWith(root + path.sep)) throw new Error('素材路径无效')
      return target
    },
    saveAsset(projectId, filename, data, shotId, slot) {
      if (!validId(projectId) || !/^[a-z0-9-]+-(first|last|video)-\d+\.(png|jpg|mp4|webm)$/i.test(filename) || (shotId && !filename.startsWith(`${shotId}-${slot}-`))) throw new Error('素材名称无效')
      const rel = `素材/${projectId}/${filename}`
      const file = this.assetPath(rel)
      ensure(path.dirname(file)); fs.writeFileSync(file, data)
      return rel
    },
  }
}

export function makeAssetName(shotId, slot, ext) {
  if (!/^[a-z0-9-]+$/i.test(shotId) || !['first', 'last', 'video'].includes(slot) || !['png', 'jpg', 'mp4', 'webm'].includes(ext)) throw new Error('素材信息无效')
  return `${shotId}-${slot}-${Date.now()}.${ext}`
}

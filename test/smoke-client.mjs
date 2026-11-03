// 客户端无浏览器冒烟：跑一遍 client.js 的 factory，再把每个组件用假 React 真渲染一次，
// 抓「模块加载/注册都不报错、真正渲染才炸」的 ReferenceError。
// 做法：在内存里给源码补一句 window.__probe = {...}（只在测试时，不改磁盘文件）。
import fs from 'node:fs'
import path from 'node:path'

const file = path.join(import.meta.dirname, '..', 'client', 'client.js')
let code = fs.readFileSync(file, 'utf8')

const marker = "    return { name: 'dsh-torso', inject: ['slots'], apply }"
if (!code.includes(marker)) throw new Error('client.js 的 factory 返回语句变了，冒烟脚本要同步改')
code = code.replace(
  marker,
  '    window.__probe = { SidebarIcon, Studio, ShotCard, FrameThumb, Inspector, ChannelFields, SettingsModal }\n' + marker,
)

let loaded = null
const window = { __ModuleLoader__: { load: (m) => { loaded = m } } }
const document = { createElement: () => ({ set textContent(v) {}, remove() {} }), head: { appendChild() {} } }
new Function('window', 'document', code)(window, document)

if (!loaded) throw new Error('client.js 没有调用 __ModuleLoader__.load')
if (loaded.id !== 'dsh-torso') throw new Error('ModuleLoader id 与包名不一致：' + loaded.id)
console.log('load id =', loaded.id)

const React = {
  Fragment: 'Fragment',
  createElement(type, props, ...children) { return { type, props: props || {}, children } },
  useState(v) { return [typeof v === 'function' ? v() : v, () => {}] },
  useEffect() {}, useLayoutEffect() {}, useMemo(fn) { return fn() },
  useCallback(fn) { return fn }, useRef(v) { return { current: v === undefined ? null : v } },
  createContext: (v) => ({ Provider: 'Provider', value: v }), useContext: () => ({}),
}
const mod = loaded.factory((name) => { if (name === 'react') return React; throw new Error('unexpected require: ' + name) })
if (mod.name !== 'dsh-torso') throw new Error('exports.name 不对')
if (!Array.isArray(mod.inject) || !mod.inject.includes('slots')) throw new Error('exports.inject 缺失 slots')

const components = []
const ctx = {
  effect(fn) { const dispose = fn(); if (typeof dispose !== 'function') throw new Error('ctx.effect 没返回清理函数') },
  slots: {
    inject(name, factory) { if (typeof factory === 'function') factory(); return { name } },
    register(spec, component) { components.push({ spec, component }); return {} },
  },
}
mod.apply(ctx)
console.log('registered:', components.map((c) => `${c.component.name}(${c.spec.id || c.spec.key})`).join(', '))
const probe = window.__probe
if (!probe) throw new Error('拿不到组件：client.js 结构变了')

const noop = () => {}
const settings = {
  image: {
    channels: [{ id: 'image2', name: 'image2', baseUrl: 'https://code28.ccwu.cc/v1', apiKey: 'sk-test', model: 'gpt-image-2', size: '1024x1536' }],
    defaultChannelId: 'image2',
  },
  video: {
    channels: [{ id: 'v1', name: 'ark 演示', provider: 'ark', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', apiKey: 'k', model: 'doubao-seedance-1-5-pro-251215', ratio: 'adaptive', resolution: '720p', duration: 5, audio: true, custom: {} }],
    defaultChannelId: 'v1',
  },
}
const emptySettings = { image: { channels: [], defaultChannelId: '' }, video: { channels: [], defaultChannelId: '' } }
const mkShot = (patch = {}) => ({
  id: 's-1-1', no: '1-1', ep: 1, size: '中景', move: '固定', duration: 5, dialogue: '先别卖，等我回来。',
  action: '雨夜，他背过身去。', note: '参考上一场的灯位',
  first: { prompt: '雨夜街头，背身男青年，湿发', status: 'idle', asset: '', error: '' },
  last: { prompt: '', status: 'idle', asset: '', error: '' },
  video: { prompt: '', status: 'idle', asset: '', error: '', channelId: '', remoteTaskId: '' },
  pos: { x: 40, y: 40 }, ...patch,
})
const shot = mkShot()
const cases = [
  ['SidebarIcon-未选中', 'SidebarIcon', { size: 18, active: false }],
  ['SidebarIcon-选中', 'SidebarIcon', { size: 20, active: true }],
  ['FrameThumb-空', 'FrameThumb', { label: '首帧', item: shot.first, onGenerate: noop }],
  ['FrameThumb-错误', 'FrameThumb', { label: '尾帧', item: { status: 'error', asset: '', error: '401 Invalid token' }, onGenerate: noop }],
  ['FrameThumb-完成', 'FrameThumb', { label: '首帧', item: { status: 'done', asset: '素材/x/s.png', error: '' }, onGenerate: noop }],
  ['ShotCard-普通', 'ShotCard', { shot, selected: false, onSelect: noop, onDragStart: noop, onQuickGenerate: noop }],
  ['ShotCard-选中+跑图', 'ShotCard', { shot: mkShot({ first: { ...shot.first, status: 'running' } }), selected: true, onSelect: noop, onDragStart: noop, onQuickGenerate: noop }],
  ['ShotCard-空文案', 'ShotCard', { shot: mkShot({ dialogue: '', action: '', note: '' }), selected: false, onSelect: noop, onDragStart: noop, onQuickGenerate: noop }],
  ['Inspector', 'Inspector', { shot, settings, patchShot: noop, generate: noop, importFile: noop, deleteShot: noop, notify: noop }],
  ['Inspector-无渠道', 'Inspector', { shot, settings: emptySettings, patchShot: noop, generate: noop, importFile: noop, deleteShot: noop, notify: noop }],
  ['ChannelFields-图像', 'ChannelFields', { channel: settings.image.channels[0], kind: 'image', update: noop }],
  ['ChannelFields-视频', 'ChannelFields', { channel: settings.video.channels[0], kind: 'video', update: noop }],
  ['SettingsModal', 'SettingsModal', { settings, onClose: noop, onSave: noop, toast: noop }],
  ['Studio', 'Studio', {}],
]

let failed = 0
function walk(el, depth, visit) {
  if (!el || typeof el !== 'object' || depth > 8) return
  if (Array.isArray(el)) return el.forEach((e) => walk(e, depth, visit))
  if (typeof el.type === 'function') visit(el)
  walk(el.children, depth + 1, visit)
}
for (const [name, compName, props] of cases) {
  const component = probe[compName]
  if (typeof component !== 'function') { console.error(`SKIP ${name}: 没有组件 ${compName}`); continue }
  const seen = new Set()
  try {
    const el = React.createElement(component, props)
    walk(el, 0, (node) => {
      const n = node.type.name || 'anon'
      if (seen.has(n)) return
      seen.add(n)
      node.type(node.props) // 真渲染子组件（hook 返回初值）
    })
    console.log(`ok   ${name} -> ${[...seen].join(',') || '(只有自身)'}`)
  } catch (error) {
    failed++
    console.error(`FAIL ${name} -> ${error.message}`)
    console.error((error.stack || '').split('\n').slice(1, 4).join('\n'))
  }
}

// 事件处理器点一遍：明显 ReferenceError 才算失败（依赖真实 DOM 的报错忽略）
function clickAll(el, label, depth = 0) {
  if (!el || typeof el !== 'object' || depth > 8) return
  if (Array.isArray(el)) return el.forEach((e) => clickAll(e, label, depth))
  const ev = {
    preventDefault: noop, stopPropagation: noop, clientX: 10, clientY: 10, deltaY: -100,
    target: { value: 'x', files: [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 480 }) },
    currentTarget: { value: 'x', getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 480 }) },
  }
  for (const [k, v] of Object.entries(el.props || {})) {
    if (/^on[A-Z]/.test(k) && typeof v === 'function') {
      try { v(ev) } catch (error) {
        if (error instanceof ReferenceError) { failed++; console.error(`FAIL handler ${label}.${k} -> ${error.message}`) }
      }
    }
  }
  clickAll(el.children, label, depth + 1)
}
for (const [name, compName, props] of cases) {
  const component = probe[compName]
  if (typeof component !== 'function') continue
  try { clickAll(React.createElement(component, props), name) } catch (error) { failed++; console.error(`FAIL click ${name} -> ${error.message}`) }
}

console.log(failed ? `\n${failed} 处失败` : '\n全部通过')
process.exit(failed ? 1 : 0)


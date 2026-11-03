import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dispatch, apply } from '../index.js'
import { createStore } from '../src/store.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'torso-smoke-'))
const ctx = {
  get(key) { return key === 'workingDirectory' ? { defaultDirectory: root } : undefined },
  webServer: { register(route) { this.route = route; return () => { this.route = null } } },
  effect(fn) { this.dispose = fn() },
}
apply(ctx)
assert.equal(ctx.webServer.route.kind, 'prefix')
assert.equal(ctx.webServer.route.path, '/api/torso')
const store = createStore({ get: (key) => key === 'workingDirectory' ? { defaultDirectory: root } : undefined })
async function call(method, url, body, headers = {}) {
  const req = { method, url, headers, body }
  const res = {
    headers: {}, status: 0, chunks: [],
    writeHead(status, value) { this.status = status; this.headers = value },
    end(value) { if (value) this.chunks.push(Buffer.from(value)); this.ended = true },
  }
  await dispatch(req, res, store)
  return { res, data: res.chunks.length ? JSON.parse(Buffer.concat(res.chunks).toString()) : null }
}
const ping = await call('GET', '/api/torso/ping')
assert.equal(ping.data.ok, true); assert.equal(ping.data.name, 'dsh-torso')
const created = await call('POST', '/api/torso/project/create', { title: '冒烟项目' })
assert.equal(created.data.ok, true)
const project = created.data.project
const saved = await call('POST', '/api/torso/project/save', { project: { ...project, title: '已保存' } })
assert.equal(saved.data.ok, true); assert.ok(saved.data.updatedAt)
const state = await call('GET', `/api/torso/state?projectId=${project.id}`)
assert.equal(state.data.ok, true); assert.equal(state.data.project.title, '已保存')
const settings = { image: { channels: [{ id: 'test', model: 'm', baseUrl: 'http://invalid', apiKey: '' }], defaultChannelId: 'test' }, video: { channels: [], defaultChannelId: '' } }
assert.equal((await call('POST', '/api/torso/settings', { settings })).data.ok, true)
assert.equal((await call('GET', '/api/torso/settings')).data.settings.image.defaultChannelId, 'test')
const traversal = await call('GET', '/api/torso/asset?p=..%2Foutside.txt')
assert.equal(traversal.data.ok, false); assert.match(traversal.data.error, /路径无效/)
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'torso-empty-'))
const noChannelStore = createStore({ get: (key) => key === 'workingDirectory' ? { defaultDirectory: empty } : undefined })
// 默认设置里预置了 image2 渠道；这里显式写一份空渠道，才是真正的「用户还没配」
noChannelStore.writeSettings({ image: { channels: [], defaultChannelId: '' }, video: { channels: [], defaultChannelId: '' } })
const noChannelRes = { writeHead(status, headers) { this.status = status; this.headers = headers }, end(value) { this.data = JSON.parse(value) } }
await dispatch({ method: 'POST', url: '/api/torso/generate/image', body: { projectId: project.id, shotId: project.shots[0].id, slot: 'first', prompt: 'test' } }, noChannelRes, noChannelStore)
const noChannelResult = noChannelRes.data
assert.equal(noChannelResult.ok, false); assert.match(noChannelResult.error, /图像渠道/)
console.log('PASS /ping; /project/create; /project/save; /state; /settings write/read; /asset traversal blocked; /generate/image without channel returns ok:false')
fs.rmSync(root, { recursive: true, force: true })
fs.rmSync(empty, { recursive: true, force: true })


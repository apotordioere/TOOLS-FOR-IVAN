import { createHmac } from 'node:crypto'
import { requestJson } from './video-common.js'
const BASE = 'https://api-beijing.klingai.com'
function jwt(channel) {
  const [access, inlineSecret] = String(channel.apiKey || '').split(':', 2)
  const secret = inlineSecret || channel.custom?.secretKey
  if (!access || !secret) throw new Error('可灵鉴权缺少密钥；请填写 ak:sk 或在 custom.secretKey 配置 secretKey')
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const head = enc({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const body = enc({ iss: access, exp: now + 1800, nbf: now - 5 })
  const input = `${head}.${body}`
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`
}
export function createKlingAdapter() {
  return {
    async createVideoTask({ channel, prompt, firstFrameDataUrl, lastFrameDataUrl, duration, ratio }) {
      if (!firstFrameDataUrl) throw new Error('可灵视频生成需要首帧图片')
      const body = { model_name: channel.model, image: firstFrameDataUrl, prompt, negative_prompt: '', cfg_scale: 0.5, mode: 'std', duration: String(duration || channel.duration || 5), aspect_ratio: ratio || channel.ratio || '9:16' }
      if (lastFrameDataUrl) body.image_tail = lastFrameDataUrl
      const r = await requestJson(`${(channel.baseUrl || BASE).replace(/\/+$/, '')}/v1/videos/image2video`, { method: 'POST', headers: { authorization: `Bearer ${jwt(channel)}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (r.code !== 0) throw new Error(`可灵创建任务失败：${r.message || r.code}`)
      if (!r.data?.task_id) throw new Error('可灵未返回任务编号')
      return { remoteTaskId: r.data.task_id }
    },
    async queryVideoTask({ channel, remoteTaskId }) {
      const r = await requestJson(`${(channel.baseUrl || BASE).replace(/\/+$/, '')}/v1/videos/image2video/${encodeURIComponent(remoteTaskId)}`, { headers: { authorization: `Bearer ${jwt(channel)}` } })
      const status = String(r.data?.task_status || '').toLowerCase()
      if (status === 'succeed') return { status: 'done', videoUrl: r.data?.task_result?.videos?.[0]?.url }
      if (status === 'failed') return { status: 'error', error: '可灵视频任务失败' }
      return { status: 'running' }
    },
  }
}

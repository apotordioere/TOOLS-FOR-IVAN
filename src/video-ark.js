import { requestJson, authHeaders } from './video-common.js'
const BASE = 'https://ark.cn-beijing.volces.com/api/v3'
export function createArkAdapter() {
  return {
    async createVideoTask({ channel, prompt, firstFrameDataUrl, lastFrameDataUrl, duration, ratio }) {
      if (!firstFrameDataUrl) throw new Error('ark 视频生成需要首帧图片')
      const content = [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: firstFrameDataUrl }, role: 'first_frame' }]
      if (lastFrameDataUrl) content.push({ type: 'image_url', image_url: { url: lastFrameDataUrl }, role: 'last_frame' })
      const result = await requestJson(`${(channel.baseUrl || BASE).replace(/\/+$/, '')}/contents/generations/tasks`, { method: 'POST', headers: authHeaders(channel), body: JSON.stringify({ model: channel.model, content, ratio: ratio || channel.ratio || 'adaptive', duration: duration || channel.duration || 5, resolution: channel.resolution || '720p' }) })
      if (!result.id) throw new Error('ark 未返回任务编号')
      return { remoteTaskId: result.id }
    },
    async queryVideoTask({ channel, remoteTaskId }) {
      const r = await requestJson(`${(channel.baseUrl || BASE).replace(/\/+$/, '')}/contents/generations/tasks/${encodeURIComponent(remoteTaskId)}`, { headers: authHeaders(channel) })
      const status = String(r.status || '').toLowerCase()
      if (status === 'succeeded') return { status: 'done', videoUrl: r.content?.video_url }
      if (['failed', 'expired', 'cancelled'].includes(status)) return { status: 'error', error: `ark 任务状态：${status}` }
      return { status: 'running' }
    },
  }
}

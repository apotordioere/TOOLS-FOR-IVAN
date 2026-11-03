import { requestJson, authHeaders } from './video-common.js'
const BASE = 'https://dashscope.aliyuncs.com'
export function createWanAdapter() {
  return {
    async createVideoTask({ channel, prompt, firstAsset, duration }) {
      if (!firstAsset || /^data:/i.test(firstAsset) || !/^https?:\/\//i.test(firstAsset)) throw new Error('wan 只接受公网首帧 URL；请改用 ark/kling 或自建图床')
      const base = (channel.baseUrl || BASE).replace(/\/+$/, '')
      const r = await requestJson(`${base}/api/v1/services/aigc/video-generation/video-synthesis`, { method: 'POST', headers: { ...authHeaders(channel), 'X-DashScope-Async': 'enable' }, body: JSON.stringify({ model: channel.model, input: { prompt, img_url: firstAsset }, parameters: { resolution: channel.resolution || '720P', duration: duration || channel.duration || 5 } }) })
      if (!r.output?.task_id) throw new Error('wan 未返回任务编号')
      return { remoteTaskId: r.output.task_id }
    },
    async queryVideoTask({ channel, remoteTaskId }) {
      const r = await requestJson(`${(channel.baseUrl || BASE).replace(/\/+$/, '')}/api/v1/tasks/${encodeURIComponent(remoteTaskId)}`, { headers: authHeaders(channel) })
      const status = String(r.output?.task_status || '').toUpperCase()
      if (status === 'SUCCEEDED') return { status: 'done', videoUrl: r.output?.video_url }
      if (['FAILED', 'CANCELED'].includes(status)) return { status: 'error', error: `wan 任务状态：${status}` }
      return { status: 'running' }
    },
  }
}

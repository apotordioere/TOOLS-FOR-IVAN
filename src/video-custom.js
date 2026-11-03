import { requestJson, authHeaders, getPath } from './video-common.js'
function replaceTemplate(source, values) {
  return source.replace(/\{\{(prompt|firstFrame|lastFrame|duration|ratio|model|apiKey|taskId)\}\}/g, (_, key) => JSON.stringify(String(values[key] ?? '')).slice(1, -1))
}
export function createCustomAdapter() {
  return {
    async createVideoTask({ channel, prompt, firstFrameDataUrl, lastFrameDataUrl, duration, ratio }) {
      const c = channel.custom || {}
      if (!c.createUrl || !c.createBody) throw new Error('custom 视频渠道缺少创建 URL 或请求模板')
      const values = { prompt, firstFrame: firstFrameDataUrl || '', lastFrame: lastFrameDataUrl || '', duration: duration || channel.duration || 5, ratio: ratio || channel.ratio || 'adaptive', model: channel.model }
      const url = replaceTemplate(c.createUrl, { ...values, apiKey: channel.apiKey })
      const headers = { ...authHeaders(channel), [c.authHeader || 'Authorization']: `${c.authPrefix ?? 'Bearer '}${channel.apiKey || ''}` }
      const body = replaceTemplate(c.createBody, values)
      const r = await requestJson(url, { method: c.createMethod || 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: (c.createMethod || 'POST').toUpperCase() === 'GET' ? undefined : body })
      const id = getPath(r, c.taskIdPath || 'id')
      if (id == null) throw new Error('custom 响应中未找到任务编号')
      return { remoteTaskId: String(id) }
    },
    async queryVideoTask({ channel, remoteTaskId }) {
      const c = channel.custom || {}
      if (!c.queryUrl) throw new Error('custom 视频渠道缺少查询 URL')
      const url = replaceTemplate(c.queryUrl, { taskId: encodeURIComponent(remoteTaskId), model: channel.model, apiKey: channel.apiKey })
      const r = await requestJson(url, { headers: authHeaders(channel) })
      const status = String(getPath(r, c.statusPath || 'status') ?? '')
      const eq = (list) => String(list || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).includes(status.toLowerCase())
      if (eq(c.successValues || 'succeeded,success,SUCCEEDED')) {
        const videoUrl = getPath(r, c.videoPath || 'content.video_url')
        if (!videoUrl) return { status: 'error', error: 'custom 任务成功但响应中没有视频地址' }
        return { status: 'done', videoUrl }
      }
      if (eq(c.failValues || 'failed,error,FAILED,expired')) return { status: 'error', error: `custom 任务状态：${status}` }
      return { status: 'running' }
    },
  }
}

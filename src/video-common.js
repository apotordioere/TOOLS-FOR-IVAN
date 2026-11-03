export function authHeaders(channel) {
  const h = { 'content-type': 'application/json' }
  if (channel.apiKey) h.authorization = `Bearer ${channel.apiKey}`
  return h
}
export async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let value
  try { value = text ? JSON.parse(text) : {} } catch { value = null }
  if (!response.ok) throw new Error(`视频服务请求失败（${response.status}）：${text.slice(0, 300)}`)
  if (!value) throw new Error(`视频服务返回内容无法解析：${text.slice(0, 300)}`)
  return value
}
export function getPath(object, dotted) {
  return String(dotted || '').split('.').filter(Boolean).reduce((value, key) => value?.[key], object)
}

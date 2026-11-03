import { makeAssetName } from './store.js'

function imageUrl(channel) {
  const base = String(channel.baseUrl || '').replace(/\/+$/, '')
  return /\/images\/generations$/i.test(base) ? base : `${base}/images/generations`
}

export async function generateImage({ channel, prompt, size }) {
  if (!channel?.baseUrl || !channel.model) throw new Error('图像渠道缺少 API 地址或模型')
  const headers = { 'content-type': 'application/json' }
  // 渠道没填密钥时，回退读宿主环境变量（用户 profile 里 image2 provider 用的就是它）
  const apiKey = channel.apiKey || process.env.IMAGE2_API_KEY || ''
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  const url = imageUrl(channel)
  let response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: channel.model, prompt, n: 1, size: size || channel.size || '1024x1536', response_format: 'b64_json' }) })
  let text = await response.text()
  if (!response.ok && response.status >= 400 && response.status < 500 && /response_format/i.test(text)) {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: channel.model, prompt, n: 1, size: size || channel.size || '1024x1536' }) })
    text = await response.text()
  }
  if (!response.ok) throw new Error(`图像服务请求失败（${response.status}）：${text.slice(0, 300)}`)
  let data
  try { data = JSON.parse(text)?.data?.[0] } catch { throw new Error(`图像服务返回内容无法解析：${text.slice(0, 300)}`) }
  if (data?.b64_json) return { bytes: Buffer.from(data.b64_json, 'base64'), ext: 'png' }
  if (data?.url) {
    const imageResponse = await fetch(data.url)
    if (!imageResponse.ok) throw new Error(`下载生成图片失败（${imageResponse.status}）`)
    const bytes = Buffer.from(await imageResponse.arrayBuffer())
    const type = imageResponse.headers.get('content-type') || ''
    return { bytes, ext: /jpe?g/i.test(type) || /\.jpe?g(?:\?|$)/i.test(data.url) ? 'jpg' : 'png' }
  }
  throw new Error(`图像服务未返回图片：${text.slice(0, 300)}`)
}

export function imageAssetName(shotId, ext) { return makeAssetName(shotId, 'first', ext) }

import { createArkAdapter } from './video-ark.js'
import { createKlingAdapter } from './video-kling.js'
import { createWanAdapter } from './video-wan.js'
import { createCustomAdapter } from './video-custom.js'

const adapters = { ark: createArkAdapter, kling: createKlingAdapter, wan: createWanAdapter, custom: createCustomAdapter }
export function getVideoAdapter(channel) {
  const factory = adapters[channel?.provider]
  if (!factory) throw new Error('不支持的视频供应商')
  return factory()
}

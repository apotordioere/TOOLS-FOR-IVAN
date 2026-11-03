window.__ModuleLoader__.load({
  id: 'dsh-torso',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useMemo, useCallback } = React

    const API = '/api/torso'
    const sizes = ['大远景', '远景', '全景', '中景', '中近景', '近景', '特写', '大特写']
    const moves = ['固定', '推', '拉', '摇', '移', '跟', '升降', '环绕']
    const initialSettings = { image: { channels: [], defaultChannelId: '' }, video: { channels: [], defaultChannelId: '' } }

    function request(path, options) {
      return fetch(API + path, { cache: 'no-store', ...options }).then(async (res) => {
        if (path.startsWith('/asset?')) {
          if (!res.ok) throw new Error(`素材读取失败 (${res.status})`)
          return res
        }
        let body
        try { body = await res.json() } catch { throw new Error(`接口返回无法解析 (${res.status})`) }
        if (!body || body.ok !== true) throw new Error(body && body.error ? String(body.error) : `接口请求失败 (${res.status})`)
        return body
      })
    }
    const post = (path, value) => request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) })
    const assetUrl = (asset) => asset ? `${API}/asset?p=${encodeURIComponent(asset)}` : ''
    const newShot = (n) => ({ id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, no: `1-${n}`, ep: 1, size: '中景', move: '固定', duration: 5, dialogue: '', action: '', note: '', first: { prompt: '', status: 'idle', asset: '', error: '' }, last: { prompt: '', status: 'idle', asset: '', error: '' }, video: { prompt: '', status: 'idle', asset: '', error: '', channelId: '', remoteTaskId: '' }, pos: null })

    const CSS = `
.dss-root{height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);font:13px var(--dsw-font-family,system-ui,sans-serif);}
.dss-root *{box-sizing:border-box}.dss-btn,.dss-input,.dss-select,.dss-area{font:inherit;color:inherit}.dss-btn{border:1px solid var(--dsw-alias-border-l1,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:6px;padding:6px 10px;cursor:pointer;white-space:nowrap}.dss-btn:hover{background:var(--dsw-alias-bg-hover,#f2f3f5)}.dss-btn:disabled{opacity:.5;cursor:not-allowed}.dss-primary{background:var(--dsw-alias-brand-primary,#446cff);border-color:var(--dsw-alias-brand-primary,#446cff);color:#fff}.dss-iconbtn{width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:17px}.dss-input,.dss-select,.dss-area{width:100%;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:5px;padding:7px 8px;background:var(--dsw-alias-bg-layer-1,#fff);outline:none}.dss-input:focus,.dss-select:focus,.dss-area:focus{border-color:var(--dsw-alias-brand-primary,#446cff)}.dss-area{resize:vertical;min-height:66px;line-height:1.45}.dss-top{height:44px;flex:none;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#ddd);background:var(--dsw-alias-bg-layer-1,#fff)}.dss-brand{font-weight:650;font-size:14px;white-space:nowrap}.dss-project{max-width:230px;width:190px}.dss-spacer{flex:1}.dss-save{color:var(--dsw-alias-label-secondary,#777);display:flex;align-items:center;gap:6px;white-space:nowrap}.dss-save:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#38a169)}.dss-save[data-state=busy]:before{background:#d99a22}.dss-save[data-state=error]:before{background:var(--dsw-alias-state-danger-primary,#d44)}.dss-body{min-height:0;flex:1;display:flex;overflow:hidden}.dss-canvas{min-width:0;flex:1;position:relative;overflow:hidden;background-color:var(--dsw-alias-bg-base,#fff);background-image:radial-gradient(var(--dsw-alias-border-l1,#d9dce2) .8px,transparent .8px);background-size:20px 20px;touch-action:none;cursor:grab}.dss-canvas.dss-panning{cursor:grabbing}.dss-world{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}.dss-shot{position:absolute;width:300px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 3px 12px rgba(0,0,0,.08);cursor:grab;user-select:none}.dss-shot.selected{border:2px solid var(--dsw-alias-brand-primary,#446cff);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary,#446cff) 16%,transparent)}.dss-shothead{height:38px;display:flex;align-items:center;gap:7px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#ddd);font-weight:600}.dss-shotmeta{font-size:11px;color:var(--dsw-alias-label-secondary,#777);font-weight:400}.dss-shotduration{margin-left:auto;color:var(--dsw-alias-label-secondary,#777);font-size:11px}.dss-frames{display:flex;gap:8px;padding:9px 10px}.dss-frame{position:relative;width:calc(50% - 4px);aspect-ratio:9 / 16;overflow:hidden;border:1px dashed var(--dsw-alias-border-l1,#c8cbd1);border-radius:5px;background:var(--dsw-alias-bg-layer-2,#f5f6f7);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#999);font-size:12px}.dss-frame{flex:0 0 128px;width:128px}.dss-frames{justify-content:center}.dss-frame img{width:100%;height:100%;object-fit:cover}.dss-framebutton{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);padding:3px 7px;font-size:10px;background:rgba(255,255,255,.92);border:1px solid #ccc;border-radius:4px;cursor:pointer;color:#333}.dss-dialogue{padding:0 10px 10px;color:var(--dsw-alias-label-secondary,#777);font-size:11px;line-height:1.5;min-height:28px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.dss-shotfoot{height:24px;padding:0 10px 7px;display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary,#999);font-size:10px}.dss-statusdot{width:7px;height:7px;border-radius:50%;background:#b4b7bd}.dss-statusdot[data-status=running]{background:#e0a323;animation:dss-pulse 1s infinite}.dss-statusdot[data-status=done]{background:var(--dsw-alias-state-success-primary,#38a169)}.dss-statusdot[data-status=error]{background:var(--dsw-alias-state-danger-primary,#d44)}@keyframes dss-pulse{50%{opacity:.35}}.dss-video-mark{margin-left:auto;color:var(--dsw-alias-brand-primary,#446cff)}.dss-inspector{width:380px;flex:none;overflow:auto;border-left:1px solid var(--dsw-alias-border-l1,#ddd);background:var(--dsw-alias-bg-layer-1,#fff);padding:14px}.dss-inspector-title{display:flex;align-items:center;font-size:14px;font-weight:650;margin-bottom:14px}.dss-field{margin:0 0 11px}.dss-field label{display:block;margin-bottom:5px;font-size:11px;color:var(--dsw-alias-label-secondary,#777)}.dss-row{display:flex;gap:8px}.dss-row>*{flex:1;min-width:0}.dss-section{border-top:1px solid var(--dsw-alias-border-l1,#ddd);padding-top:12px;margin-top:13px}.dss-section h3{margin:0 0 9px;font-size:12px}.dss-actions{display:flex;align-items:center;gap:7px;margin-top:7px}.dss-small{font-size:11px;color:var(--dsw-alias-label-secondary,#777)}.dss-bottom{height:40px;flex:none;display:flex;align-items:center;padding:0 14px;border-top:1px solid var(--dsw-alias-border-l1,#ddd);gap:10px;background:var(--dsw-alias-bg-layer-1,#fff)}.dss-bottominfo{margin-left:auto;color:var(--dsw-alias-label-secondary,#777)}.dss-canvas-controls{position:absolute;z-index:2;right:12px;top:12px;display:flex;gap:5px;align-items:center}.dss-zoom{font-size:11px;min-width:46px;text-align:center;color:var(--dsw-alias-label-secondary,#777)}.dss-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;pointer-events:none}.dss-emptybox{padding:26px 30px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 8px 30px rgba(0,0,0,.07);pointer-events:auto}.dss-emptybox h2{margin:0 0 8px;font-size:18px}.dss-emptybox p{margin:0 0 16px;color:var(--dsw-alias-label-secondary,#777)}.dss-toast{position:absolute;z-index:10;left:50%;top:12px;transform:translateX(-50%);max-width:min(80%,600px);padding:9px 14px;border-radius:6px;background:#26282c;color:#fff;box-shadow:0 4px 16px #0003}.dss-modalback{position:fixed;z-index:1000;inset:0;background:#0006;display:flex;align-items:center;justify-content:center;padding:24px}.dss-modal{width:min(900px,96vw);max-height:90vh;overflow:auto;background:var(--dsw-alias-bg-base,#fff);border-radius:8px;box-shadow:0 12px 45px #0004;padding:18px}.dss-modalhead{display:flex;align-items:center;margin-bottom:15px}.dss-modalhead h2{margin:0;font-size:16px}.dss-tabrow{display:flex;gap:6px;margin-bottom:14px}.dss-tab{padding:7px 12px;border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:5px;background:transparent;cursor:pointer}.dss-tab.active{background:var(--dsw-alias-brand-primary,#446cff);border-color:var(--dsw-alias-brand-primary,#446cff);color:#fff}.dss-channel{padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1,#ddd)}.dss-channelgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.dss-channelgrid .wide{grid-column:span 2}.dss-modalfoot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.dss-video{width:100%;max-height:180px;background:#111;border-radius:5px;margin-top:8px}.dss-danger{color:var(--dsw-alias-state-danger-primary,#c44)}
@media(max-width:900px){.dss-inspector{width:320px}.dss-brand{display:none}}@media(max-width:700px){.dss-inspector{width:270px;padding:10px}.dss-top{gap:6px;padding:0 8px}.dss-project{width:130px}.dss-save{font-size:11px}.dss-channelgrid{grid-template-columns:1fr 1fr}}
`

    function SidebarIcon(props) {
      const size = props.size || 20
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), h('path', { d: 'M8 4v16M8 9h13' }), h('path', { d: 'M12 13h5M12 16h3' }))
    }
    function Field({ label, children }) { return h('div', { className: 'dss-field' }, h('label', null, label), children) }

    function FrameThumb({ label, item, onGenerate }) {
      return h('div', { className: 'dss-frame', onClick: (e) => e.stopPropagation() }, item && item.asset ? h('img', { src: assetUrl(item.asset), alt: label }) : h(React.Fragment, null, label, h('button', { className: 'dss-framebutton', onClick: onGenerate }, item && item.status === 'running' ? '生成中…' : '生成')))
    }
    function ShotCard({ shot, selected, onSelect, onDragStart, onQuickGenerate }) {
      const pos = shot.pos || { x: 80, y: 80 }
      const status = [shot.first, shot.last, shot.video].some((x) => x && x.status === 'running') ? 'running' : [shot.first, shot.last, shot.video].some((x) => x && x.status === 'error') ? 'error' : [shot.first, shot.last, shot.video].some((x) => x && x.status === 'done') ? 'done' : 'idle'
      return h('div', { className: `dss-shot${selected ? ' selected' : ''}`, style: { left: pos.x, top: pos.y }, onPointerDown: (e) => { if (e.target.closest('button')) { e.stopPropagation(); return } onDragStart(e, shot.id) }, onClick: () => onSelect(shot.id) },
        h('div', { className: 'dss-shothead' }, h('span', null, shot.no || '未编号'), h('span', { className: 'dss-shotmeta' }, `${shot.size || '中景'} · ${shot.move || '固定'}`), h('span', { className: 'dss-shotduration' }, `${shot.duration || 5}秒`)),
        h('div', { className: 'dss-frames' }, h(FrameThumb, { label: '首帧', item: shot.first, onGenerate: () => onQuickGenerate(shot.id, 'first') }), h(FrameThumb, { label: '尾帧', item: shot.last, onGenerate: () => onQuickGenerate(shot.id, 'last') })),
        h('div', { className: 'dss-dialogue' }, shot.dialogue || '添加台词或旁白…'),
        h('div', { className: 'dss-shotfoot' }, h('span', { className: 'dss-statusdot', 'data-status': status }), status === 'running' ? '生成中' : status === 'error' ? '有任务失败' : status === 'done' ? '已生成素材' : '待制作', shot.video && shot.video.asset ? h('span', { className: 'dss-video-mark' }, '▶ 视频') : null))
    }

    function Inspector({ shot, settings, patchShot, generate, importFile, deleteShot, notify }) {
      if (!shot) return h('aside', { className: 'dss-inspector' }, h('div', { className: 'dss-small' }, '选择一个镜头以编辑内容'))
      const imageChannels = settings.image && settings.image.channels || []
      const videoChannels = settings.video && settings.video.channels || []
      const imageDefault = settings.image && settings.image.defaultChannelId || ''
      const control = (key, value, type) => h(type === 'select' ? 'select' : 'input', { className: type === 'select' ? 'dss-select' : 'dss-input', value: value == null ? '' : value, type: type === 'number' ? 'number' : 'text', min: type === 'number' ? 1 : undefined, max: type === 'number' ? 15 : undefined, onChange: (e) => patchShot({ [key]: type === 'number' ? Math.max(1, Math.min(15, Number(e.target.value) || 1)) : e.target.value }) })
      const promptArea = (slot) => h('textarea', { className: 'dss-area', value: shot[slot] && shot[slot].prompt || '', placeholder: slot === 'first' ? '描述首帧画面…' : '描述尾帧画面…', onChange: (e) => patchShot({ [slot]: { ...shot[slot], prompt: e.target.value } }) })
      const uploadControl = (slot, accept) => h('label', { className: 'dss-btn', style: { display: 'inline-block' } }, '导入', h('input', { type: 'file', accept, hidden: true, onChange: async (e) => { const file = e.target.files && e.target.files[0]; if (file) await importFile(slot, file); e.target.value = '' } }))
      return h('aside', { className: 'dss-inspector' },
        h('div', { className: 'dss-inspector-title' }, `镜头 ${shot.no || ''}`, h('span', { className: 'dss-spacer' }), h('span', { className: 'dss-small' }, shot.id)),
        h('div', { className: 'dss-row' }, h(Field, { label: '镜号' }, h('input', { className: 'dss-input', value: shot.no || '', onChange: (e) => patchShot({ no: e.target.value }) })), h(Field, { label: '时长（秒）' }, control('duration', shot.duration || 5, 'number'))),
        h('div', { className: 'dss-row' }, h(Field, { label: '景别' }, h('select', { className: 'dss-select', value: shot.size || '中景', onChange: (e) => patchShot({ size: e.target.value }) }, sizes.map((v) => h('option', { key: v, value: v }, v)))), h(Field, { label: '运镜' }, h('select', { className: 'dss-select', value: shot.move || '固定', onChange: (e) => patchShot({ move: e.target.value }) }, moves.map((v) => h('option', { key: v, value: v }, v))))),
        h(Field, { label: '台词 / 旁白' }, h('textarea', { className: 'dss-area', value: shot.dialogue || '', onChange: (e) => patchShot({ dialogue: e.target.value }) })),
        h(Field, { label: '画面动作' }, h('textarea', { className: 'dss-area', value: shot.action || '', onChange: (e) => patchShot({ action: e.target.value }) })),
        h(Field, { label: '备注' }, h('textarea', { className: 'dss-area', value: shot.note || '', onChange: (e) => patchShot({ note: e.target.value }) })),
        ['first', 'last'].map((slot) => h('section', { className: 'dss-section', key: slot }, h('h3', null, slot === 'first' ? '首帧' : '尾帧'), promptArea(slot), h('div', { className: 'dss-actions' }, h('button', { className: 'dss-btn dss-primary', onClick: () => generate(shot.id, slot), disabled: shot[slot] && shot[slot].status === 'running' }, shot[slot] && shot[slot].status === 'running' ? '生成中…' : '生成'), uploadControl(slot, 'image/*'), shot[slot] && shot[slot].error ? h('span', { className: 'dss-small dss-danger' }, shot[slot].error) : null), shot[slot] && shot[slot].asset ? h('img', { src: assetUrl(shot[slot].asset), alt: slot === 'first' ? '首帧预览' : '尾帧预览', style: { width: 76, aspectRatio: '9/16', objectFit: 'cover', marginTop: 8, borderRadius: 4 } }) : null)),
        h('section', { className: 'dss-section' }, h('h3', null, '视频'), h('textarea', { className: 'dss-area', value: shot.video && shot.video.prompt || '', placeholder: '描述镜头视频内容…', onChange: (e) => patchShot({ video: { ...shot.video, prompt: e.target.value } }) }), h(Field, { label: '视频渠道' }, h('select', { className: 'dss-select', value: shot.video && shot.video.channelId || settings.video && settings.video.defaultChannelId || '', onChange: (e) => patchShot({ video: { ...shot.video, channelId: e.target.value } }) }, h('option', { value: '' }, '选择视频渠道'), videoChannels.map((c) => h('option', { key: c.id, value: c.id }, c.name || c.id)))), h('div', { className: 'dss-actions' }, h('button', { className: 'dss-btn dss-primary', onClick: () => generate(shot.id, 'video'), disabled: shot.video && shot.video.status === 'running' }, shot.video && shot.video.status === 'running' ? '生成中…' : '生成视频'), uploadControl('video', 'video/*'), shot.video && shot.video.status === 'running' ? h('span', { className: 'dss-small' }, shot.video.progress || '任务运行中') : null), shot.video && shot.video.error ? h('div', { className: 'dss-small dss-danger' }, shot.video.error) : null, shot.video && shot.video.asset ? h('video', { className: 'dss-video', controls: true, src: assetUrl(shot.video.asset) }) : null),
        h('div', { className: 'dss-section' }, h('button', { className: 'dss-btn dss-danger', onClick: () => { if (window.confirm('确定删除这个镜头吗？')) deleteShot(shot.id) } }, '删除镜头')))
    }

    function blankChannel(kind) {
      return kind === 'image' ? { id: `ic-${Date.now().toString(36)}`, name: '新图像渠道', baseUrl: '', apiKey: '', model: '', size: '1024x1536' } : { id: `vc-${Date.now().toString(36)}`, name: '新视频渠道', provider: 'ark', baseUrl: '', apiKey: '', model: '', ratio: 'adaptive', resolution: '720p', duration: 5, audio: false, custom: { createUrl: '', createMethod: 'POST', createBody: '', authHeader: 'Authorization', authPrefix: 'Bearer ', taskIdPath: 'id', queryUrl: '', statusPath: 'status', successValues: 'succeeded,success,SUCCEEDED', failValues: 'failed,error,FAILED,expired', videoPath: 'content.video_url' } }
    }
    function ChannelFields({ channel, kind, update }) {
      const input = (key, label, extra) => h('label', { className: extra || '' }, h('span', { className: 'dss-small' }, label), h('input', { className: 'dss-input', value: channel[key] == null ? '' : channel[key], onChange: (e) => update({ [key]: e.target.value }) }))
      return h('div', { className: 'dss-channelgrid' }, input('name', '名称'), input('baseUrl', 'API 地址', 'wide'), input('apiKey', 'API 密钥'), input('model', '模型'), kind === 'image' ? input('size', '尺寸') : h(React.Fragment, null, h('label', null, h('span', { className: 'dss-small' }, '供应商'), h('select', { className: 'dss-select', value: channel.provider || 'ark', onChange: (e) => update({ provider: e.target.value }) }, ['ark', 'kling', 'wan', 'custom'].map((v) => h('option', { key: v, value: v }, v)))), h('label', null, h('span', { className: 'dss-small' }, '画幅'), h('select', { className: 'dss-select', value: channel.ratio || 'adaptive', onChange: (e) => update({ ratio: e.target.value }) }, ['adaptive', '9:16', '16:9', '1:1', '4:3'].map((v) => h('option', { key: v, value: v }, v)))), input('resolution', '分辨率'), input('duration', '时长（秒）'), h('label', null, h('span', { className: 'dss-small' }, '音频'), h('input', { type: 'checkbox', checked: !!channel.audio, onChange: (e) => update({ audio: e.target.checked }) })), channel.provider === 'custom' ? h(React.Fragment, null, ...[['createUrl', 'createUrl', '创建地址'], ['createMethod', 'createMethod', '创建方法'], ['createBody', 'createBody', '创建请求体 JSON'], ['authHeader', 'authHeader', '鉴权请求头'], ['authPrefix', 'authPrefix', '鉴权前缀'], ['taskIdPath', 'taskIdPath', '任务 ID 路径'], ['queryUrl', 'queryUrl', '查询地址模板'], ['statusPath', 'statusPath', '状态字段路径'], ['successValues', 'successValues', '成功状态值'], ['failValues', 'failValues', '失败状态值'], ['videoPath', 'videoPath', '视频地址路径']].map(([key, sub, label]) => h('label', { key, className: sub === 'createBody' || sub === 'createUrl' || sub === 'queryUrl' ? 'wide' : '' }, h('span', { className: 'dss-small' }, label), h('input', { className: 'dss-input', value: channel.custom && channel.custom[sub] || '', onChange: (e) => update({ custom: { ...(channel.custom || {}), [sub]: e.target.value } }) })))) : null))
    }
    function SettingsModal({ settings, onClose, onSave, toast }) {
      const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(settings || initialSettings)))
      const [tab, setTab] = useState('image')
      const channels = draft[tab] && draft[tab].channels || []
      const updateChannel = (id, patch) => setDraft((old) => ({ ...old, [tab]: { ...old[tab], channels: old[tab].channels.map((c) => c.id === id ? { ...c, ...patch } : c) } }))
      const removeChannel = (id) => setDraft((old) => ({ ...old, [tab]: { ...old[tab], channels: old[tab].channels.filter((c) => c.id !== id), defaultChannelId: old[tab].defaultChannelId === id ? '' : old[tab].defaultChannelId } }))
      const addChannel = () => { const c = blankChannel(tab); setDraft((old) => ({ ...old, [tab]: { ...old[tab], channels: [...(old[tab].channels || []), c] } })) }
      const save = async () => { try { await onSave(draft); onClose() } catch (e) { toast(e.message) } }
      return h('div', { className: 'dss-modalback', onMouseDown: (e) => { if (e.target === e.currentTarget) onClose() } }, h('div', { className: 'dss-modal', role: 'dialog', 'aria-modal': true }, h('div', { className: 'dss-modalhead' }, h('h2', null, '渠道设置'), h('span', { className: 'dss-spacer' }), h('button', { className: 'dss-btn dss-iconbtn', onClick: onClose, title: '关闭' }, '×')), h('div', { className: 'dss-tabrow' }, ['image', 'video'].map((k) => h('button', { key: k, className: `dss-tab${tab === k ? ' active' : ''}`, onClick: () => setTab(k) }, k === 'image' ? '图像渠道' : '视频渠道'))), h('label', { className: 'dss-small' }, '默认渠道 ', h('select', { className: 'dss-select', style: { width: 240, marginLeft: 8 }, value: draft[tab].defaultChannelId || '', onChange: (e) => setDraft((old) => ({ ...old, [tab]: { ...old[tab], defaultChannelId: e.target.value } })) }, h('option', { value: '' }, '不设默认'), channels.map((c) => h('option', { key: c.id, value: c.id }, c.name || c.id)))), channels.map((c) => h('div', { className: 'dss-channel', key: c.id }, h(ChannelFields, { channel: c, kind: tab, update: (patch) => updateChannel(c.id, patch) }), h('div', { className: 'dss-actions' }, h('button', { className: 'dss-btn dss-danger', onClick: () => removeChannel(c.id) }, '删除渠道')))), h('button', { className: 'dss-btn', style: { marginTop: 10 }, onClick: addChannel }, '＋ 添加渠道'), h('div', { className: 'dss-modalfoot' }, h('button', { className: 'dss-btn', onClick: onClose }, '取消'), h('button', { className: 'dss-btn dss-primary', onClick: save }, '保存设置'))))
    }

    function Studio() {
      const [projects, setProjects] = useState([])
      const [project, setProject] = useState(null)
      const [settings, setSettings] = useState(initialSettings)
      const [selected, setSelected] = useState('')
      const [saveState, setSaveState] = useState('saved')
      const [toast, setToast] = useState('')
      const [showSettings, setShowSettings] = useState(false)
      const [zoom, setZoom] = useState(1)
      const [pan, setPan] = useState({ x: 0, y: 0 })
      const alive = useRef(true)
      const saveTimer = useRef(null)
      const saveInFlight = useRef(false)
      const toastTimer = useRef(null)
      const drag = useRef(null)
      const canvasRef = useRef(null)
      const panRef = useRef(pan)
      const zoomRef = useRef(zoom)
      const projectRef = useRef(project)
      const taskTimers = useRef(new Map())
      useEffect(() => { panRef.current = pan }, [pan])
      useEffect(() => { zoomRef.current = zoom }, [zoom])
      useEffect(() => { projectRef.current = project }, [project])
      const notify = useCallback((message) => { if (!alive.current) return; setToast(String(message || '未知错误')); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => { if (alive.current) setToast('') }, 4500) }, [])
      const loadState = useCallback(async (projectId) => {
        try {
          const body = await request(`/state${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`)
          if (!alive.current) return
          setProjects(body.projects || [])
          setSettings(body.settings || initialSettings)
          setProject(body.project || null)
          setSelected((prev) => body.project && body.project.shots && body.project.shots.some((s) => s.id === prev) ? prev : body.project && body.project.shots && body.project.shots[0] ? body.project.shots[0].id : '')
        } catch (e) { if (alive.current) notify(e.message) }
      }, [notify])
      useEffect(() => { alive.current = true; loadState(''); return () => { alive.current = false; clearTimeout(saveTimer.current); clearTimeout(toastTimer.current); for (const t of taskTimers.current.values()) clearTimeout(t); taskTimers.current.clear(); if (drag.current && drag.current.target && drag.current.target.releasePointerCapture) { try { drag.current.target.releasePointerCapture(drag.current.pointerId) } catch (_) {} } } }, [loadState])
      const persistRef = useRef(null)
      const persist = useCallback((next) => {
        projectRef.current = next
        setProject(next)
        setSaveState('busy')
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          if (saveInFlight.current) { saveTimer.current = setTimeout(() => { if (alive.current && projectRef.current && persistRef.current) persistRef.current(projectRef.current) }, 100); return }
          saveInFlight.current = true
          try {
            const body = await post('/project/save', { project: next })
            if (!alive.current) return
            const latest = projectRef.current
            const updated = { ...next, updatedAt: body.updatedAt || Date.now() }
            setProjects((current) => current.map((p) => p.id === next.id ? { ...p, title: next.title, updatedAt: updated.updatedAt, shotCount: next.shots.length } : p).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))
            if (latest && latest.id === next.id && latest !== next) {
              setSaveState('busy')
              saveTimer.current = setTimeout(() => persistRef.current && persistRef.current(latest), 0)
            } else {
              setSaveState('saved')
              projectRef.current = updated
              setProject((current) => current && current.id === next.id ? updated : current)
            }
          } catch (e) { if (alive.current) { setSaveState('error'); notify(e.message) } }
          finally { saveInFlight.current = false }
        }, 800)
      }, [notify])
      persistRef.current = persist
      const mutate = useCallback((fn) => { const current = projectRef.current; if (!current) return; const next = fn(current); if (next !== current) persist(next) }, [persist])
      const patchShot = useCallback((id, patch) => mutate((p) => ({ ...p, shots: p.shots.map((s) => s.id === id ? { ...s, ...patch } : s) })), [mutate])
      const chooseProject = async (id) => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = null; if (id) await loadState(id); else { setProject(null); projectRef.current = null; setSelected('') } setPan({ x: 0, y: 0 }); setZoom(1) }
      const createProject = async () => { try { const body = await post('/project/create', { title: '未命名作品' }); await loadState(body.project.id) } catch (e) { notify(e.message) } }
      const deleteProject = async () => {
        if (!project || !window.confirm(`确定删除项目「${project.title}」吗？`)) return
        try { await post('/project/delete', { id: project.id }); await loadState('') } catch (e) { notify(e.message) }
      }
      const addShot = () => mutate((p) => ({ ...p, shots: [...p.shots, { ...newShot(p.shots.length + 1), pos: { x: 80 + (p.shots.length % 4) * 340, y: 80 + Math.floor(p.shots.length / 4) * 430 } }] }))
      const deleteShot = (id) => { mutate((p) => ({ ...p, shots: p.shots.filter((s) => s.id !== id) })); setSelected((s) => s === id ? '' : s) }
      const selectedShot = project && project.shots && project.shots.find((s) => s.id === selected) || null
      const saveSettings = async (value) => { await post('/settings', { settings: value }); if (alive.current) setSettings(value) }
      const importFile = async (shotId, slot, file) => {
        const kind = slot === 'video' ? 'video' : 'image'
        const reader = new FileReader()
        const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('读取文件失败')); reader.readAsDataURL(file) })
        try {
          const body = await post('/asset/upload', { projectId: projectRef.current.id, shotId, slot, name: file.name, dataUrl })
          if (!alive.current) return
          const shot = projectRef.current.shots.find((s) => s.id === shotId)
          const old = shot && shot[slot] || {}
          patchShot(shotId, { [slot]: { ...old, asset: body.asset, status: 'done', error: '' } })
        } catch (e) { notify(e.message) }
      }
      const pollTask = useCallback((taskId, kind, shotId, slot, startedAt) => {
        const timerKey = `${taskId}`
        const poll = async () => {
          if (!alive.current) return
          if (Date.now() - startedAt > 10 * 60 * 1000) {
            taskTimers.current.delete(timerKey)
            patchShot(shotId, { [slot]: { ...(projectRef.current && projectRef.current.shots.find((s) => s.id === shotId)?.[slot] || {}), status: 'error', error: '生成任务等待超过 10 分钟' } })
            notify('生成任务等待超过 10 分钟')
            return
          }
          try {
            const body = await request(`/task?id=${encodeURIComponent(taskId)}`)
            if (!alive.current) return
            const task = body.task || {}
            const currentShot = projectRef.current && projectRef.current.shots.find((s) => s.id === shotId)
            const currentSlot = currentShot && currentShot[slot] || {}
            if (task.status === 'done') {
              patchShot(shotId, { [slot]: { ...currentSlot, status: 'done', asset: task.result && task.result.asset || currentSlot.asset, error: '', progress: '' } })
              taskTimers.current.delete(timerKey)
              return
            }
            if (task.status === 'error') {
              patchShot(shotId, { [slot]: { ...currentSlot, status: 'error', error: task.error || '生成失败' } })
              taskTimers.current.delete(timerKey)
              notify(task.error || '生成失败')
              return
            }
            patchShot(shotId, { [slot]: { ...currentSlot, status: 'running', progress: task.progress || '任务运行中' } })
          } catch (e) {
            if (!alive.current) return
            notify(e.message)
          }
          if (alive.current) taskTimers.current.set(timerKey, setTimeout(poll, 2000))
        }
        taskTimers.current.set(timerKey, setTimeout(poll, 2000))
      }, [notify, patchShot])
      const generate = async (shotId, slot) => {
        const p = projectRef.current
        const shot = p && p.shots.find((s) => s.id === shotId)
        if (!shot) return
        const isImage = slot === 'first' || slot === 'last'
        const channels = isImage ? settings.image && settings.image.channels || [] : settings.video && settings.video.channels || []
        const preferred = isImage ? settings.image && settings.image.defaultChannelId : shot.video && shot.video.channelId || settings.video && settings.video.defaultChannelId
        const channel = channels.find((c) => c.id === preferred) || channels[0]
        if (!channel) { notify(isImage ? '先去设置里加一个图像渠道' : '先去设置里加一个视频渠道'); if (isImage || !channels.length) setShowSettings(true); return }
        const item = shot[slot] || {}
        const prompt = item.prompt || (slot === 'video' ? shot.action : '')
        if (!prompt || !prompt.trim()) { notify('请先填写生成提示词'); setSelected(shotId); return }
        patchShot(shotId, { [slot]: { ...item, status: 'running', error: '', progress: '正在提交…', channelId: channel.id } })
        try {
          const body = isImage
            ? await post('/generate/image', { channelId: channel.id, projectId: p.id, shotId, slot, prompt, size: channel.size })
            : await post('/generate/video', { channelId: channel.id, projectId: p.id, shotId, prompt, firstAsset: shot.first && shot.first.asset || '', lastAsset: shot.last && shot.last.asset || '', duration: shot.duration, ratio: channel.ratio })
          if (!alive.current) return
          const latest = projectRef.current.shots.find((s) => s.id === shotId)
          patchShot(shotId, { [slot]: { ...(latest && latest[slot] || item), status: 'running', remoteTaskId: body.taskId, progress: '已提交，等待中', channelId: channel.id } })
          pollTask(body.taskId, isImage ? 'image' : 'video', shotId, slot, Date.now())
        } catch (e) {
          patchShot(shotId, { [slot]: { ...item, status: 'error', error: e.message } })
          notify(e.message)
        }
      }
      const onWheel = useCallback((e) => {
        e.preventDefault()
        const rect = canvasRef.current.getBoundingClientRect()
        const px = e.clientX - rect.left, py = e.clientY - rect.top
        const old = zoomRef.current
        const next = Math.max(0.2, Math.min(2.5, old * Math.exp(-e.deltaY * 0.0012)))
        if (next === old) return
        const current = panRef.current
        const wx = (px - current.x) / old, wy = (py - current.y) / old
        const nextPan = { x: px - wx * next, y: py - wy * next }
        setZoom(next); zoomRef.current = next
        setPan(nextPan); panRef.current = nextPan
      }, [])
      const startPan = (e) => { if (e.button !== 0 || e.target.closest('.dss-shot,.dss-canvas-controls,button')) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { mode: 'pan', pointerId: e.pointerId, target: e.currentTarget, startX: e.clientX, startY: e.clientY, base: panRef.current } }
      const startCard = (e, id) => { if (e.button !== 0) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSelected(id); const shot = projectRef.current.shots.find((s) => s.id === id); drag.current = { mode: 'shot', id, pointerId: e.pointerId, target: e.currentTarget, startX: e.clientX, startY: e.clientY, base: shot.pos || { x: 80, y: 80 }, moved: false } }
      const movePointer = (e) => { const d = drag.current; if (!d || d.pointerId !== e.pointerId) return; const dx = (e.clientX - d.startX) / zoomRef.current, dy = (e.clientY - d.startY) / zoomRef.current; if (d.mode === 'pan') { const next = { x: d.base.x + e.clientX - d.startX, y: d.base.y + e.clientY - d.startY }; setPan(next); panRef.current = next } else { d.moved = true; patchShot(d.id, { pos: { x: Math.max(0, d.base.x + dx), y: Math.max(0, d.base.y + dy) } }) } }
      const finishPointer = (e) => { const d = drag.current; if (!d || (e && d.pointerId !== e.pointerId)) return; drag.current = null; if (d.target && d.target.hasPointerCapture && d.target.hasPointerCapture(d.pointerId)) { try { d.target.releasePointerCapture(d.pointerId) } catch (_) {} } }
      const fitView = () => { const el = canvasRef.current; if (!el || !project || !project.shots.length) { setPan({ x: 0, y: 0 }); setZoom(1); return }; const points = project.shots.map((s) => s.pos || { x: 80, y: 80 }); const minX = Math.min(...points.map((p) => p.x)), minY = Math.min(...points.map((p) => p.y)); const maxX = Math.max(...points.map((p) => p.x + 300)), maxY = Math.max(...points.map((p) => p.y + 405)); const scale = Math.max(.2, Math.min(1.3, Math.min((el.clientWidth - 50) / (maxX - minX), (el.clientHeight - 50) / (maxY - minY)))); setZoom(scale); setPan({ x: (el.clientWidth - (maxX - minX) * scale) / 2 - minX * scale, y: (el.clientHeight - (maxY - minY) * scale) / 2 - minY * scale }) }
      const totalSeconds = useMemo(() => (project && project.shots || []).reduce((sum, s) => sum + (Number(s.duration) || 0), 0), [project])
      const durationLabel = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
      const stateLabel = saveState === 'busy' ? '保存中' : saveState === 'error' ? '保存失败' : '已保存'
      return h('div', { className: 'dss-root' },
        h('header', { className: 'dss-top' }, h('span', { className: 'dss-brand' }, 'Torso'), h('select', { className: 'dss-select dss-project', value: project && project.id || '', onChange: (e) => chooseProject(e.target.value) }, h('option', { value: '' }, '选择项目'), projects.map((p) => h('option', { key: p.id, value: p.id }, p.title))), h('button', { className: 'dss-btn', onClick: createProject }, '＋ 新项目'), project ? h('button', { className: 'dss-btn', onClick: () => loadState(project.id), title: '从服务端刷新' }, '刷新') : null, h('span', { className: 'dss-spacer' }), h('span', { className: 'dss-save', 'data-state': saveState }, stateLabel), h('button', { className: 'dss-btn dss-iconbtn', onClick: () => setShowSettings(true), title: '样式与渠道设置' }, '⚙')),
        h('div', { className: 'dss-body' }, h('main', { className: 'dss-canvas', ref: canvasRef, onWheel, onPointerDown: startPan, onPointerMove: movePointer, onPointerUp: finishPointer, onPointerCancel: finishPointer, onLostPointerCapture: finishPointer }, h('div', { className: 'dss-world', style: { transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` } }, project && project.shots && project.shots.map((shot) => h(ShotCard, { key: shot.id, shot, selected: shot.id === selected, onSelect: setSelected, onDragStart: startCard, onQuickGenerate: generate }))), h('div', { className: 'dss-canvas-controls' }, h('button', { className: 'dss-btn dss-iconbtn', title: '适应画面', onClick: fitView }, '⊡'), h('button', { className: 'dss-btn dss-iconbtn', title: '缩小', onClick: () => setZoom((z) => Math.max(.2, z / 1.15)) }, '−'), h('span', { className: 'dss-zoom' }, `${Math.round(zoom * 100)}%`), h('button', { className: 'dss-btn dss-iconbtn', title: '放大', onClick: () => setZoom((z) => Math.min(2.5, z * 1.15)) }, '＋'), h('button', { className: 'dss-btn', onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }) } }, '100%')), (!project || !projects.length) ? h('div', { className: 'dss-empty' }, h('div', { className: 'dss-emptybox' }, h('h2', null, '新建第一部作品'), h('p', null, '从一个镜头开始，逐步搭建你的故事画面。'), h('button', { className: 'dss-btn dss-primary', onClick: createProject }, '＋ 新建第一部作品'))) : null, toast ? h('div', { className: 'dss-toast', role: 'status' }, toast) : null), h(Inspector, { shot: selectedShot, settings, patchShot, generate, importFile, deleteShot, notify })),
        h('footer', { className: 'dss-bottom' }, h('button', { className: 'dss-btn', disabled: !project, onClick: addShot }, '＋ 添加镜头'), project ? h('button', { className: 'dss-btn dss-danger', onClick: deleteProject }, '删除项目') : null, h('span', { className: 'dss-bottominfo' }, project ? `${project.shots.length} 镜 · 总时长 ${durationLabel}` : '尚未选择项目')),
        showSettings ? h(SettingsModal, { settings, onClose: () => setShowSettings(false), onSave: saveSettings, toast: notify }) : null)
    }

    function apply(ctx) {
      ctx.effect(() => {
        const el = document.createElement('style')
        el.textContent = CSS
        document.head.appendChild(el)
        return () => el.remove()
      }, 'torso: styles')
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'torso', order: 40, label: 'Torso' }, SidebarIcon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'torso' }, Studio))
    }
    return { name: 'dsh-torso', inject: ['slots'], apply }
  },
})

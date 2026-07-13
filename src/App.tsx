import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, Download, Dumbbell, ExternalLink, Flame, History, Link2, Pencil, Plus, RotateCcw, Share2, Sparkles, Trash2, Trophy, X } from 'lucide-react'

type Part = '胸' | '肩' | '背' | '腿' | '核心' | '有氧'
type Exercise = { id: string; name: string; sets: number; reps: number; weight: number; part?: Part; cue?: string; bonusSets?: number; completedSets?: number; planPart?: Part }
type Workout = { date: string; duration: number; feeling: number; note: string; exercises: Exercise[]; selectedParts?: Part[] }
type PartPlans = Record<Part, Exercise[]>
type Tab = 'today' | 'history' | 'stats'

const STORE_KEY = 'fitlog.workouts.v1'
const PLAN_KEY = 'fitlog.part-plans.v1'
const PARTS: Part[] = ['胸', '肩', '背', '腿', '核心', '有氧']
const EMPTY_PLANS = (): PartPlans => ({ 胸: [], 肩: [], 背: [], 腿: [], 核心: [], 有氧: [] })
const today = () => new Date().toLocaleDateString('en-CA')
const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
const formatDate = (value: string, withYear = false) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(`${value}T12:00:00`))
const volumeOf = (w: Workout) => w.exercises.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0)
const load = (): Workout[] => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') } catch { return [] } }
const loadPlans = (): PartPlans => { try { return {...EMPTY_PLANS(), ...JSON.parse(localStorage.getItem(PLAN_KEY) || '{}')} } catch { return EMPTY_PLANS() } }
const streakOf = (workouts: Workout[]) => { const days = new Set(workouts.map(w => w.date)); let streak = 0; const d = new Date(); if (!days.has(today())) d.setDate(d.getDate() - 1); while (days.has(d.toLocaleDateString('en-CA'))) { streak++; d.setDate(d.getDate() - 1) } return streak }

function encodeWorkout(workout: Workout) {
  const bytes = new TextEncoder().encode(JSON.stringify(workout))
  let binary = ''; bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
function decodeWorkout(value: string): Workout | null {
  try { const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/')); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(bytes)) } catch { return null }
}

export default function App() {
  const shared = useMemo(() => decodeWorkout(new URLSearchParams(location.hash.slice(1)).get('share') || ''), [])
  const [workouts, setWorkouts] = useState<Workout[]>(load)
  const [plans, setPlansState] = useState<PartPlans>(loadPlans)
  const [tab, setTab] = useState<Tab>('today')
  const [selected, setSelected] = useState<Workout | null>(null)
  const [shareWorkout, setShareWorkout] = useState<Workout | null>(null)
  const [toast, setToast] = useState('')
  const current = workouts.find(w => w.date === today()) || { date: today(), duration: 45, feeling: 4, note: '', exercises: [], selectedParts: [] }
  const [draft, setDraft] = useState<Workout>(current)
  const setPlans = (next: PartPlans) => { setPlansState(next); localStorage.setItem(PLAN_KEY, JSON.stringify(next)) }

  const save = () => {
    if (!draft.exercises.length) return flash('先添加一个训练动作')
    const next = [...workouts.filter(w => w.date !== draft.date), draft].sort((a,b) => b.date.localeCompare(a.date))
    setWorkouts(next); localStorage.setItem(STORE_KEY, JSON.stringify(next)); flash('今天的训练已保存')
  }
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  const share = (workout: Workout) => { if (!workout.exercises.length) return flash('先添加训练动作再分享'); setShareWorkout(workout) }

  if (shared) return <SharedWorkout workout={shared} />

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">练</span><div><b>练迹</b><small>FITLOG · DAILY TRAINING</small></div></div><CyberClock/><div className="streak"><Flame size={15} fill="currentColor"/> {streakOf(workouts)} 天</div></header>
    <main>
      {tab === 'today' && <Today draft={draft} setDraft={setDraft} plans={plans} setPlans={setPlans} templates={workouts.flatMap(w => w.exercises)} save={save} share={() => share(draft)} />}
      {tab === 'history' && <HistoryView workouts={workouts} open={setSelected} />}
      {tab === 'stats' && <Stats workouts={workouts} />}
    </main>
    <nav className="bottom-nav">
      <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Dumbbell/><span>训练</span></button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History/><span>历史</span></button>
      <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}><BarChart3/><span>统计</span></button>
    </nav>
    {selected && <WorkoutSheet workout={selected} close={() => setSelected(null)} share={() => share(selected)} />}
    {shareWorkout && <ShareDialog workout={shareWorkout} close={() => setShareWorkout(null)} flash={flash} />}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function CyberClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  const time = now.toLocaleTimeString('zh-CN', {hour12:false})
  const date = new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',weekday:'short'}).format(now)
  return <div className={`cyber-clock ${now.getSeconds() % 10 === 0 ? 'surge' : ''}`}><span>{date}</span><b>{time}</b><i key={time}/></div>
}

function Today({ draft, setDraft, plans, setPlans, templates, save, share }: { draft: Workout; setDraft: (w: Workout) => void; plans: PartPlans; setPlans: (p: PartPlans) => void; templates: Exercise[]; save: () => void; share: () => void }) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mode, setMode] = useState<'overview' | 'split'>('overview')
  const [activePart, setActivePart] = useState<Part>('胸')
  const blank = (part: Part) => ({ name: '', sets: 4, reps: 8, weight: 20, part, cue: '', bonusSets: 0 })
  const [exercise, setExercise] = useState(blank('胸'))
  const selectedParts = draft.selectedParts || []
  const uniqueTemplates = [...new Map([...templates, ...Object.values(plans).flat()].map(e => [e.name, e])).values()].slice(0, 8)
  const target = draft.exercises.reduce((s,e) => s + e.sets, 0)
  const done = draft.exercises.reduce((s,e) => s + Math.min(e.sets, e.completedSets || 0), 0)

  const openAdd = () => { setEditingId(null); setExercise(blank(mode === 'split' ? activePart : '胸')); setAdding(true) }
  const openEdit = (item: Exercise) => { setEditingId(item.id); setExercise({name:item.name,sets:item.sets,reps:item.reps,weight:item.weight,part:activePart,cue:item.cue||'',bonusSets:item.bonusSets||0}); setAdding(true) }
  const closeEditor = () => { setAdding(false); setEditingId(null) }
  const add = () => {
    if (!exercise.name.trim()) return
    const item = {...exercise, part: mode === 'split' ? activePart : exercise.part, completedSets: 0, id: uid()}
    if (mode === 'split') setPlans({...plans, [activePart]: editingId ? plans[activePart].map(e => e.id === editingId ? {...item,id:editingId} : e) : [...plans[activePart], item]})
    else setDraft({...draft, exercises: [...draft.exercises, item]})
    closeEditor()
  }
  const useTemplate = (e: Exercise) => setExercise({ name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, part: mode === 'split' ? activePart : e.part || '胸', cue: e.cue || '', bonusSets: e.bonusSets || 0 })
  const togglePart = (part: Part) => {
    const removing = selectedParts.includes(part)
    const nextParts = removing ? selectedParts.filter(p => p !== part) : [...selectedParts, part]
    const retained = draft.exercises.filter(e => e.planPart !== part)
    const injected = removing ? [] : plans[part].map(e => ({...e, id:uid(), part, planPart:part, completedSets:0}))
    setDraft({...draft, selectedParts: nextParts, exercises: [...retained, ...injected]})
  }
  const toggleSet = (id: string, amount: number) => setDraft({...draft, exercises: draft.exercises.map(e => e.id === id ? {...e, completedSets: Math.max(0, (e.completedSets || 0) + amount)} : e)})
  const remove = (id: string) => mode === 'split' ? setPlans({...plans, [activePart]: plans[activePart].filter(e=>e.id!==id)}) : setDraft({...draft, exercises:draft.exercises.filter(e=>e.id!==id)})
  const groups = PARTS.map(part => ({part, items:draft.exercises.filter(e => (e.part || '核心') === part)})).filter(g=>g.items.length || selectedParts.includes(g.part))
  const card = (e: Exercise, i: number, template = false) => { const completed=e.completedSets||0; return <div className="exercise-card rich cyber-card" key={e.id}><span className="index">{String(i+1).padStart(2,'0')}</span><div className="exercise-main"><div className="exercise-title"><b>{e.name}</b><i>{template?'计划':e.part}</i></div><small>{e.sets} 目标组 × {e.reps} 次 {e.weight>0&&`× ${e.weight} kg`}{!!e.bonusSets&&` · 建议 +${e.bonusSets} 组`}</small>{e.cue&&<p>{e.cue}</p>}{!template&&<div className="set-counter"><button onClick={()=>toggleSet(e.id,-1)}>−</button><span><b>{completed}</b> / {e.sets} 目标组{completed>e.sets&&<em>+{completed-e.sets} 超额</em>}</span><button onClick={()=>toggleSet(e.id,1)}>+</button></div>}</div><div className="card-actions">{template&&<button aria-label="编辑" onClick={()=>openEdit(e)}><Pencil/></button>}<button aria-label="删除" onClick={()=>remove(e.id)}><Trash2/></button></div></div> }

  return <section className="page today-page cyber-page">
    <div className="view-switch"><button className={mode==='overview'?'active':''} onClick={()=>setMode('overview')}><BarChart3/> 今日训练</button><button className={mode==='split'?'active':''} onClick={()=>setMode('split')}><Dumbbell/> 分化计划</button></div>
    {mode === 'overview' ? <>
      <div className="sequence-console"><div className="section-heading"><div><span>01</span><h2>今日训练序列</h2></div><button className="text-btn" onClick={openAdd}><Plus/> 自定义</button></div><div className="protocol-grid compact">{PARTS.map(p=><button key={p} data-part={p} className={selectedParts.includes(p)?'active':''} onClick={()=>togglePart(p)}><b>{p}</b><small>{plans[p].length} 个</small><i/></button>)}</div><div className="sequence-meta"><label><Clock3/><b>{draft.duration}</b><span>分钟</span><input aria-label="训练时长" type="range" min="10" max="180" step="5" value={draft.duration} onChange={e=>setDraft({...draft,duration:+e.target.value})}/></label><div><Dumbbell/><b>{draft.exercises.length}</b><span>动作</span></div><div><span>完成</span><b>{done}/{target}</b><small>目标组</small></div></div>{!!target&&<div className="workout-progress compact-progress"><i><span style={{width:`${done/target*100}%`}}/></i></div>}{!groups.length&&<button className="empty-card cyber-empty" onClick={()=>setMode('split')}><span><Dumbbell/></span><b>先建立分化动作库</b><small>进入分化计划，为各部位配置动作</small></button>}<div className="part-groups">{groups.map(group=><section className="part-group" data-part={group.part} key={group.part}><header><span>{group.part}</span><b>{group.items.length} EXERCISES</b><i/></header><div className="exercise-list">{group.items.length?group.items.map((e,i)=>card(e,i)):<div className="empty-protocol">该部位尚未配置动作</div>}</div></section>)}</div></div>
      <div className="section-heading"><div><span>02</span><h2>训练反馈</h2></div></div><div className="feeling-row">{[1,2,3,4,5].map(n=><button key={n} className={draft.feeling===n?'active':''} onClick={()=>setDraft({...draft,feeling:n})}>{['过载','疲劳','稳定','良好','峰值'][n-1]}</button>)}</div><textarea placeholder="记录今日训练数据与身体反馈…" value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/><div className="action-row"><button className="share-btn" onClick={share}><Share2/></button><button className="save-btn" onClick={save}>提交训练日志 <ChevronRight/></button></div>
    </> : <>
      <aside className="part-rail" aria-label="部位快捷切换">{PARTS.map(p=><button key={p} className={activePart===p?'active':''} onClick={()=>setActivePart(p)}>{p}</button>)}</aside>
      <div className="split-console"><span>训练模板</span><h2>{activePart}部动作</h2><p>这里的动作不会直接计入今日训练。回到“今日训练”选择“{activePart}”，即可整组载入。</p><div className="split-stats"><b>{plans[activePart].length}</b><small>已配置动作</small></div></div>
      <div className="section-heading"><div><span>02</span><h2>动作清单</h2></div><button className="text-btn" onClick={openAdd}><Plus/> 添加模板</button></div><div className="exercise-list">{plans[activePart].length?plans[activePart].map((e,i)=>card(e,i,true)):<button className="empty-card cyber-empty" onClick={openAdd}><span><Plus/></span><b>添加{activePart}部动作</b><small>建立可重复调用的分化模板</small></button>}</div>
    </>}
    {adding&&<div className="modal-backdrop" onClick={closeEditor}><div className="add-sheet cyber-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><small>{editingId?'EDIT EXERCISE':mode==='split'?'ADD TO SPLIT PLAN':'ADD CUSTOM EXERCISE'}</small><h2>{editingId?'编辑':`添加${mode==='split'?activePart:''}`}动作</h2></div><button onClick={closeEditor}><X/></button></div>{!editingId&&!!uniqueTemplates.length&&<div className="templates"><small>最近使用</small><div>{uniqueTemplates.map(e=><button key={e.name} onClick={()=>useTemplate(e)}><RotateCcw/> {e.name}</button>)}</div></div>}{mode==='overview'&&<label>训练部位<div className="part-picker">{PARTS.map(p=><button type="button" key={p} className={exercise.part===p?'active':''} onClick={()=>setExercise({...exercise,part:p})}>{p}</button>)}</div></label>}<label>动作名称<input autoFocus placeholder="例如：杠铃深蹲" value={exercise.name} onChange={e=>setExercise({...exercise,name:e.target.value})}/></label><div className="number-grid">{([['目标组','sets'],['次数','reps'],['重量 kg','weight'],['额外组','bonusSets']] as const).map(([label,key])=><label key={key}>{label}<input type="number" min="0" value={exercise[key]} onChange={e=>setExercise({...exercise,[key]:+e.target.value})}/></label>)}</div><label className="cue-field">动作要领<input placeholder="例如：收紧核心，控制离心" value={exercise.cue} onChange={e=>setExercise({...exercise,cue:e.target.value})}/></label><button className="save-btn full" onClick={add}>{editingId?'保存修改':mode==='split'?'加入分化计划':'加入今日训练'} {editingId?<Check/>:<Plus/>}</button></div></div>}
  </section>
}

function HistoryView({ workouts, open }: { workouts: Workout[]; open: (w: Workout) => void }) {
  const [month, setMonth] = useState(new Date())
  const monthWorkouts = workouts.filter(w => { const d = new Date(`${w.date}T12:00:00`); return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear() })
  const move = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  return <section className="page history-page"><div className="eyebrow">ARCHIVE / 训练档案</div><h1>你的每次<br/><em>坚持都算数。</em></h1><div className="month-switch"><button onClick={() => move(-1)}><ChevronLeft/></button><b>{month.getFullYear()} 年 {month.getMonth()+1} 月</b><button onClick={() => move(1)}><ChevronRight/></button></div><div className="history-summary"><div><b>{monthWorkouts.length}</b><span>训练次数</span></div><div><b>{monthWorkouts.reduce((s,w)=>s+w.duration,0)}</b><span>总分钟</span></div><div><b>{Math.round(monthWorkouts.reduce((s,w)=>s+volumeOf(w),0)/100)/10}k</b><span>总容量 kg</span></div></div><div className="timeline">{monthWorkouts.map(w => <button className="timeline-item" key={w.date} onClick={() => open(w)}><div className="timeline-date"><b>{new Date(`${w.date}T12:00:00`).getDate()}</b><span>{new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(new Date(`${w.date}T12:00:00`))}</span></div><div className="timeline-line"><i/></div><div className="timeline-card"><div><b>{w.exercises.map(e=>e.name).slice(0,2).join(' · ')}</b><small><Clock3/> {w.duration} 分钟 · {w.exercises.length} 个动作</small></div><ChevronRight/></div></button>)}{!monthWorkouts.length && <div className="no-history"><CalendarDays/><b>这个月还没有训练</b><span>去留下第一条记录吧</span></div>}</div></section>
}

function Stats({ workouts }: { workouts: Workout[] }) {
  const total = workouts.length, minutes = workouts.reduce((s,w)=>s+w.duration,0), volume = workouts.reduce((s,w)=>s+volumeOf(w),0)
  const last7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const key=d.toLocaleDateString('en-CA'); return { label: ['日','一','二','三','四','五','六'][d.getDay()], value: workouts.find(w=>w.date===key)?.duration||0 } })
  const max = Math.max(...last7.map(x=>x.value), 60)
  const names = new Map<string,number>(); workouts.forEach(w=>w.exercises.forEach(e=>names.set(e.name,(names.get(e.name)||0)+e.sets)))
  const favorites = [...names].sort((a,b)=>b[1]-a[1]).slice(0,4)
  const backup = () => { const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), workouts }, null, 2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`fitlog-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href) }
  return <section className="page stats-page"><div className="eyebrow">PROGRESS / 数据洞察</div><h1>看见你的<br/><em>持续进步。</em></h1><div className="big-stat"><div><span>累计训练</span><b>{total}</b><small>次</small></div><Trophy/></div><div className="dual-stats"><div><Clock3/><span>训练时长</span><b>{Math.floor(minutes/60)}<small> 小时 </small>{minutes%60}<small> 分</small></b></div><div><Dumbbell/><span>训练容量</span><b>{(volume/1000).toFixed(1)}<small> 吨</small></b></div></div><div className="chart-card"><div className="card-head"><div><small>最近 7 天</small><b>训练时长</b></div><span>{last7.reduce((s,x)=>s+x.value,0)} 分钟</span></div><div className="bar-chart">{last7.map((x,i)=><div className="bar-col" key={i}><div className="bar-track"><i style={{height:`${Math.max(5,x.value/max*100)}%`}} className={x.value ? 'filled':''}/></div><span>{x.label}</span></div>)}</div></div><div className="favorites"><div className="section-heading"><div><span>TOP</span><h2>常练动作</h2></div></div>{favorites.map(([name,count],i)=><div className="favorite-row" key={name}><span>0{i+1}</span><b>{name}</b><div><i style={{width:`${Math.max(20,count/(favorites[0]?.[1]||1)*100)}%`}}/></div><small>{count} 组</small></div>)}</div><button className="backup-btn" onClick={backup}><Download/> 导出训练数据备份 <small>JSON</small></button></section>
}

function WorkoutSheet({ workout, close, share }: { workout: Workout; close: () => void; share: () => void }) { return <div className="modal-backdrop" onClick={close}><div className="detail-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><small>WORKOUT DETAIL</small><h2>{formatDate(workout.date)}</h2></div><button onClick={close}><X/></button></div><div className="detail-metrics"><span><Clock3/> {workout.duration} 分钟</span><span><Dumbbell/> {workout.exercises.length} 个动作</span></div>{workout.exercises.map(e=><div className="detail-exercise" key={e.id}><b>{e.name}</b><span>{e.sets} × {e.reps}{e.weight ? ` × ${e.weight} kg`:''}</span></div>)}{workout.note&&<blockquote>“{workout.note}”</blockquote>}<button className="save-btn full" onClick={share}>分享这次训练 <Share2/></button></div></div> }

function ShareDialog({ workout, close, flash }: { workout: Workout; close: () => void; flash: (message: string) => void }) {
  const url = `${location.origin}${location.pathname}#share=${encodeWorkout(workout)}`
  const copy = async () => { try { await navigator.clipboard.writeText(url); flash('分享链接已复制') } catch { const input=document.createElement('textarea'); input.value=url; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove(); flash('分享链接已复制') } }
  const systemShare = async () => { if (!navigator.share) return copy(); try { await navigator.share({title:`${formatDate(workout.date)}训练记录`,text:`我的训练记录：${workout.exercises.length} 个动作`,url}) } catch { /* cancelled */ } }
  return <div className="modal-backdrop share-backdrop" onClick={close}><div className="share-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><small>SHARE WORKOUT</small><h2>分享训练链接</h2></div><button onClick={close}><X/></button></div><p className="share-help">任何人打开这个链接，都可以查看你在 {formatDate(workout.date)} 的训练内容。</p><div className="share-url"><Link2/><span>{url}</span></div><button className="save-btn full" onClick={copy}><Copy/> 复制可访问链接</button><div className="share-secondary"><button onClick={systemShare}><Share2/> 系统分享</button><a href={url} target="_blank" rel="noreferrer"><ExternalLink/> 打开预览</a></div><small className="privacy-note">链接中包含本次训练的只读快照，不会公开其他历史记录。</small></div></div>
}

function SharedWorkout({ workout }: { workout: Workout }) { return <div className="shared-page"><div className="shared-glow"/><header className="brand"><span className="brand-mark">练</span><div><b>练迹</b><small>SHARED WORKOUT</small></div></header><main><div className="share-label"><Link2/> 一份公开的训练记录</div><h1>{formatDate(workout.date)}<br/><em>完成训练。</em></h1><div className="shared-score"><div><b>{workout.duration}</b><span>分钟</span></div><div><b>{workout.exercises.length}</b><span>动作</span></div><div><b>{workout.feeling}/5</b><span>状态</span></div></div><div className="shared-list">{workout.exercises.map((e,i)=><div key={e.id}><span>{String(i+1).padStart(2,'0')}</span><b>{e.name}</b><small>{e.sets} 组 × {e.reps} 次 {e.weight > 0 && `× ${e.weight} kg`}</small></div>)}</div>{workout.note&&<blockquote>“{workout.note}”</blockquote>}<a className="save-btn full" href={location.pathname}>我也要记录 <Dumbbell/></a></main><footer>记录由 练迹 FITLOG 生成</footer></div> }

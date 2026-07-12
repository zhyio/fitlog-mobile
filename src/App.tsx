import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Flame, History, Link2, Plus, Share2, Sparkles, Trash2, Trophy, X } from 'lucide-react'

type Exercise = { id: string; name: string; sets: number; reps: number; weight: number }
type Workout = { date: string; duration: number; feeling: number; note: string; exercises: Exercise[] }
type Tab = 'today' | 'history' | 'stats'

const STORE_KEY = 'fitlog.workouts.v1'
const today = () => new Date().toLocaleDateString('en-CA')
const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
const formatDate = (value: string, withYear = false) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(`${value}T12:00:00`))
const volumeOf = (w: Workout) => w.exercises.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0)
const load = (): Workout[] => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') } catch { return [] } }
const seed = (): Workout[] => {
  const dates = [2, 4, 7, 9].map(days => { const d = new Date(); d.setDate(d.getDate() - days); return d.toLocaleDateString('en-CA') })
  return [
    { date: dates[0], duration: 52, feeling: 4, note: '状态不错，深蹲最后一组仍有余力。', exercises: [{ id: uid(), name: '杠铃深蹲', sets: 5, reps: 5, weight: 70 }, { id: uid(), name: '罗马尼亚硬拉', sets: 4, reps: 8, weight: 55 }] },
    { date: dates[1], duration: 46, feeling: 3, note: '控制节奏，肩部没有不适。', exercises: [{ id: uid(), name: '卧推', sets: 5, reps: 5, weight: 52.5 }, { id: uid(), name: '哑铃肩推', sets: 3, reps: 10, weight: 16 }] },
    { date: dates[2], duration: 38, feeling: 5, note: '轻松跑，呼吸稳定。', exercises: [{ id: uid(), name: '跑步', sets: 1, reps: 5, weight: 0 }, { id: uid(), name: '平板支撑', sets: 3, reps: 60, weight: 0 }] },
    { date: dates[3], duration: 58, feeling: 4, note: '背部发力感很好。', exercises: [{ id: uid(), name: '硬拉', sets: 5, reps: 3, weight: 90 }, { id: uid(), name: '高位下拉', sets: 4, reps: 10, weight: 45 }] },
  ]
}

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
  const [workouts, setWorkouts] = useState<Workout[]>(() => { const saved = load(); return saved.length ? saved : seed() })
  const [tab, setTab] = useState<Tab>('today')
  const [selected, setSelected] = useState<Workout | null>(null)
  const [toast, setToast] = useState('')
  const current = workouts.find(w => w.date === today()) || { date: today(), duration: 45, feeling: 4, note: '', exercises: [] }
  const [draft, setDraft] = useState<Workout>(current)

  const save = () => {
    if (!draft.exercises.length) return flash('先添加一个训练动作')
    const next = [...workouts.filter(w => w.date !== draft.date), draft].sort((a,b) => b.date.localeCompare(a.date))
    setWorkouts(next); localStorage.setItem(STORE_KEY, JSON.stringify(next)); flash('今天的训练已保存')
  }
  const flash = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  const share = async (workout: Workout) => {
    const url = `${location.origin}${location.pathname}#share=${encodeWorkout(workout)}`
    try {
      if (navigator.share) await navigator.share({ title: `${formatDate(workout.date)}训练记录`, text: `我完成了 ${workout.exercises.length} 个训练动作`, url })
      else { await navigator.clipboard.writeText(url); flash('分享链接已复制') }
    } catch { /* user cancelled */ }
  }

  if (shared) return <SharedWorkout workout={shared} />

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">练</span><div><b>练迹</b><small>FITLOG</small></div></div><div className="streak"><Flame size={15} fill="currentColor"/> 连续 3 天</div></header>
    <main>
      {tab === 'today' && <Today draft={draft} setDraft={setDraft} save={save} share={() => share(draft)} />}
      {tab === 'history' && <HistoryView workouts={workouts} open={setSelected} />}
      {tab === 'stats' && <Stats workouts={workouts} />}
    </main>
    <nav className="bottom-nav">
      <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}><Dumbbell/><span>训练</span></button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History/><span>历史</span></button>
      <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}><BarChart3/><span>统计</span></button>
    </nav>
    {selected && <WorkoutSheet workout={selected} close={() => setSelected(null)} share={() => share(selected)} />}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function Today({ draft, setDraft, save, share }: { draft: Workout; setDraft: (w: Workout) => void; save: () => void; share: () => void }) {
  const [adding, setAdding] = useState(false)
  const [exercise, setExercise] = useState({ name: '', sets: 4, reps: 8, weight: 20 })
  const add = () => { if (!exercise.name.trim()) return; setDraft({ ...draft, exercises: [...draft.exercises, { ...exercise, id: uid() }] }); setExercise({ name: '', sets: 4, reps: 8, weight: 20 }); setAdding(false) }
  return <section className="page today-page">
    <div className="date-kicker">{formatDate(draft.date, true)}</div>
    <div className="hero-row"><div><h1>今天，<br/><em>练点什么？</em></h1><p>每一次记录，都是下一次突破的证据。</p></div><div className="day-orbit"><span>{new Date().getDate()}</span><small>JUL</small></div></div>
    <div className="metrics-strip">
      <label><Clock3/><span><b>{draft.duration}</b> 分钟</span><input aria-label="训练时长" type="range" min="10" max="180" step="5" value={draft.duration} onChange={e => setDraft({...draft, duration: +e.target.value})}/></label>
      <div><Dumbbell/><span><b>{draft.exercises.length}</b> 个动作</span></div>
      <div><Sparkles/><span><b>{draft.feeling}/5</b> 状态</span></div>
    </div>
    <div className="section-heading"><div><span>01</span><h2>训练动作</h2></div><button className="text-btn" onClick={() => setAdding(true)}><Plus/> 添加</button></div>
    <div className="exercise-list">
      {draft.exercises.length === 0 && <button className="empty-card" onClick={() => setAdding(true)}><span><Plus/></span><b>添加第一个动作</b><small>力量、有氧、拉伸，都算数</small></button>}
      {draft.exercises.map((e, i) => <div className="exercise-card" key={e.id}><span className="index">{String(i + 1).padStart(2, '0')}</span><div className="exercise-main"><b>{e.name}</b><small>{e.sets} 组 × {e.reps} 次 {e.weight > 0 && `× ${e.weight} kg`}</small></div><button aria-label="删除" onClick={() => setDraft({...draft, exercises: draft.exercises.filter(x => x.id !== e.id)})}><Trash2/></button></div>)}
    </div>
    <div className="section-heading"><div><span>02</span><h2>训练感受</h2></div></div>
    <div className="feeling-row">{[1,2,3,4,5].map(n => <button key={n} className={draft.feeling === n ? 'active' : ''} onClick={() => setDraft({...draft, feeling: n})}>{['累趴','偏累','一般','不错','超棒'][n-1]}</button>)}</div>
    <textarea placeholder="今天有什么值得记住？" value={draft.note} onChange={e => setDraft({...draft, note: e.target.value})}/>
    <div className="action-row"><button className="share-btn" onClick={share}><Share2/></button><button className="save-btn" onClick={save}>完成训练 <ChevronRight/></button></div>
    {adding && <div className="modal-backdrop" onClick={() => setAdding(false)}><div className="add-sheet" onClick={e => e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><small>NEW EXERCISE</small><h2>添加动作</h2></div><button onClick={() => setAdding(false)}><X/></button></div><label>动作名称<input autoFocus placeholder="例如：杠铃深蹲" value={exercise.name} onChange={e => setExercise({...exercise, name: e.target.value})}/></label><div className="number-grid">{([['组数','sets'],['次数','reps'],['重量 kg','weight']] as const).map(([label,key]) => <label key={key}>{label}<input type="number" min="0" value={exercise[key]} onChange={e => setExercise({...exercise, [key]: +e.target.value})}/></label>)}</div><button className="save-btn full" onClick={add}>加入训练 <Plus/></button></div></div>}
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
  return <section className="page stats-page"><div className="eyebrow">PROGRESS / 数据洞察</div><h1>看见你的<br/><em>持续进步。</em></h1><div className="big-stat"><div><span>累计训练</span><b>{total}</b><small>次</small></div><Trophy/></div><div className="dual-stats"><div><Clock3/><span>训练时长</span><b>{Math.floor(minutes/60)}<small> 小时 </small>{minutes%60}<small> 分</small></b></div><div><Dumbbell/><span>训练容量</span><b>{(volume/1000).toFixed(1)}<small> 吨</small></b></div></div><div className="chart-card"><div className="card-head"><div><small>最近 7 天</small><b>训练时长</b></div><span>{last7.reduce((s,x)=>s+x.value,0)} 分钟</span></div><div className="bar-chart">{last7.map((x,i)=><div className="bar-col" key={i}><div className="bar-track"><i style={{height:`${Math.max(5,x.value/max*100)}%`}} className={x.value ? 'filled':''}/></div><span>{x.label}</span></div>)}</div></div><div className="favorites"><div className="section-heading"><div><span>TOP</span><h2>常练动作</h2></div></div>{favorites.map(([name,count],i)=><div className="favorite-row" key={name}><span>0{i+1}</span><b>{name}</b><div><i style={{width:`${Math.max(20,count/(favorites[0]?.[1]||1)*100)}%`}}/></div><small>{count} 组</small></div>)}</div></section>
}

function WorkoutSheet({ workout, close, share }: { workout: Workout; close: () => void; share: () => void }) { return <div className="modal-backdrop" onClick={close}><div className="detail-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><small>WORKOUT DETAIL</small><h2>{formatDate(workout.date)}</h2></div><button onClick={close}><X/></button></div><div className="detail-metrics"><span><Clock3/> {workout.duration} 分钟</span><span><Dumbbell/> {workout.exercises.length} 个动作</span></div>{workout.exercises.map(e=><div className="detail-exercise" key={e.id}><b>{e.name}</b><span>{e.sets} × {e.reps}{e.weight ? ` × ${e.weight} kg`:''}</span></div>)}{workout.note&&<blockquote>“{workout.note}”</blockquote>}<button className="save-btn full" onClick={share}>分享这次训练 <Share2/></button></div></div> }

function SharedWorkout({ workout }: { workout: Workout }) { return <div className="shared-page"><div className="shared-glow"/><header className="brand"><span className="brand-mark">练</span><div><b>练迹</b><small>SHARED WORKOUT</small></div></header><main><div className="share-label"><Link2/> 一份公开的训练记录</div><h1>{formatDate(workout.date)}<br/><em>完成训练。</em></h1><div className="shared-score"><div><b>{workout.duration}</b><span>分钟</span></div><div><b>{workout.exercises.length}</b><span>动作</span></div><div><b>{workout.feeling}/5</b><span>状态</span></div></div><div className="shared-list">{workout.exercises.map((e,i)=><div key={e.id}><span>{String(i+1).padStart(2,'0')}</span><b>{e.name}</b><small>{e.sets} 组 × {e.reps} 次 {e.weight > 0 && `× ${e.weight} kg`}</small></div>)}</div>{workout.note&&<blockquote>“{workout.note}”</blockquote>}<a className="save-btn full" href={location.pathname}>我也要记录 <Dumbbell/></a></main><footer>记录由 练迹 FITLOG 生成</footer></div> }

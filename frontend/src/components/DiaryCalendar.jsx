import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '../lib/api'

// 日记日历：标记哪些天发过日记（含数量），点击进主页按天筛选
export default function DiaryCalendar({ userId }) {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => dayjs())
  const [days, setDays] = useState({})

  useEffect(() => {
    if (!userId) return
    api.getDiaryDays(userId, month.year(), month.month() + 1)
      .then(data => setDays(data.days || {}))
      .catch(() => setDays({}))
  }, [userId, month])

  const cells = useMemo(() => {
    const first = month.startOf('month')
    const offset = first.day() // 周日开头
    const total = month.daysInMonth()
    const list = []
    for (let i = 0; i < offset; i++) list.push(null)
    for (let d = 1; d <= total; d++) list.push(d)
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [month])

  const today = dayjs().format('YYYY-MM-DD')
  const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="bg-white rounded-2xl border border-stone-100 mb-4 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-text-main">{month.format('YYYY 年 M 月')}</p>
        <div className="flex gap-1">
          <button
            onClick={() => setMonth(m => m.subtract(1, 'month'))}
            className="w-7 h-7 rounded-full bg-stone-100 text-text-sub text-sm flex items-center justify-center"
          >‹</button>
          <button
            onClick={() => setMonth(dayjs())}
            className="h-7 px-2.5 rounded-full bg-stone-100 text-text-sub text-xs flex items-center justify-center"
          >今天</button>
          <button
            onClick={() => setMonth(m => m.add(1, 'month'))}
            className="w-7 h-7 rounded-full bg-stone-100 text-text-sub text-sm flex items-center justify-center"
          >›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekLabels.map(w => (
          <div key={w} className="text-[10px] text-muted py-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = month.date(d).format('YYYY-MM-DD')
          const count = days[key] || 0
          const isToday = key === today
          return (
            <button
              key={i}
              onClick={() => count > 0 && navigate('/users/' + userId + '?date=' + key)}
              disabled={count === 0}
              className="flex flex-col items-center py-1.5 rounded-lg"
            >
              <span className={
                'text-xs w-7 h-7 flex items-center justify-center rounded-full ' +
                (isToday ? 'bg-primary text-white font-medium' : (count > 0 ? 'text-primary font-medium' : 'text-text-sub'))
              }>
                {d}
              </span>
              <span className="h-3 mt-0.5">
                {count > 0 && (
                  <span className="inline-block min-w-[12px] h-3 px-0.5 rounded-full bg-primary-light text-primary text-[9px] leading-3">
                    {count}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

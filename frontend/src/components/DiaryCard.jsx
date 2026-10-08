import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { parseImages } from '../lib/images'

const visibilityMap = {
  public: { label: '公开', color: 'bg-stone-100 text-stone-600' },
  partner: { label: '伴侣', color: 'bg-primary-light text-primary' },
  friend: { label: '朋友', color: 'bg-sky-50 text-sky-600' },
  family: { label: '家人', color: 'bg-violet-50 text-violet-600' },
  private: { label: '仅自己', color: 'bg-amber-50 text-amber-600' },
}

function visibilityOf(raw) {
  const tokens = String(raw || 'public').split(',').map(t => t.trim()).filter(Boolean)
  const first = tokens[0] || 'public'
  const base = visibilityMap[first] || visibilityMap.public
  const label = tokens.map(t => (visibilityMap[t] || {}).label || t).join('·')
  return { label, color: base.color }
}

export default function DiaryCard({ diary }) {
  const v = visibilityOf(diary.visibility)
  const images = parseImages(diary.images)

  return (
    <Link to={"/diaries/" + diary.id} className="block bg-white rounded-2xl p-4 mb-3 shadow-sm border border-stone-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-medium text-sm overflow-hidden">
          {diary.author?.avatar ? (
            <img src={diary.author.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            (diary.author?.nick_name || diary.author?.username || '?').slice(0, 1)
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-text-main">{diary.author?.nick_name || diary.author?.username}</div>
          <div className="text-xs text-muted">{dayjs(diary.created_at).format('YYYY-MM-DD HH:mm')}</div>
        </div>
        <span className={"text-xs px-2 py-1 rounded-full " + v.color}>{v.label}</span>
      </div>

      {diary.title && <h3 className="text-base font-semibold text-text-main mb-2">{diary.title}</h3>}
      <p className="text-sm text-text-sub leading-relaxed line-clamp-4 mb-3 whitespace-pre-wrap">{diary.content}</p>

      {images.length > 0 && (
        <div className={"grid gap-2 " + (images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {images.slice(0, 4).map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {idx === 3 && images.length > 4 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm font-medium">
                  +{images.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

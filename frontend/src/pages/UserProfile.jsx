import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '../lib/api'
import { useLoginModal } from '../contexts/LoginModalContext'
import DiaryCard from '../components/DiaryCard'
import PageHeader from '../components/PageHeader'

export default function UserProfile({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const [profile, setProfile] = useState(null)
  const [diaries, setDiaries] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFilter = searchParams.get('date') || ''
  const [visFilter, setVisFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const isSelf = user && user.id === id

  useEffect(() => {
    if (!user) {
      openLoginModal('查看用户主页需要登录')
      return
    }
    loadData()
  }, [id, user, dateFilter, visFilter])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [userInfo, diariesData, followData] = await Promise.all([
        api.getUser(id),
        api.getUserDiaries(id, { date: dateFilter, visibility: visFilter || undefined }),
        api.getFollowStatus(id).catch(() => ({ isFollowing: false })),
      ])
      setProfile(userInfo)
      // 用户主页接口不附带 author 字段，DiaryCard 需要 author，这里补一份
      const author = { id: userInfo.id, username: userInfo.username, nick_name: userInfo.nickName, avatar: userInfo.avatar }
      setDiaries((diariesData.diaries || []).map(d => ({ ...d, author })))
      setIsFollowing(!!followData.isFollowing)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFollow() {
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await api.unfollowUser(id)
        setIsFollowing(false)
      } else {
        await api.followUser(id)
        setIsFollowing(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-sub">加载中...</div>
    )
  }
  if (error || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">{error || '用户不存在'}</div>
    )
  }

  const name = profile.nickName || profile.username || '用户'

  return (
    <div className="flex-1 bg-surface">
      <PageHeader title="用户主页" />

      <div className="px-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-100 mb-4">
          <div className="flex items-center gap-4">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-16 h-16 rounded-full object-cover bg-stone-100" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center text-primary text-xl font-medium">
                {name.slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-text-main truncate">{name}</p>
              <p className="text-xs text-text-sub mt-0.5">{diaries.length} 篇日记 · 积分 {profile.points ?? 0}</p>
            </div>
            {!isSelf && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={"flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 " + (isFollowing ? 'bg-stone-100 text-text-sub' : 'bg-primary text-white')}
              >
                {followLoading ? '处理中' : (isFollowing ? '已关注' : '关注')}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs bg-white border border-stone-200 text-text-main"
          >
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10m-7 8h4" />
            </svg>
            筛选
            <svg className="w-3 h-3 text-text-sub" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dateFilter && (
            <span className="text-xs px-2.5 py-1.5 rounded-full bg-primary-light text-primary">
              {dayjs(dateFilter).format('M月D日')}
            </span>
          )}
          {visFilter && (
            <span className="text-xs px-2.5 py-1.5 rounded-full bg-primary-light text-primary">
              {{ public: '公开', partner: '伴侣', friend: '朋友', family: '家人', private: '仅自己' }[visFilter]}
            </span>
          )}
          {(dateFilter || visFilter) && (
            <button
              onClick={() => { setSearchParams({}); setVisFilter('') }}
              className="text-xs text-text-sub underline underline-offset-2"
            >
              清除
            </button>
          )}
        </div>

        {diaries.length === 0 ? (
          <div className="text-center py-12 text-text-sub text-sm">
            {(dateFilter || visFilter) ? '该筛选条件下没有日记' : (isSelf ? '还没有日记，去写第一篇吧' : 'TA 还没有公开可见的日记')}
          </div>
        ) : (
          diaries.map(diary => <DiaryCard key={diary.id} diary={diary} />)
        )}
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setFilterOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-semibold text-text-main mb-4">筛选日记</h3>

            <p className="text-xs text-text-sub mb-2">时间</p>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="date"
                value={dateFilter}
                onChange={e => setSearchParams(e.target.value ? { date: e.target.value } : {})}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-text-main focus:outline-none focus:border-primary"
              />
              {dateFilter && (
                <button
                  onClick={() => setSearchParams({})}
                  className="text-xs px-3 py-2.5 rounded-xl bg-stone-100 text-text-sub"
                >
                  清除
                </button>
              )}
            </div>

            <p className="text-xs text-text-sub mb-2">分类（可查看范围）</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { key: '', label: '全部' },
                { key: 'public', label: '公开' },
                { key: 'partner', label: '伴侣' },
                { key: 'friend', label: '朋友' },
                { key: 'family', label: '家人' },
                { key: 'private', label: '仅自己' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setVisFilter(opt.key)}
                  className={"px-4 py-2 rounded-full text-sm " + (visFilter === opt.key ? 'bg-primary text-white' : 'bg-stone-100 text-text-sub')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterOpen(false)}
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

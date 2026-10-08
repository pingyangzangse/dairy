import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

  const isSelf = user && user.id === id

  useEffect(() => {
    if (!user) {
      openLoginModal('查看用户主页需要登录')
      return
    }
    loadData()
  }, [id, user])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [userInfo, diariesData, followData] = await Promise.all([
        api.getUser(id),
        api.getUserDiaries(id),
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
              <p className="text-xs text-text-sub mt-0.5">{diaries.length} 篇日记</p>
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

        {diaries.length === 0 ? (
          <div className="text-center py-12 text-text-sub text-sm">TA 还没有公开可见的日记</div>
        ) : (
          diaries.map(diary => <DiaryCard key={diary.id} diary={diary} />)
        )}
      </div>
    </div>
  )
}

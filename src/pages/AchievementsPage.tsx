import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { badgeRules } from '../mock/badges'
import { fetchMeStatsFromServer } from '../services/meApi'
import { useAppStore } from '../store/useAppStore'

export function AchievementsPage() {
  const account = useAppStore((state) => state.account)
  const profileName = useAppStore((state) => state.profileName)
  const profileAvatar = useAppStore((state) => state.profileAvatar)
  const logout = useAppStore((state) => state.logout)
  const updateProfile = useAppStore((state) => state.updateProfile)
  const posts = useAppStore((state) => state.posts)
  const favoritePostIds = useAppStore((state) => state.favoritePostIds)
  const favoriteSpiritIds = useAppStore((state) => state.favoriteSpiritIds)
  const myAnswerCount = useAppStore((state) => state.myAnswerCount)
  const identifyCount = useAppStore((state) => state.identifyHistory.length)

  const navigate = useNavigate()

  const [draftName, setDraftName] = useState(profileName)
  const [draftAvatar, setDraftAvatar] = useState(profileAvatar)
  const [serverHint, setServerHint] = useState('')
  const [serverStats, setServerStats] = useState<{
    publish: number
    answer: number
    favorite: number
    identify: number
  } | null>(null)

  useEffect(() => {
    setDraftName(profileName)
    setDraftAvatar(profileAvatar)
  }, [profileAvatar, profileName])

  const localStats = useMemo(() => {
    const publishCount = posts.filter((post) => {
      if (post.ownerAccount) {
        return post.ownerAccount === account
      }
      return post.author === account || post.author === profileName
    }).length

    const favoriteCount = favoritePostIds.length + favoriteSpiritIds.length

    return {
      publish: publishCount,
      answer: myAnswerCount,
      favorite: favoriteCount,
      identify: identifyCount,
    }
  }, [account, favoritePostIds.length, favoriteSpiritIds.length, identifyCount, myAnswerCount, posts, profileName])

  useEffect(() => {
    let active = true

    void (async () => {
      const result = await fetchMeStatsFromServer({
        account,
        profileName,
        favoriteCount: localStats.favorite,
        identifyCount: localStats.identify,
      })

      if (!active) {
        return
      }

      if (result.ok) {
        setServerStats({
          publish: result.data.publish,
          answer: result.data.answer,
          favorite: result.data.favorite,
          identify: result.data.identify,
        })
        setServerHint('')
        return
      }

      setServerStats(null)
      setServerHint(result.message ?? '个人统计暂时不可用，已使用本地统计。')
    })()

    return () => {
      active = false
    }
  }, [account, profileName, localStats.favorite, localStats.identify, posts.length, myAnswerCount])

  const stats = serverStats ?? localStats

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setDraftAvatar(URL.createObjectURL(file))
  }

  const onSaveProfile = (event: FormEvent) => {
    event.preventDefault()
    updateProfile(draftName.trim() || profileName, draftAvatar)
  }

  const onSwitchAccount = () => {
    navigate('/login', {
      replace: true,
      state: {
        notice: '已退出当前账号，请切换登录',
      },
    })
    window.setTimeout(() => {
      logout()
    }, 0)
  }

  const onLogout = () => {
    navigate('/welcome', { replace: true })
    window.setTimeout(() => {
      logout()
    }, 0)
  }

  return (
    <div>
      <PageHeader title="我的成就" subtitle="记录你的发布、解答、识别与收藏足迹" />

      <main className="space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <img
              data-testid="profile-display-avatar"
              src={profileAvatar}
              alt="我的头像"
              className="h-16 w-16 rounded-full border border-[var(--line)] object-cover"
            />
            <div className="flex-1">
              <p data-testid="profile-display-name" className="text-base font-bold text-[var(--text-main)]">
                {profileName || '未设置昵称'}
              </p>
              <p className="text-xs text-[var(--text-soft)]">账号：{account || '未登录'}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              data-testid="profile-switch-account"
              type="button"
              onClick={onSwitchAccount}
              className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--card-soft)] text-sm font-semibold text-[var(--accent-deep)]"
            >
              切换账号
            </button>
            <button
              data-testid="profile-logout"
              type="button"
              onClick={onLogout}
              className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600"
            >
              退出登录
            </button>
          </div>

          <form className="mt-4 grid gap-3" onSubmit={onSaveProfile}>
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">
                昵称
              </label>
              <input
                id="profile-name"
                data-testid="profile-name-input"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--card-soft)] px-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="profile-avatar" className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">
                更换头像
              </label>
              <input
                id="profile-avatar"
                data-testid="profile-avatar-input"
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                className="block w-full text-xs text-[var(--text-soft)]"
              />
            </div>

            <button
              data-testid="profile-save"
              type="submit"
              className="h-10 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--text-main)]"
            >
              保存资料
            </button>
          </form>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <article className="rounded-2xl border border-[var(--line)] bg-white p-3 text-center shadow-sm">
            <p className="text-xs text-[var(--text-soft)]">发布</p>
            <p data-testid="me-stat-publish" className="mt-1 text-xl font-bold text-[var(--text-main)]">
              {stats.publish}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white p-3 text-center shadow-sm">
            <p className="text-xs text-[var(--text-soft)]">解答</p>
            <p data-testid="me-stat-answer" className="mt-1 text-xl font-bold text-[var(--text-main)]">
              {stats.answer}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white p-3 text-center shadow-sm">
            <p className="text-xs text-[var(--text-soft)]">收藏</p>
            <p data-testid="me-stat-favorite" className="mt-1 text-xl font-bold text-[var(--text-main)]">
              {stats.favorite}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white p-3 text-center shadow-sm">
            <p className="text-xs text-[var(--text-soft)]">识别</p>
            <p data-testid="me-stat-identify" className="mt-1 text-xl font-bold text-[var(--text-main)]">
              {stats.identify}
            </p>
          </article>
        </section>

        {serverHint ? <p className="text-xs text-[var(--text-soft)]">{serverHint}</p> : null}

        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[var(--text-main)]">成就勋章墙</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {badgeRules.map((badge) => {
              const current = stats[badge.metric]
              const unlocked = current >= badge.threshold
              return (
                <li
                  key={badge.id}
                  className={`rounded-xl border p-3 transition ${
                    unlocked
                      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
                      : 'border-[var(--line)] bg-[var(--card-soft)]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        unlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-[var(--text-soft)]'
                      }`}
                    >
                      <MaterialSymbol name={badge.icon} className="text-[20px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--text-main)]">{badge.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">{badge.description}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-soft)]">
                    进度：{Math.min(current, badge.threshold)}/{badge.threshold}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      </main>
    </div>
  )
}

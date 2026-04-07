import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authUsersSeed, defaultProfileAvatar } from '../mock/auth'
import type { AuthUserSeed } from '../mock/auth'
import { communityPostsSeed } from '../mock/community'
import { analytics } from '../services/analytics'
import type {
  AnnotationPoint,
  CanonicalIdentifySnapshot,
  CommunityFloorRole,
  CommunityPost,
  RecognitionResult,
} from '../types/models'
import { useUiStore } from './useUiStore'

interface PublishPayload {
  title: string
  content: string
  image?: string
  markdown?: string
  mentions?: string[]
  topics?: string[]
}

interface AnswerPayload {
  content: string
  image?: string
  role?: CommunityFloorRole
  replyToFloor?: number
  markdown?: string
  annotations?: AnnotationPoint[]
}

interface LoginResult {
  ok: boolean
  reason?: 'empty' | 'invalid'
}

interface RegisterPayload {
  account: string
  password: string
  nickname: string
}

interface RegisterResult {
  ok: boolean
  reason?: 'empty' | 'exists'
}

interface ResetPasswordResult {
  ok: boolean
  reason?: 'empty' | 'not_found' | 'same_as_old'
}

interface AppState {
  accounts: AuthUserSeed[]
  isLoggedIn: boolean
  account: string
  profileName: string
  profileAvatar: string
  posts: CommunityPost[]
  favoriteSpiritIds: string[]
  favoritePostIds: string[]
  favoriteEncyclopediaIds: string[]
  recentEncyclopediaIds: string[]
  identifyHistory: RecognitionResult[]
  spiritIdentifyHistory: RecognitionResult[]
  latestIdentifySnapshot: CanonicalIdentifySnapshot | null
  myAnswerCount: number
  login: (account: string, password: string) => LoginResult
  register: (payload: RegisterPayload) => RegisterResult
  resetPassword: (account: string, nextPassword: string) => ResetPasswordResult
  logout: () => void
  updateProfile: (name: string, avatar: string) => void
  addCommunityPost: (payload: PublishPayload) => void
  addAnswer: (postId: string, payload: string | AnswerPayload) => void
  updatePostStatus: (postId: string, status: CommunityPost['status']) => void
  toggleFavoriteSpirit: (spiritId: string) => void
  toggleFavoritePost: (postId: string) => void
  toggleFavoriteEncyclopedia: (entryId: string) => void
  addRecentEncyclopedia: (entryId: string) => void
  addIdentifyRecord: (result: RecognitionResult) => void
  addSpiritIdentifyRecord: (result: RecognitionResult) => void
  setLatestIdentifySnapshot: (snapshot: CanonicalIdentifySnapshot | null) => void
}

const nowLabel = () => '刚刚'

const extractMentions = (value: string) => {
  const matches = value.match(/@[\w\u4e00-\u9fa5_-]+/g)
  return matches ? Array.from(new Set(matches.map((item) => item.slice(1)))) : []
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: authUsersSeed,
      isLoggedIn: false,
      account: '',
      profileName: '',
      profileAvatar: defaultProfileAvatar,
      posts: communityPostsSeed,
      favoriteSpiritIds: [],
      favoritePostIds: [],
      favoriteEncyclopediaIds: [],
      recentEncyclopediaIds: [],
      identifyHistory: [],
      spiritIdentifyHistory: [],
      latestIdentifySnapshot: null,
      myAnswerCount: 0,
      login: (account, password) => {
        const normalizedAccount = account.trim()
        const normalizedPassword = password.trim()

        if (!normalizedAccount || !normalizedPassword) {
          return { ok: false, reason: 'empty' }
        }

        const matched = get().accounts.find(
          (entry) => entry.account === normalizedAccount && entry.password === normalizedPassword,
        )

        if (!matched) {
          return { ok: false, reason: 'invalid' }
        }

        set((state) => ({
          isLoggedIn: true,
          account: matched.account,
          profileName: matched.nickname,
          profileAvatar: matched.avatar || defaultProfileAvatar,
          posts: state.posts.map((post) => {
            if (post.ownerAccount || post.author !== matched.nickname) {
              return post
            }
            return {
              ...post,
              ownerAccount: matched.account,
            }
          }),
        }))

        analytics.track('auth_login', '/login', { success: true })
        useUiStore.getState().pushToast({ level: 'success', message: `欢迎回来，${matched.nickname}` })

        return { ok: true }
      },
      register: ({ account, password, nickname }) => {
        const normalizedAccount = account.trim()
        const normalizedPassword = password.trim()
        const normalizedNickname = nickname.trim()

        if (!normalizedAccount || !normalizedPassword || !normalizedNickname) {
          return { ok: false, reason: 'empty' }
        }

        const exists = get().accounts.some((entry) => entry.account === normalizedAccount)
        if (exists) {
          return { ok: false, reason: 'exists' }
        }

        const nextUser: AuthUserSeed = {
          account: normalizedAccount,
          password: normalizedPassword,
          nickname: normalizedNickname,
          avatar: defaultProfileAvatar,
        }

        set((state) => ({
          accounts: [...state.accounts, nextUser],
        }))

        analytics.track('auth_register', '/register')

        return { ok: true }
      },
      resetPassword: (account, nextPassword) => {
        const normalizedAccount = account.trim()
        const normalizedPassword = nextPassword.trim()

        if (!normalizedAccount || !normalizedPassword) {
          return { ok: false, reason: 'empty' }
        }

        const matched = get().accounts.find((entry) => entry.account === normalizedAccount)
        if (!matched) {
          return { ok: false, reason: 'not_found' }
        }

        if (matched.password === normalizedPassword) {
          return { ok: false, reason: 'same_as_old' }
        }

        set((state) => ({
          accounts: state.accounts.map((entry) =>
            entry.account === normalizedAccount
              ? {
                  ...entry,
                  password: normalizedPassword,
                }
              : entry,
          ),
        }))

        analytics.track('auth_reset_password', '/forgot-password')

        return { ok: true }
      },
      logout: () => {
        set({
          isLoggedIn: false,
          account: '',
          profileName: '',
          profileAvatar: defaultProfileAvatar,
        })
      },
      updateProfile: (name, avatar) => {
        set((state) => ({
          profileName: name.trim() || state.profileName,
          profileAvatar: avatar || state.profileAvatar,
        }))
      },
      addCommunityPost: ({ title, content, image, markdown, mentions, topics }) => {
        const nextPost: CommunityPost = {
          id: `post-${Date.now()}`,
          title,
          content,
          image,
          markdown,
          mentions,
          topics,
          status: 'open',
          author: get().profileName || get().account || '我',
          ownerAccount: get().account || undefined,
          createdAt: nowLabel(),
          likes: 0,
          answers: [],
        }

        set((state) => ({ posts: [nextPost, ...state.posts] }))
        analytics.track('community_post_publish', '/community/new')
      },
      addAnswer: (postId, payload) => {
        const normalizedPayload: AnswerPayload =
          typeof payload === 'string'
            ? {
                content: payload,
                role: 'answer',
              }
            : {
                ...payload,
                content: payload.content.trim(),
                role: payload.role ?? 'answer',
              }

        if (!normalizedPayload.content) {
          return
        }

        const answerId = `ans-${Date.now()}`

        set((state) => {
          const isAnswer = normalizedPayload.role !== 'followup'
          const mentionTargets = extractMentions(normalizedPayload.content)

          const targetPost = state.posts.find((post) => post.id === postId)
          if (targetPost) {
            useUiStore.getState().pushNotification({
              type: 'reply',
              title: `帖子有新${isAnswer ? '回复' : '追问'}`,
              message: `${targetPost.title}`,
            })
          }

          mentionTargets.forEach((mention) => {
            useUiStore.getState().pushNotification({
              type: 'mention',
              title: `你被 @${mention}`,
              message: normalizedPayload.content,
            })
          })

          return {
            myAnswerCount: isAnswer ? state.myAnswerCount + 1 : state.myAnswerCount,
            posts: state.posts.map((post) => {
              if (post.id !== postId) {
                return post
              }

              const nextFloor = post.answers.length + 2

              return {
                ...post,
                status: isAnswer ? 'solved' : 'open',
                answers: [
                  ...post.answers,
                  {
                    id: answerId,
                    author: state.profileName || state.account || '我',
                    content: normalizedPayload.content,
                    markdown: normalizedPayload.markdown,
                    createdAt: nowLabel(),
                    role: normalizedPayload.role,
                    image: normalizedPayload.image,
                    floor: nextFloor,
                    replyToFloor: normalizedPayload.replyToFloor,
                    fromMe: true,
                    annotations: normalizedPayload.annotations,
                  },
                ],
              }
            }),
          }
        })

        analytics.track('community_reply_publish', `/community/${postId}`)
      },
      updatePostStatus: (postId, status) => {
        set((state) => ({
          posts: state.posts.map((post) => (post.id === postId ? { ...post, status } : post)),
        }))
      },
      toggleFavoriteSpirit: (spiritId) => {
        set((state) => {
          const exists = state.favoriteSpiritIds.includes(spiritId)
          return {
            favoriteSpiritIds: exists
              ? state.favoriteSpiritIds.filter((id) => id !== spiritId)
              : [...state.favoriteSpiritIds, spiritId],
          }
        })
      },
      toggleFavoritePost: (postId) => {
        set((state) => {
          const exists = state.favoritePostIds.includes(postId)
          const next = exists
            ? state.favoritePostIds.filter((id) => id !== postId)
            : [...state.favoritePostIds, postId]

          if (!exists) {
            useUiStore.getState().pushNotification({
              type: 'like',
              title: '帖子收藏成功',
              message: `你已收藏帖子 ${postId}`,
            })
          }

          return {
            favoritePostIds: next,
          }
        })
      },
      toggleFavoriteEncyclopedia: (entryId) => {
        set((state) => {
          const exists = state.favoriteEncyclopediaIds.includes(entryId)
          return {
            favoriteEncyclopediaIds: exists
              ? state.favoriteEncyclopediaIds.filter((id) => id !== entryId)
              : [...state.favoriteEncyclopediaIds, entryId],
          }
        })
      },
      addRecentEncyclopedia: (entryId) => {
        set((state) => ({
          recentEncyclopediaIds: [entryId, ...state.recentEncyclopediaIds.filter((id) => id !== entryId)].slice(0, 20),
        }))
      },
      addIdentifyRecord: (result) => {
        set((state) => ({ identifyHistory: [result, ...state.identifyHistory].slice(0, 20) }))
      },
      addSpiritIdentifyRecord: (result) => {
        set((state) => ({ spiritIdentifyHistory: [result, ...state.spiritIdentifyHistory].slice(0, 20) }))
      },
      setLatestIdentifySnapshot: (snapshot) => {
        set({
          latestIdentifySnapshot: snapshot ? { ...snapshot } : null,
        })
      },
    }),
    {
      name: 'summer-wood-app-store',
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<AppState>
        return {
          ...state,
          posts: communityPostsSeed,
        } as AppState
      },
      partialize: (state) => ({
        accounts: state.accounts,
        isLoggedIn: state.isLoggedIn,
        account: state.account,
        profileName: state.profileName,
        profileAvatar: state.profileAvatar,
        posts: state.posts,
        favoriteSpiritIds: state.favoriteSpiritIds,
        favoritePostIds: state.favoritePostIds,
        favoriteEncyclopediaIds: state.favoriteEncyclopediaIds,
        recentEncyclopediaIds: state.recentEncyclopediaIds,
        identifyHistory: state.identifyHistory,
        spiritIdentifyHistory: state.spiritIdentifyHistory,
        latestIdentifySnapshot: state.latestIdentifySnapshot,
        myAnswerCount: state.myAnswerCount,
      }),
    },
  ),
)

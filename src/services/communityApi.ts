import type { CommunityFloorRole, CommunityPost } from '../types/models'
import { normalizeCommunityPost } from './modelGuards'
import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

interface CommunityReplyPayload {
  content: string
  image?: string
  role?: CommunityFloorRole
  replyToFloor?: number
  markdown?: string
  annotations?: Array<{ x: number; y: number }>
}

export async function fetchCommunityPostsFromServer(query?: string): Promise<RemoteResult<CommunityPost[]>> {
  if (!apiClient) {
    return {
      ok: false,
      data: [],
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前使用本地社区数据。',
    }
  }

  try {
    const payload = await apiClient.get<{ items?: unknown[]; data?: unknown[] }>('/community/posts', {
      query: {
        q: query?.trim() || undefined,
      },
      retries: 1,
      requestKey: 'community-search',
      timeoutMessage: '社区帖子请求超时，请稍后重试。',
    })

    const rawItems = payload.items ?? payload.data ?? []
    const normalized = Array.isArray(rawItems)
      ? rawItems
          .map((item, index) => normalizeCommunityPost(item, index))
          .filter((item): item is CommunityPost => Boolean(item))
      : []

    return {
      ok: true,
      data: normalized,
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: [],
      reason: 'request_failed',
      message,
    }
  }
}

export async function createCommunityPostOnServer(payload: {
  title: string
  content: string
  image?: string
  markdown?: string
  mentions?: string[]
  topics?: string[]
}): Promise<RemoteResult<{ id?: string }>> {
  if (!apiClient) {
    return {
      ok: false,
      data: {},
      reason: 'not_configured',
    }
  }

  try {
    const data = await apiClient.post<{ id?: string }>('/community/posts', {
      body: payload,
      requestKey: 'community-create-post',
      timeoutMessage: '发帖请求超时，请稍后重试。',
    })

    return {
      ok: true,
      data,
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: {},
      reason: 'request_failed',
      message,
    }
  }
}

export async function createCommunityReplyOnServer(
  postId: string,
  payload: CommunityReplyPayload,
): Promise<RemoteResult<{ id?: string }>> {
  if (!apiClient) {
    return {
      ok: false,
      data: {},
      reason: 'not_configured',
    }
  }

  try {
    const data = await apiClient.post<{ id?: string }>(`/community/posts/${postId}/replies`, {
      body: payload,
      requestKey: `community-reply-${postId}`,
      timeoutMessage: '回帖请求超时，请稍后重试。',
    })

    return {
      ok: true,
      data,
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: {},
      reason: 'request_failed',
      message,
    }
  }
}

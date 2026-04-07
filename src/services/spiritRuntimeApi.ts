import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

export interface SpiritRuntimeStatus {
  ready: boolean
  comfyuiOnline: boolean
  baseUrl: string
  workflowPath: string
  workflowLoaded: boolean
  workflowModeCandidate: string
  workflowReason: string
  checkpointCount: number
  checkpointNames: string[]
  checkpointSelected: string
  weilinAvailable: boolean
  generatedAt: string
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const normalizeRuntimeStatus = (payload: unknown): SpiritRuntimeStatus => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const checkpointSource = record.checkpointNames ?? record.checkpoint_names

  const checkpointNames = Array.isArray(checkpointSource)
    ? checkpointSource
        .map((item: unknown) => String(item ?? '').trim())
        .filter(Boolean)
    : []

  return {
    ready: Boolean(record.ready),
    comfyuiOnline: Boolean(record.comfyuiOnline ?? record.comfyui_online),
    baseUrl: String(record.baseUrl ?? record.base_url ?? '').trim(),
    workflowPath: String(record.workflowPath ?? record.workflow_path ?? '').trim(),
    workflowLoaded: Boolean(record.workflowLoaded ?? record.workflow_loaded),
    workflowModeCandidate: String(record.workflowModeCandidate ?? record.workflow_mode_candidate ?? '').trim(),
    workflowReason: String(record.workflowReason ?? record.workflow_reason ?? '').trim(),
    checkpointCount: Number.isFinite(Number(record.checkpointCount ?? record.checkpoint_count))
      ? Number(record.checkpointCount ?? record.checkpoint_count)
      : checkpointNames.length,
    checkpointNames,
    checkpointSelected: String(record.checkpointSelected ?? record.checkpoint_selected ?? '').trim(),
    weilinAvailable: Boolean(record.weilinAvailable ?? record.weilin_available),
    generatedAt: String(record.generatedAt ?? record.generated_at ?? '').trim(),
  }
}

export async function fetchSpiritRuntimeStatusFromServer(): Promise<RemoteResult<SpiritRuntimeStatus>> {
  if (!apiClient) {
    return {
      ok: false,
      data: normalizeRuntimeStatus({}),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法检测生图引擎状态。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>('/spirit/runtime', {
      requestKey: 'spirit-runtime-status',
      timeoutMessage: '生图引擎状态检测超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeRuntimeStatus(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: normalizeRuntimeStatus({}),
      reason: 'request_failed',
      message,
    }
  }
}

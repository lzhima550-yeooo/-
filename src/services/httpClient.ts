export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  requestKey?: string
  cancelPrevious?: boolean
  retries?: number
  retryDelayMs?: number
  timeoutMessage?: string
}

export interface HttpClientOptions {
  baseUrl: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  defaultHeaders?: Record<string, string>
}

export class HttpError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.payload = payload
  }
}

const defaultTimeoutMs = 12_000

const encodeQueryValue = (value: string | number | boolean) => encodeURIComponent(String(value))

const appendQuery = (path: string, query?: HttpRequestOptions['query']) => {
  if (!query) {
    return path
  }

  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null)
  if (entries.length === 0) {
    return path
  }

  const queryText = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeQueryValue(value as string | number | boolean)}`)
    .join('&')

  const divider = path.includes('?') ? '&' : '?'
  return `${path}${divider}${queryText}`
}

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

const shouldRetry = (method: HttpMethod, error: unknown) => {
  if (method !== 'GET') {
    return false
  }

  if (error instanceof HttpError) {
    return error.status >= 500
  }

  return true
}

const emitTimeoutToast = (message: string) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: {
        type: 'error',
        message,
      },
    }),
  )
}

export function createHttpClient(options: HttpClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const defaultHeaders = options.defaultHeaders ?? {}
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs

  let authToken = ''
  const controllerMap = new Map<string, AbortController>()

  const cancelRequest = (requestKey: string) => {
    const controller = controllerMap.get(requestKey)
    if (controller) {
      controller.abort(new Error('Request canceled'))
      controllerMap.delete(requestKey)
    }
  }

  const request = async <T>(
    method: HttpMethod,
    path: string,
    requestOptions: HttpRequestOptions = {},
    attempt = 0,
  ): Promise<T> => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs)

    const requestKey = requestOptions.requestKey?.trim()
    const cancelPrevious = requestOptions.cancelPrevious !== false
    if (requestKey) {
      if (cancelPrevious) {
        cancelRequest(requestKey)
      }
      controllerMap.set(requestKey, controller)
    }

    if (requestOptions.signal) {
      if (requestOptions.signal.aborted) {
        controller.abort(requestOptions.signal.reason)
      } else {
        requestOptions.signal.addEventListener('abort', () => controller.abort(requestOptions.signal?.reason), {
          once: true,
        })
      }
    }

    const url = `${baseUrl}${appendQuery(path, requestOptions.query)}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...defaultHeaders,
      ...(requestOptions.headers ?? {}),
    }

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }

    const shouldSendJsonBody = requestOptions.body !== undefined && method !== 'GET'
    if (shouldSendJsonBody) {
      headers['Content-Type'] = 'application/json'
    }

    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body: shouldSendJsonBody ? JSON.stringify(requestOptions.body) : undefined,
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') ?? ''
      const payload = contentType.includes('application/json') ? await response.json() : await response.text()

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status}`, response.status, payload)
      }

      return payload as T
    } catch (error) {
      const maxRetries = Math.max(0, requestOptions.retries ?? 0)
      if (attempt < maxRetries && shouldRetry(method, error)) {
        await delay(requestOptions.retryDelayMs ?? 300)
        return request<T>(method, path, requestOptions, attempt + 1)
      }

      if (controller.signal.aborted && String(controller.signal.reason ?? '').includes('timeout')) {
        emitTimeoutToast(requestOptions.timeoutMessage ?? '请求超时，请稍后重试')
      }

      throw error
    } finally {
      window.clearTimeout(timeoutId)
      if (requestKey) {
        const existingController = controllerMap.get(requestKey)
        if (existingController === controller) {
          controllerMap.delete(requestKey)
        }
      }
    }
  }

  return {
    setAuthToken(token: string) {
      authToken = token.trim()
    },
    clearAuthToken() {
      authToken = ''
    },
    cancelRequest,
    get<T>(path: string, requestOptions?: Omit<HttpRequestOptions, 'body'>) {
      return request<T>('GET', path, requestOptions)
    },
    post<T>(path: string, requestOptions?: HttpRequestOptions) {
      return request<T>('POST', path, requestOptions)
    },
    put<T>(path: string, requestOptions?: HttpRequestOptions) {
      return request<T>('PUT', path, requestOptions)
    },
    patch<T>(path: string, requestOptions?: HttpRequestOptions) {
      return request<T>('PATCH', path, requestOptions)
    },
    delete<T>(path: string, requestOptions?: HttpRequestOptions) {
      return request<T>('DELETE', path, requestOptions)
    },
  }
}

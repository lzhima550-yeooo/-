const accounts = {
  superadmin: { password: 'admin123', role: 'super_admin', displayName: '超级管理员' },
  reviewer: { password: 'review123', role: 'reviewer', displayName: '审核员' },
  ops: { password: 'ops123', role: 'operator', displayName: '运维' },
}

const defaultApiBase = '/api'

const state = {
  session: null,
  apiBase: localStorage.getItem('sw_admin_api_base') || defaultApiBase,
  auditLogs: [],
  contentItems: [],
  selectedPostId: '',
  backflowItems: [],
  selectedCandidateId: '',
  selectedCandidateReviews: [],
}

const views = {
  overview: {
    title: '运行总览',
    subtitle: '查看系统健康、任务状态与关键指标。',
  },
  content: {
    title: '社区巡检',
    subtitle: '一期最小版只做内容巡检与详情查看，不改业务状态。',
  },
  backflow: {
    title: '知识回流',
    subtitle: '候选审核、驳回、回滚与审核记录追踪。',
  },
}

const ui = {
  viewTitle: document.getElementById('view-title'),
  viewSubtitle: document.getElementById('view-subtitle'),
  navItems: Array.from(document.querySelectorAll('.nav-item')),
  panels: {
    overview: document.getElementById('view-overview'),
    content: document.getElementById('view-content'),
    backflow: document.getElementById('view-backflow'),
  },
  statusText: document.getElementById('status-text'),
  loginModal: document.getElementById('login-modal'),
  loginAccount: document.getElementById('login-account'),
  loginPassword: document.getElementById('login-password'),
  loginBtn: document.getElementById('login-btn'),
  sessionUser: document.getElementById('session-user'),
  sessionRole: document.getElementById('session-role'),
  logoutBtn: document.getElementById('logout-btn'),
  apiBaseInput: document.getElementById('api-base-input'),
  apiBaseSaveBtn: document.getElementById('api-base-save-btn'),
  auditLog: document.getElementById('audit-log'),
  overview: {
    healthValue: document.getElementById('health-value'),
    healthSub: document.getElementById('health-sub'),
    runtimeValue: document.getElementById('runtime-value'),
    runtimeSub: document.getElementById('runtime-sub'),
    candidateValue: document.getElementById('candidate-value'),
    candidateSub: document.getElementById('candidate-sub'),
    postsValue: document.getElementById('posts-value'),
    postsSub: document.getElementById('posts-sub'),
    refreshBtn: document.getElementById('refresh-overview-btn'),
  },
  content: {
    searchInput: document.getElementById('content-search-input'),
    searchBtn: document.getElementById('content-search-btn'),
    refreshBtn: document.getElementById('content-refresh-btn'),
    tableBody: document.getElementById('content-table-body'),
    detail: document.getElementById('content-detail'),
  },
  backflow: {
    statusSelect: document.getElementById('bf-status-select'),
    typeSelect: document.getElementById('bf-type-select'),
    lifecycleSelect: document.getElementById('bf-lifecycle-select'),
    refreshBtn: document.getElementById('bf-refresh-btn'),
    tableBody: document.getElementById('bf-table-body'),
    detail: document.getElementById('bf-detail'),
    reviews: document.getElementById('bf-reviews'),
    actionNote: document.getElementById('action-note-input'),
    actionEntry: document.getElementById('action-entry-input'),
    actionConflict: document.getElementById('action-conflict-select'),
    approveBtn: document.getElementById('approve-btn'),
    rejectBtn: document.getElementById('reject-btn'),
    rollbackBtn: document.getElementById('rollback-btn'),
  },
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const withShortId = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return '-'
  }
  return raw.length > 12 ? `${raw.slice(0, 8)}...${raw.slice(-4)}` : raw
}

const toLocalTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

const pushAuditLog = (action, detail) => {
  const item = {
    action,
    detail,
    actor: state.session?.account || 'anonymous',
    timestamp: new Date().toISOString(),
  }
  state.auditLogs.unshift(item)
  state.auditLogs = state.auditLogs.slice(0, 80)
  renderAuditLogs()
}

const renderAuditLogs = () => {
  ui.auditLog.innerHTML = state.auditLogs
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.action)}</strong><br>${escapeHtml(item.detail)}<br><span class="muted">${escapeHtml(
          item.actor,
        )} · ${escapeHtml(toLocalTime(item.timestamp))}</span></li>`,
    )
    .join('')
}

const setStatus = (text, type = 'normal') => {
  ui.statusText.textContent = text
  if (type === 'error') {
    ui.statusText.style.color = '#b64f4f'
    return
  }
  if (type === 'success') {
    ui.statusText.style.color = '#3c6958'
    return
  }
  ui.statusText.style.color = 'inherit'
}

const buildApiUrl = (path, query = {}) => {
  const base = state.apiBase.replace(/\/+$/, '')
  const url = new URL(`${base}${path}`, window.location.origin)
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url
}

const apiRequest = async (path, options = {}) => {
  const { method = 'GET', query, body } = options
  const url = buildApiUrl(path, query)
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = payload?.error || text || `HTTP ${response.status}`
    throw new Error(String(message))
  }
  return payload || {}
}

const updateSessionView = () => {
  if (!state.session) {
    ui.sessionUser.textContent = '未登录'
    ui.sessionRole.textContent = '-'
    return
  }
  ui.sessionUser.textContent = `${state.session.displayName}（${state.session.account}）`
  ui.sessionRole.textContent = `角色：${state.session.role}`
}

const showLogin = (visible) => {
  ui.loginModal.classList.toggle('is-visible', visible)
}

const handleLogin = () => {
  const account = String(ui.loginAccount.value || '').trim()
  const password = String(ui.loginPassword.value || '').trim()
  const candidate = accounts[account]

  if (!candidate || candidate.password !== password) {
    setStatus('登录失败：账号或密码错误', 'error')
    return
  }

  state.session = {
    account,
    role: candidate.role,
    displayName: candidate.displayName,
  }
  localStorage.setItem('sw_admin_session', JSON.stringify(state.session))
  showLogin(false)
  updateSessionView()
  setStatus(`登录成功：${candidate.displayName}`, 'success')
  pushAuditLog('登录', `账号 ${account} 已登录后台`)
  refreshOverview()
  loadContentList()
  loadBackflowCandidates()
}

const handleLogout = () => {
  pushAuditLog('退出', `账号 ${state.session?.account || '-'} 已退出后台`)
  state.session = null
  localStorage.removeItem('sw_admin_session')
  showLogin(true)
  updateSessionView()
  setStatus('请先登录后台账号')
}

const switchView = (view) => {
  ui.navItems.forEach((item) => {
    const isActive = item.dataset.view === view
    item.classList.toggle('is-active', isActive)
  })

  Object.entries(ui.panels).forEach(([key, panel]) => {
    panel.classList.toggle('is-visible', key === view)
  })

  ui.viewTitle.textContent = views[view].title
  ui.viewSubtitle.textContent = views[view].subtitle
}

const renderOverviewCards = (snapshot) => {
  ui.overview.healthValue.textContent = snapshot.health?.ok ? '正常' : '异常'
  ui.overview.healthSub.textContent = snapshot.health?.provider || '-'

  const runtimeReady = Boolean(snapshot.runtime?.ready)
  ui.overview.runtimeValue.textContent = runtimeReady ? '可用' : '降级'
  ui.overview.runtimeSub.textContent = `ComfyUI: ${snapshot.runtime?.comfyuiOnline ? 'online' : 'offline'}`

  ui.overview.candidateValue.textContent = String(snapshot.backflowTotal)
  ui.overview.candidateSub.textContent = `pending ${snapshot.backflowPending} · conflicted ${snapshot.backflowConflicted}`

  ui.overview.postsValue.textContent = String(snapshot.postsTotal)
  ui.overview.postsSub.textContent = `analytics ${snapshot.analyticsEventCount}`
}

const refreshOverview = async () => {
  try {
    setStatus('正在刷新运行总览...')
    const [health, runtime, spiritStats, backflow, posts, analytics] = await Promise.all([
      apiRequest('/health'),
      apiRequest('/spirit/runtime'),
      apiRequest('/spirit/stats').catch(() => ({ data: {} })),
      apiRequest('/community/backflow/candidates', { query: { limit: 200 } }),
      apiRequest('/community/posts', { query: { q: '' } }),
      apiRequest('/analytics/events/summary', { query: { days: 1, limit: 300 } }).catch(() => ({ data: {} })),
    ])

    const backflowItems = Array.isArray(backflow?.items) ? backflow.items : []
    const postItems = Array.isArray(posts?.items) ? posts.items : []
    const analyticsCount = Number(analytics?.data?.overview?.totalEvents || analytics?.data?.totalEvents || 0) || 0

    renderOverviewCards({
      health,
      runtime: runtime?.data || {},
      spiritStats: spiritStats?.data || {},
      backflowTotal: backflowItems.length,
      backflowPending: backflowItems.filter((item) => String(item.status) === 'pending').length,
      backflowConflicted: backflowItems.filter((item) => String(item.lifecycleState) === 'conflicted').length,
      postsTotal: postItems.length,
      analyticsEventCount: analyticsCount,
    })

    setStatus('运行总览已更新', 'success')
    pushAuditLog('总览刷新', '完成健康与核心指标同步')
  } catch (error) {
    setStatus(`总览刷新失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

const renderContentTable = () => {
  const selected = state.selectedPostId
  ui.content.tableBody.innerHTML = state.contentItems
    .map((item) => {
      const selectedClass = item.id === selected ? 'is-selected' : ''
      return `<tr class="${selectedClass}" data-post-id="${escapeHtml(item.id)}">
        <td>${escapeHtml(item.title || '-')}</td>
        <td>${escapeHtml(item.status || '-')}</td>
        <td>${escapeHtml(item.author || '-')}</td>
        <td>${escapeHtml(toLocalTime(item.createdAt))}</td>
        <td>${Array.isArray(item.answers) ? item.answers.length : 0}</td>
      </tr>`
    })
    .join('')
}

const renderContentDetail = () => {
  const item = state.contentItems.find((post) => post.id === state.selectedPostId)
  if (!item) {
    ui.content.detail.textContent = '请选择左侧帖子查看详情。'
    return
  }

  const answers = Array.isArray(item.answers)
    ? item.answers
        .slice(0, 8)
        .map(
          (answer) =>
            `<li><strong>#${Number(answer.floor) || '-'}</strong> ${escapeHtml(answer.role || 'user')}：${escapeHtml(
              answer.content || '',
            )}</li>`,
        )
        .join('')
    : ''

  ui.content.detail.innerHTML = `
    <p><strong>帖子ID：</strong>${escapeHtml(item.id)}</p>
    <p><strong>标题：</strong>${escapeHtml(item.title)}</p>
    <p><strong>作者：</strong>${escapeHtml(item.author || '-')}</p>
    <p><strong>状态：</strong>${escapeHtml(item.status || '-')}</p>
    <p><strong>内容：</strong>${escapeHtml(item.content || '')}</p>
    <p><strong>标签：</strong>${escapeHtml((item.topics || []).join(' / ') || '-')}</p>
    <p><strong>回复（前8条）：</strong></p>
    <ul>${answers || '<li>暂无回复</li>'}</ul>
  `
}

const loadContentList = async () => {
  try {
    const q = String(ui.content.searchInput.value || '').trim()
    setStatus('正在拉取社区帖子...')
    const payload = await apiRequest('/community/posts', { query: { q } })
    state.contentItems = Array.isArray(payload.items) ? payload.items : []
    if (!state.contentItems.some((item) => item.id === state.selectedPostId)) {
      state.selectedPostId = state.contentItems[0]?.id || ''
    }
    renderContentTable()
    renderContentDetail()
    setStatus(`社区帖子已更新，共 ${state.contentItems.length} 条`, 'success')
    pushAuditLog('社区巡检', `查询帖子，关键字：${q || '空'}`)
  } catch (error) {
    setStatus(`拉取社区帖子失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

const renderBackflowTable = () => {
  const selected = state.selectedCandidateId
  ui.backflow.tableBody.innerHTML = state.backflowItems
    .map((item) => {
      const selectedClass = item.id === selected ? 'is-selected' : ''
      return `<tr class="${selectedClass}" data-candidate-id="${escapeHtml(item.id)}">
        <td>${escapeHtml(withShortId(item.id))}</td>
        <td>${escapeHtml(item.candidateType || '-')}</td>
        <td>${Number(item.qualityScore) || 0}</td>
        <td>${escapeHtml(item.status || '-')}</td>
        <td>${escapeHtml(item.lifecycleState || '-')}</td>
      </tr>`
    })
    .join('')
}

const renderBackflowDetail = () => {
  const item = state.backflowItems.find((candidate) => candidate.id === state.selectedCandidateId)
  if (!item) {
    ui.backflow.detail.textContent = '请选择左侧候选查看详情。'
    return
  }

  ui.backflow.detail.innerHTML = `
    <p><strong>候选ID：</strong>${escapeHtml(item.id)}</p>
    <p><strong>类型：</strong>${escapeHtml(item.candidateType || '-')}</p>
    <p><strong>状态：</strong>${escapeHtml(item.status || '-')}</p>
    <p><strong>生命周期：</strong>${escapeHtml(item.lifecycleState || '-')}</p>
    <p><strong>质量分：</strong>${Number(item.qualityScore) || 0}</p>
    <p><strong>标题：</strong>${escapeHtml(item.title || '-')}</p>
    <p><strong>摘要：</strong>${escapeHtml(item.snippet || '-')}</p>
    <p><strong>冲突详情：</strong></p>
    <pre>${escapeHtml(JSON.stringify(item.conflictDetail || {}, null, 2))}</pre>
  `
}

const renderBackflowReviews = () => {
  ui.backflow.reviews.innerHTML = state.selectedCandidateReviews
    .map(
      (review) => `<li>
        <strong>${escapeHtml(review.action || '-')}</strong>
        <div>${escapeHtml(review.reviewer || '-')} · ${escapeHtml(toLocalTime(review.createdAt))}</div>
        <div>${escapeHtml(review.reviewNote || '')}</div>
      </li>`,
    )
    .join('')
}

const loadBackflowReviews = async (candidateId) => {
  if (!candidateId) {
    state.selectedCandidateReviews = []
    renderBackflowReviews()
    return
  }

  try {
    const payload = await apiRequest(`/community/backflow/candidates/${encodeURIComponent(candidateId)}/reviews`, {
      query: { limit: 20 },
    })
    state.selectedCandidateReviews = Array.isArray(payload.items) ? payload.items : []
    renderBackflowReviews()
  } catch (error) {
    setStatus(`读取审核记录失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

const loadBackflowCandidates = async () => {
  try {
    setStatus('正在拉取回流候选...')
    const payload = await apiRequest('/community/backflow/candidates', {
      query: {
        limit: 200,
        status: ui.backflow.statusSelect.value,
        candidateType: ui.backflow.typeSelect.value,
        lifecycleState: ui.backflow.lifecycleSelect.value,
      },
    })
    state.backflowItems = Array.isArray(payload.items) ? payload.items : []
    if (!state.backflowItems.some((item) => item.id === state.selectedCandidateId)) {
      state.selectedCandidateId = state.backflowItems[0]?.id || ''
    }
    renderBackflowTable()
    renderBackflowDetail()
    await loadBackflowReviews(state.selectedCandidateId)
    setStatus(`回流候选已更新，共 ${state.backflowItems.length} 条`, 'success')
    pushAuditLog('回流候选刷新', '已同步候选列表与审核记录')
  } catch (error) {
    setStatus(`拉取候选失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

const ensureCandidateSelected = () => {
  if (!state.selectedCandidateId) {
    setStatus('请先选择候选记录再执行操作', 'error')
    return false
  }
  return true
}

const runCandidateAction = async (action) => {
  if (!ensureCandidateSelected()) {
    return
  }

  const note = String(ui.backflow.actionNote.value || '').trim()
  const entryId = String(ui.backflow.actionEntry.value || '').trim()
  const conflictStrategy = String(ui.backflow.actionConflict.value || '').trim()
  const candidateId = state.selectedCandidateId
  const account = state.session?.account || 'operator'

  try {
    setStatus(`正在执行 ${action}...`)

    if (action === 'approve') {
      await apiRequest(`/community/backflow/candidates/${encodeURIComponent(candidateId)}/approve`, {
        method: 'POST',
        body: {
          approvedBy: account,
          reviewNote: note,
          entryId,
          conflictStrategy,
          force: true,
        },
      })
    } else if (action === 'reject') {
      await apiRequest(`/community/backflow/candidates/${encodeURIComponent(candidateId)}/reject`, {
        method: 'POST',
        body: {
          rejectedBy: account,
          reviewNote: note,
        },
      })
    } else if (action === 'rollback') {
      await apiRequest(`/community/backflow/candidates/${encodeURIComponent(candidateId)}/rollback`, {
        method: 'POST',
        body: {
          rolledBackBy: account,
          reviewNote: note,
          force: true,
        },
      })
    }

    pushAuditLog('回流操作', `${action} -> ${candidateId}`)
    setStatus(`操作成功：${action}`, 'success')
    await loadBackflowCandidates()
  } catch (error) {
    setStatus(`操作失败：${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

const bindEvents = () => {
  ui.navItems.forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view || 'overview'))
  })

  ui.loginBtn.addEventListener('click', handleLogin)
  ui.logoutBtn.addEventListener('click', handleLogout)

  ui.apiBaseSaveBtn.addEventListener('click', () => {
    const value = String(ui.apiBaseInput.value || '').trim()
    if (!value) {
      setStatus('API Base 不能为空', 'error')
      return
    }
    state.apiBase = value
    localStorage.setItem('sw_admin_api_base', value)
    setStatus(`API Base 已更新为 ${value}`, 'success')
    pushAuditLog('配置变更', `API Base -> ${value}`)
    refreshOverview()
    loadContentList()
    loadBackflowCandidates()
  })

  ui.overview.refreshBtn.addEventListener('click', refreshOverview)

  ui.content.searchBtn.addEventListener('click', loadContentList)
  ui.content.refreshBtn.addEventListener('click', loadContentList)
  ui.content.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      loadContentList()
    }
  })
  ui.content.tableBody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-post-id]')
    if (!row) {
      return
    }
    state.selectedPostId = row.dataset.postId || ''
    renderContentTable()
    renderContentDetail()
  })

  ui.backflow.refreshBtn.addEventListener('click', loadBackflowCandidates)
  ui.backflow.statusSelect.addEventListener('change', loadBackflowCandidates)
  ui.backflow.typeSelect.addEventListener('change', loadBackflowCandidates)
  ui.backflow.lifecycleSelect.addEventListener('change', loadBackflowCandidates)
  ui.backflow.tableBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-candidate-id]')
    if (!row) {
      return
    }
    state.selectedCandidateId = row.dataset.candidateId || ''
    renderBackflowTable()
    renderBackflowDetail()
    await loadBackflowReviews(state.selectedCandidateId)
  })

  ui.backflow.approveBtn.addEventListener('click', () => runCandidateAction('approve'))
  ui.backflow.rejectBtn.addEventListener('click', () => runCandidateAction('reject'))
  ui.backflow.rollbackBtn.addEventListener('click', () => runCandidateAction('rollback'))
}

const restoreSession = () => {
  const raw = localStorage.getItem('sw_admin_session')
  if (!raw) {
    return
  }
  try {
    const session = JSON.parse(raw)
    if (session?.account && session?.role) {
      state.session = session
    }
  } catch {
    localStorage.removeItem('sw_admin_session')
  }
}

const boot = async () => {
  bindEvents()
  restoreSession()
  ui.apiBaseInput.value = state.apiBase
  updateSessionView()
  switchView('overview')
  renderAuditLogs()

  if (!state.session) {
    setStatus('请先登录后台账号')
    showLogin(true)
    return
  }

  showLogin(false)
  await refreshOverview()
  await loadContentList()
  await loadBackflowCandidates()

  setInterval(() => {
    refreshOverview()
  }, 30_000)
}

boot()

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { createCommunityPostOnServer } from '../services/communityApi'
import { analytics } from '../services/analytics'
import {
  fetchSpiritCommunityDraftsFromServer,
  publishSpiritCommunityDraftOnServer,
  updateSpiritCommunityDraftOnServer,
  type SpiritCommunityDraft,
} from '../services/spiritSessionApi'
import { useAppStore } from '../store/useAppStore'
import { useUiStore } from '../store/useUiStore'
import { compressImageFile } from '../utils/compressImage'
import { validators } from '../utils/formValidation'
import { renderRichText } from '../utils/richText'

const parseMentions = (text: string) =>
  Array.from(new Set((text.match(/@[\w\u4e00-\u9fa5_-]+/g) ?? []).map((item) => item.slice(1))))
const parseTopics = (text: string) =>
  Array.from(new Set((text.match(/#[\w\u4e00-\u9fa5_-]+/g) ?? []).map((item) => item.slice(1))))

const formatDraftTime = (value: string) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return '未知时间'
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.valueOf())) {
    return normalized
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  })
}

const extractEvidenceLine = (text: string, label: string) => {
  const pattern = new RegExp(`${label}：([^\\n]+)`)
  const matched = text.match(pattern)
  return matched?.[1]?.trim() || ''
}

export function CommunityPublishPage() {
  const addCommunityPost = useAppStore((state) => state.addCommunityPost)
  const navigate = useNavigate()
  const location = useLocation()
  const captureInputRef = useRef<HTMLInputElement>(null)
  const prefillOnceRef = useRef(false)
  const pushToast = useUiStore((state) => state.pushToast)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [seedMentions, setSeedMentions] = useState<string[]>([])
  const [seedTopics, setSeedTopics] = useState<string[]>([])
  const [draftHistory, setDraftHistory] = useState<SpiritCommunityDraft[]>([])
  const [draftHistoryLoading, setDraftHistoryLoading] = useState(true)
  const [draftHistoryError, setDraftHistoryError] = useState('')
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [publishingDraftId, setPublishingDraftId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const markdownPreview = useMemo(() => content.trim(), [content])
  const mentions = useMemo(() => parseMentions(content), [content])
  const topics = useMemo(() => parseTopics(content), [content])
  const mergedMentions = useMemo(() => Array.from(new Set([...seedMentions, ...mentions])), [mentions, seedMentions])
  const mergedTopics = useMemo(() => Array.from(new Set([...seedTopics, ...topics])), [seedTopics, topics])

  const selectedDraft = useMemo(
    () => draftHistory.find((draft) => draft.id === selectedDraftId) ?? null,
    [draftHistory, selectedDraftId],
  )
  const selectedDraftEvidence = useMemo(() => {
    if (!selectedDraft) {
      return null
    }

    const sourceText = selectedDraft.content || selectedDraft.markdown || ''
    return {
      identifyTaskId: extractEvidenceLine(sourceText, '识别任务ID'),
      identifySource: extractEvidenceLine(sourceText, '识别来源'),
      generationTaskId: extractEvidenceLine(sourceText, '生图任务ID'),
      generationParams: extractEvidenceLine(sourceText, '生图参数'),
    }
  }, [selectedDraft])

  const applyDraftToForm = (draft: SpiritCommunityDraft, withToast = true) => {
    setTitle(draft.title)
    setContent(draft.markdown || draft.content)
    setImage(draft.image || '')
    setSeedMentions(Array.isArray(draft.mentions) ? draft.mentions : [])
    setSeedTopics(Array.isArray(draft.topics) ? draft.topics : [])
    setSelectedDraftId(draft.id)

    if (withToast) {
      pushToast({ level: 'info', message: '草稿内容已回填到编辑区。' })
    }
  }

  const refreshDraftHistory = async () => {
    setDraftHistoryLoading(true)
    setDraftHistoryError('')

    const result = await fetchSpiritCommunityDraftsFromServer({ limit: 30 })
    if (result.ok) {
      setDraftHistory(result.data)
    } else {
      setDraftHistory([])
      setDraftHistoryError(result.message ?? '草稿历史加载失败，已切换本地编辑模式。')
    }

    setDraftHistoryLoading(false)
  }

  useEffect(() => {
    void refreshDraftHistory()
  }, [])

  useEffect(() => {
    if (prefillOnceRef.current) {
      return
    }

    const state = location.state as
      | {
          spiritDraftId?: string
          spiritDraft?: Partial<SpiritCommunityDraft>
        }
      | undefined

    const draft = state?.spiritDraft
    if (!draft) {
      return
    }

    const normalizedDraft: SpiritCommunityDraft = {
      id: String(draft.id ?? state?.spiritDraftId ?? '').trim(),
      sessionId: String(draft.sessionId ?? '').trim(),
      title: String(draft.title ?? '').trim(),
      content: String(draft.content ?? '').trim(),
      markdown: String(draft.markdown ?? draft.content ?? '').trim(),
      image: String(draft.image ?? '').trim(),
      mentions: Array.isArray(draft.mentions) ? draft.mentions.map((item) => String(item ?? '').trim()).filter(Boolean) : [],
      topics: Array.isArray(draft.topics) ? draft.topics.map((item) => String(item ?? '').trim()).filter(Boolean) : [],
      status: draft.status === 'published' ? 'published' : 'draft',
      publishedPostId: String(draft.publishedPostId ?? '').trim(),
      publishedAt: String(draft.publishedAt ?? '').trim(),
      createdAt: String(draft.createdAt ?? '').trim(),
      updatedAt: String(draft.updatedAt ?? '').trim(),
    }

    applyDraftToForm(normalizedDraft, false)
    if (normalizedDraft.id) {
      setDraftHistory((prev) => {
        if (prev.some((item) => item.id === normalizedDraft.id)) {
          return prev
        }

        return [normalizedDraft, ...prev]
      })
    }
    prefillOnceRef.current = true

    if (normalizedDraft.title || normalizedDraft.markdown || normalizedDraft.content) {
      pushToast({ level: 'info', message: '已载入灵化社区草稿，可直接补充后发布。' })
    }
  }, [location.state, pushToast])

  const onImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading(true)
    try {
      const compressed = await compressImageFile(file)
      setImage(URL.createObjectURL(compressed))
      pushToast({ level: 'info', message: `图片已压缩：${file.name}` })
    } catch {
      setImage(URL.createObjectURL(file))
    } finally {
      setUploading(false)
    }
  }

  const onOneClickPublishDraft = async (draft: SpiritCommunityDraft) => {
    if (!draft.id || publishingDraftId) {
      return
    }

    setPublishingDraftId(draft.id)

    try {
      const result = await publishSpiritCommunityDraftOnServer(draft.id)
      if (!result.ok || !result.data.postId) {
        pushToast({ level: 'warning', message: result.message ?? '草稿发布失败，请稍后再试。' })
        return
      }

      addCommunityPost({
        title: draft.title,
        content: draft.content,
        image: draft.image || undefined,
        markdown: draft.markdown || draft.content,
        mentions: draft.mentions,
        topics: draft.topics,
      })

      analytics.track('community_draft_publish_direct', '/community/new', {
        reused: result.data.reused,
      })

      pushToast({ level: 'success', message: result.data.reused ? '草稿已在此前发布。' : '草稿已一键正式发布。' })
      await refreshDraftHistory()
      navigate('/community')
    } finally {
      setPublishingDraftId('')
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const normalizedTitle = title.trim()
    const normalizedContent = content.trim()

    const validation = validators.communityPost(normalizedTitle, normalizedContent, image)
    if (!validation.valid) {
      pushToast({ level: 'warning', message: validation.message ?? '请输入内容后再发布。' })
      return
    }

    const payload = {
      title: normalizedTitle || '现场图片求助',
      content: normalizedContent || '已上传现场图片，请帮忙诊断病虫害类型与处理建议。',
      image: image || undefined,
      markdown: normalizedContent,
      mentions: mergedMentions,
      topics: mergedTopics,
    }

    setIsSubmitting(true)

    try {
      if (selectedDraftId) {
        const updateResult = await updateSpiritCommunityDraftOnServer(selectedDraftId, {
          title: payload.title,
          content: payload.content,
          markdown: payload.markdown,
          image: payload.image,
          mentions: payload.mentions,
          topics: payload.topics,
        })

        if (!updateResult.ok) {
          pushToast({ level: 'warning', message: updateResult.message ?? '草稿更新失败，正在尝试直接发布。' })
        }

        const publishResult = await publishSpiritCommunityDraftOnServer(selectedDraftId)
        if (publishResult.ok && publishResult.data.postId) {
          addCommunityPost(payload)
          analytics.track('community_draft_publish_submit', '/community/new', {
            reused: publishResult.data.reused,
          })
          pushToast({ level: 'success', message: publishResult.data.reused ? '草稿已在此前发布。' : '草稿已更新并发布。' })
          await refreshDraftHistory()
          navigate('/community')
          return
        }

        pushToast({ level: 'warning', message: publishResult.message ?? '草稿发布失败，已切换普通发布。' })
      }

      addCommunityPost(payload)
      await createCommunityPostOnServer(payload)

      analytics.track('community_publish_submit', '/community/new', {
        hasImage: Boolean(image),
        mentions: mergedMentions.length,
        topics: mergedTopics.length,
      })

      pushToast({ level: 'success', message: '帖子已发布' })
      navigate('/community')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="发布求助" subtitle="支持 Markdown、@提及、#标签" />

      <main className="space-y-3 px-4 pb-6 pt-4 lg:px-6 lg:py-5">
        <section data-testid="community-draft-history" className="mx-auto max-w-[880px] rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">灵化草稿历史</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">支持回填编辑后发布，或直接一键正式发布。</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshDraftHistory()}
              className="h-8 rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-3 text-xs font-semibold text-[var(--text-main)]"
            >
              刷新草稿
            </button>
          </div>

          {draftHistoryLoading ? <p className="mt-3 text-xs text-[var(--text-soft)]">草稿历史加载中...</p> : null}
          {draftHistoryError ? <p className="mt-3 text-xs text-amber-700">{draftHistoryError}</p> : null}

          {!draftHistoryLoading && draftHistory.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--text-soft)]">暂无草稿，先在灵化页生成草稿即可。</p>
          ) : null}

          {draftHistory.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {draftHistory.map((draft) => {
                const isCurrent = selectedDraftId === draft.id
                return (
                  <li key={draft.id} className="rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">{draft.title || '未命名草稿'}</p>
                        <p className="mt-1 text-[11px] text-[var(--text-soft)]">
                          {formatDraftTime(draft.updatedAt || draft.createdAt)} · {draft.status === 'published' ? '已发布' : '草稿'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => applyDraftToForm(draft)}
                          className={`h-8 rounded-lg px-3 text-xs font-semibold ${
                            isCurrent ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'border border-[var(--line)] bg-white text-[var(--text-main)]'
                          }`}
                        >
                          回填编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void onOneClickPublishDraft(draft)}
                          disabled={Boolean(publishingDraftId)}
                          className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white disabled:opacity-70"
                        >
                          {publishingDraftId === draft.id ? '发布中...' : '一键正式发布'}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>

        <form className="mx-auto max-w-[880px] space-y-3" onSubmit={(event) => void onSubmit(event)}>
          {selectedDraftEvidence ? (
            <section className="rounded-2xl border border-[var(--line)] bg-white p-4 text-xs text-[var(--text-soft)] shadow-sm lg:p-5">
              <p className="text-sm font-semibold text-[var(--text-main)]">证据快照</p>
              <p className="mt-2">识别任务ID：{selectedDraftEvidence.identifyTaskId || '未记录'}</p>
              <p className="mt-1">识别来源：{selectedDraftEvidence.identifySource || '暂无'}</p>
              <p className="mt-1">生图任务ID：{selectedDraftEvidence.generationTaskId || '未记录'}</p>
              <p className="mt-1">生图参数：{selectedDraftEvidence.generationParams || '未记录'}</p>
            </section>
          ) : null}

          <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="help-title" className="text-sm font-medium text-[var(--text-main)]">
                问题标题
              </label>
              {selectedDraft ? (
                <button
                  type="button"
                  onClick={() => setSelectedDraftId('')}
                  className="h-7 rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-2 text-[11px] text-[var(--text-soft)]"
                >
                  取消草稿关联
                </button>
              ) : null}
            </div>
            <input
              id="help-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：叶片出现白粉斑怎么办？（可选）"
              className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--card-soft)] px-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />

            <label htmlFor="help-content" className="mb-2 mt-3 block text-sm font-medium text-[var(--text-main)]">
              详细描述
            </label>
            <p className="mb-2 text-xs text-[var(--text-soft)]">支持 `代码`、**加粗**、@对象、#标签</p>
            <textarea
              id="help-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder="补充时间、位置、症状变化、已尝试措施；例如 @植保老师 #蚜虫"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              {mergedMentions.map((mention) => (
                <span key={mention} className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
                  @{mention}
                </span>
              ))}
              {mergedTopics.map((topic) => (
                <span key={topic} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                  #{topic}
                </span>
              ))}
            </div>

            {markdownPreview ? (
              <section className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3">
                <p className="text-xs font-semibold text-[var(--text-soft)]">预览</p>
                <div className="mt-2 space-y-1 text-sm text-[var(--text-main)]">{renderRichText(markdownPreview)}</div>
              </section>
            ) : null}

            <label htmlFor="help-image" className="mb-2 mt-3 block text-sm font-medium text-[var(--text-main)]">
              上传图片
            </label>
            <input
              id="help-image"
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="block w-full text-xs text-[var(--text-soft)]"
            />

            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onImageChange}
              className="hidden"
            />
            <button
              type="button"
              className="mt-2 h-9 rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-3 text-xs font-semibold text-[var(--text-main)]"
              onClick={() => captureInputRef.current?.click()}
            >
              手机拍照上传
            </button>

            {uploading ? <p className="mt-2 text-xs text-[var(--text-soft)]">图片处理中...</p> : null}
            {image ? <img src={image} alt="求助图片预览" className="mt-3 h-44 w-full rounded-xl object-cover lg:h-64" /> : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full cursor-pointer rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--text-main)] shadow-[0_8px_18px_rgba(204,203,147,0.35)] disabled:opacity-70"
          >
            {isSubmitting ? '发布中...' : selectedDraftId ? '更新草稿并正式发布' : '发布到社区'}
          </button>
        </form>
      </main>
    </div>
  )
}

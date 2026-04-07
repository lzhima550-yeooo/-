import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { CommunityPostHeroCard } from '../components/community-thread/CommunityPostHeroCard'
import { CommunityReplyComposer } from '../components/community-thread/CommunityReplyComposer'
import { CommunityReplyList } from '../components/community-thread/CommunityReplyList'
import { CommunityThreadToolbar, type ReplyFilter, type ReplySort } from '../components/community-thread/CommunityThreadToolbar'
import { createCommunityReplyOnServer } from '../services/communityApi'
import { analytics } from '../services/analytics'
import { useAppStore } from '../store/useAppStore'
import type { AnnotationPoint, CommunityFloorRole } from '../types/models'
import { compressImageFile } from '../utils/compressImage'

export function CommunityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const posts = useAppStore((state) => state.posts)
  const addAnswer = useAppStore((state) => state.addAnswer)
  const updatePostStatus = useAppStore((state) => state.updatePostStatus)
  const account = useAppStore((state) => state.account)
  const profileName = useAppStore((state) => state.profileName)
  const favoritePostIds = useAppStore((state) => state.favoritePostIds)
  const toggleFavoritePost = useAppStore((state) => state.toggleFavoritePost)

  const [text, setText] = useState('')
  const [replyImage, setReplyImage] = useState('')
  const [replyAnnotations, setReplyAnnotations] = useState<AnnotationPoint[]>([])
  const [replyToFloor, setReplyToFloor] = useState<number | undefined>(undefined)
  const [mode, setMode] = useState<CommunityFloorRole>('answer')
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>('all')
  const [replySort, setReplySort] = useState<ReplySort>('asc')

  const post = useMemo(() => posts.find((entry) => entry.id === id), [id, posts])

  const isPoster = useMemo(() => {
    if (!post) {
      return false
    }
    if (post.ownerAccount) {
      return post.ownerAccount === account
    }
    return post.author === profileName || post.author === account
  }, [account, post, profileName])

  const isFavorite = useMemo(() => (post ? favoritePostIds.includes(post.id) : false), [favoritePostIds, post])

  const visibleAnswers = useMemo(() => {
    if (!post) {
      return []
    }

    const source = [...post.answers]
    const filtered =
      replyFilter === 'poster_only'
        ? source.filter((answer) => answer.role === 'followup' || answer.author === post.author)
        : source

    const sorted = filtered.sort((a, b) => {
      const fa = a.floor ?? 0
      const fb = b.floor ?? 0
      return replySort === 'asc' ? fa - fb : fb - fa
    })
    return sorted
  }, [post, replyFilter, replySort])

  useEffect(() => {
    if (!isPoster && mode === 'followup') {
      setMode('answer')
    }
  }, [isPoster, mode])

  if (!post) {
    return <Navigate to="/community" replace />
  }

  const onImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const compressed = await compressImageFile(file)
    setReplyImage(URL.createObjectURL(compressed))
    setReplyAnnotations([])
    setComposerExpanded(true)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()

    const normalizedText = text.trim()
    if (!normalizedText && !replyImage) {
      return
    }

    const payload = {
      content: normalizedText || '补充图片说明',
      markdown: normalizedText || '补充图片说明',
      image: replyImage || undefined,
      role: mode,
      replyToFloor,
      annotations: replyAnnotations,
    }

    addAnswer(post.id, payload)
    void createCommunityReplyOnServer(post.id, payload)
    analytics.track('community_reply_submit', `/community/${post.id}`, {
      hasImage: Boolean(replyImage),
      annotations: replyAnnotations.length,
      mode,
    })

    setText('')
    setReplyImage('')
    setReplyAnnotations([])
    setReplyToFloor(undefined)
    setComposerExpanded(false)
  }

  const onReplyFloor = (floor: number, author: string) => {
    setReplyToFloor(floor)
    setText((prev) => (prev.trim() ? prev : `@${author} `))
    setComposerExpanded(true)
  }

  const onMarkSolved = () => {
    if (post.status !== 'solved') {
      updatePostStatus(post.id, 'solved')
    }
  }

  return (
    <div className="bg-[linear-gradient(180deg,#fbfefb_0%,#f4faf6_100%)]">
      <PageHeader
        title="帖子详情"
        subtitle={post.status === 'open' ? '待确认 · 楼层协作讨论中' : '已解决 · 建议沉淀到图鉴'}
        action={
          <div className="flex items-center gap-2">
            <Link to="/community" className="inline-flex items-center gap-1 rounded-full bg-[var(--card-soft)] px-2.5 py-1 text-xs text-[var(--accent-deep)] lg:text-sm">
              <MaterialSymbol name="arrow_back" className="text-[14px]" />
              返回
            </Link>
            <button type="button" aria-label="更多操作" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--card-soft)] text-[var(--text-soft)]">
              <MaterialSymbol name="more_horiz" className="text-[18px]" />
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-[920px] space-y-3 px-3 py-3 pb-[210px] lg:px-6 lg:py-5 lg:pb-6">
        <CommunityPostHeroCard
          post={post}
          isPoster={isPoster}
          onMarkSolved={onMarkSolved}
          onToggleFavorite={() => toggleFavoritePost(post.id)}
          isFavorite={isFavorite}
        />
        <CommunityThreadToolbar
          floorCount={post.answers.length + 1}
          replyFilter={replyFilter}
          onReplyFilterChange={setReplyFilter}
          replySort={replySort}
          onReplySortChange={setReplySort}
        />
        <CommunityReplyList answers={visibleAnswers} onReplyFloor={onReplyFloor} />
      </main>

      <div className="fixed inset-x-3 bottom-[72px] z-40 mx-auto max-w-[920px] lg:static lg:inset-auto lg:px-6 lg:pb-5">
        <CommunityReplyComposer
          text={text}
          mode={mode}
          isPoster={isPoster}
          expanded={composerExpanded}
          replyToFloor={replyToFloor}
          replyImage={replyImage}
          replyAnnotations={replyAnnotations}
          onTextChange={setText}
          onModeChange={setMode}
          onExpand={setComposerExpanded}
          onCancelReplyToFloor={() => setReplyToFloor(undefined)}
          onImageChange={onImageChange}
          onReplyAnnotationsChange={setReplyAnnotations}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}

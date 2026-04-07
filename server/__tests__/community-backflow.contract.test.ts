import { afterEach, describe, expect, test } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app'

type CandidateActionPayload = {
  entryId?: string
  approvedBy?: string
  reviewNote?: string
  force?: boolean
  conflictStrategy?: string
}

type RejectActionPayload = {
  rejectedBy?: string
  reviewNote?: string
}

type RollbackActionPayload = {
  rolledBackBy?: string
  reviewNote?: string
  rollbackToReviewId?: string
  force?: boolean
}

type ServiceReview = {
  id: string
  candidateId: string
  action: string
  reviewer: string
  reviewNote: string
}

type ServiceCandidate = {
  id: string
  candidateType: string
  status: string
  qualityScore?: number
  entryId?: string
  lifecycleState?: string
}

type ApiServiceMock = {
  checkHealth: () => Promise<{ ok: boolean; provider: string }>
  listEncyclopedia: (query?: string) => Promise<unknown[]>
  listCommunityPosts: (query?: string) => Promise<unknown[]>
  createCommunityPost: (payload: { title: string; content: string }) => Promise<{ id: string }>
  createCommunityReply: (postId: string, payload: { content: string }) => Promise<{ id: string }>
  generateKnowledgeBackflowCandidates?: (input: { q?: string; minQualityScore?: number; limit?: number }) => Promise<unknown>
  listKnowledgeBackflowCandidates?: (input: {
    status?: string
    candidateType?: string
    limit?: number
    lifecycleState?: string
  }) => Promise<unknown[]>
  approveKnowledgeBackflowCandidate?: (candidateId: string, input: CandidateActionPayload) => Promise<unknown>
  rejectKnowledgeBackflowCandidate?: (candidateId: string, input: RejectActionPayload) => Promise<unknown>
  rollbackKnowledgeBackflowCandidate?: (candidateId: string, input: RollbackActionPayload) => Promise<unknown>
  listKnowledgeBackflowReviews?: (input: { candidateId: string; limit?: number }) => Promise<unknown[]>
}

type ApproveResponse = {
  candidate: {
    id: string
    candidateType: string
    status: string
    entryId: string
  }
  applied: {
    entryId: string
    candidateType: string
    sourceIndexItemId?: string
    treatmentTemplateId?: string
  }
  reused: boolean
}

type RejectResponse = {
  candidate: {
    id: string
    status: string
  }
}

type RollbackResponse = {
  candidate: {
    id: string
    status: string
    lifecycleState?: string
  }
  rollback: {
    reverted: boolean
    sourceIndexItemDeleted?: boolean
    treatmentTemplateRestored?: boolean
    targetReviewId?: string
  }
}

type ExtractResponse = {
  data: { generatedCount: number; insertedCount: number; items: Array<{ id: string }> }
}

type CandidateListResponse = { items: Array<{ id: string; candidateType: string; lifecycleState?: string }> }

type ApproveApiResponse = {
  data: ApproveResponse
}

type RejectApiResponse = {
  data: RejectResponse
}

type RollbackApiResponse = {
  data: RollbackResponse
}

type ReviewListResponse = {
  items: Array<ServiceReview>
}

const makeApprovedPayload = (candidateId: string, input: CandidateActionPayload): ApproveResponse => ({
  candidate: {
    id: candidateId,
    candidateType: 'source_index',
    status: 'approved',
    entryId: String(input.entryId ?? '').trim(),
  },
  applied: {
    entryId: String(input.entryId ?? '').trim(),
    candidateType: 'source_index',
    sourceIndexItemId: 'src-001',
  },
  reused: false,
})

const makeRejectedPayload = (candidateId: string): RejectResponse => ({
  candidate: {
    id: candidateId,
    status: 'rejected',
  },
})

const makeRollbackPayload = (candidateId: string): RollbackResponse => ({
  candidate: {
    id: candidateId,
    status: 'rejected',
    lifecycleState: 'rolled_back',
  },
  rollback: {
    reverted: true,
    sourceIndexItemDeleted: true,
    targetReviewId: 'review-approve-1',
  },
})

const makeReviewRecord = (partial: Partial<ServiceReview> = {}): ServiceReview => ({
  id: partial.id ?? 'review-1',
  candidateId: partial.candidateId ?? 'cand-1',
  action: partial.action ?? 'approve',
  reviewer: partial.reviewer ?? 'reviewer-A',
  reviewNote: partial.reviewNote ?? 'looks good',
})

const makeCandidateRecord = (partial: Partial<ServiceCandidate> = {}): ServiceCandidate => ({
  id: partial.id ?? 'cand-1',
  candidateType: partial.candidateType ?? 'source_index',
  status: partial.status ?? 'pending',
  qualityScore: partial.qualityScore ?? 88,
  entryId: partial.entryId ?? '',
  lifecycleState: partial.lifecycleState ?? '',
})

const createServiceMock = (): ApiServiceMock => ({
  checkHealth: async () => ({ ok: true, provider: 'supabase' }),
  listEncyclopedia: async () => [],
  listCommunityPosts: async () => [],
  createCommunityPost: async () => ({ id: 'post-1' }),
  createCommunityReply: async () => ({ id: 'reply-1' }),
  approveKnowledgeBackflowCandidate: async (candidateId, input) => makeApprovedPayload(candidateId, input),
  rejectKnowledgeBackflowCandidate: async (candidateId) => makeRejectedPayload(candidateId),
  rollbackKnowledgeBackflowCandidate: async (candidateId) => makeRollbackPayload(candidateId),
  listKnowledgeBackflowReviews: async () => [makeReviewRecord()],
})

const startedServers: Array<ReturnType<typeof createServer>> = []

const start = async (service: ApiServiceMock) => {
  const app = createApp(service as never, {
    siliconflowService: {
      identifyImage: async () => ({}),
      chat: async () => ({}),
      chatStream: async () => ({ reply: '', provider: 'mock', model: 'mock' }),
    },
  })

  const server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  startedServers.push(server)
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(
    startedServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
        }),
    ),
  )
})

describe('community knowledge backflow api contract', () => {
  test('POST /api/community/backflow/extract passes extraction params and returns summary', async () => {
    let captured: { q?: string; minQualityScore?: number; limit?: number } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      generateKnowledgeBackflowCandidates: async (input) => {
        captured = input
        return {
          generatedCount: 2,
          insertedCount: 1,
          items: [
            {
              id: 'cand-1',
              candidateType: 'source_index',
              status: 'pending',
            },
          ],
        }
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/backflow/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: 'powdery mildew',
        minQualityScore: 70,
        limit: 5,
      }),
    })
    const body = (await res.json()) as ExtractResponse

    expect(res.status).toBe(200)
    expect(captured?.q).toBe('powdery mildew')
    expect(captured?.minQualityScore).toBe(70)
    expect(captured?.limit).toBe(5)
    expect(body.data.generatedCount).toBe(2)
    expect(body.data.insertedCount).toBe(1)
    expect(body.data.items[0]?.id).toBe('cand-1')
  })

  test('GET /api/community/backflow/candidates supports status and type filters', async () => {
    let captured: { status?: string; candidateType?: string; limit?: number; lifecycleState?: string } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      listKnowledgeBackflowCandidates: async (input) => {
        captured = input
        return [
          {
            id: 'cand-2',
            candidateType: 'treatment_template',
            status: 'pending',
            qualityScore: 88,
          },
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(
      `${baseUrl}/api/community/backflow/candidates?status=pending&candidateType=treatment_template&limit=8`,
    )
    const body = (await res.json()) as CandidateListResponse

    expect(res.status).toBe(200)
    expect(captured?.status).toBe('pending')
    expect(captured?.candidateType).toBe('treatment_template')
    expect(captured?.limit).toBe(8)
    expect(body.items[0]?.id).toBe('cand-2')
    expect(body.items[0]?.candidateType).toBe('treatment_template')
  })

  test('POST /api/community/backflow/candidates/:id/approve forwards approval payload', async () => {
    let capturedId = ''
    let capturedPayload: CandidateActionPayload | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      approveKnowledgeBackflowCandidate: async (candidateId, input) => {
        capturedId = candidateId
        capturedPayload = input
        return makeApprovedPayload(candidateId, input)
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/backflow/candidates/cand-3/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entryId: 'enc-powdery',
        approvedBy: 'reviewer-A',
        reviewNote: 'looks good',
        force: true,
        conflictStrategy: 'overwrite',
      }),
    })
    const body = (await res.json()) as ApproveApiResponse

    expect(res.status).toBe(200)
    expect(capturedId).toBe('cand-3')
    expect(capturedPayload?.entryId).toBe('enc-powdery')
    expect(capturedPayload?.approvedBy).toBe('reviewer-A')
    expect(capturedPayload?.reviewNote).toBe('looks good')
    expect(capturedPayload?.force).toBe(true)
    expect(capturedPayload?.conflictStrategy).toBe('overwrite')
    expect(body.data.candidate.status).toBe('approved')
    expect(body.data.applied.sourceIndexItemId).toBe('src-001')
    expect(body.data.reused).toBe(false)
  })

  test('POST /api/community/backflow/candidates/:id/reject forwards reject payload', async () => {
    let capturedId = ''
    let capturedPayload: RejectActionPayload | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      rejectKnowledgeBackflowCandidate: async (candidateId, input) => {
        capturedId = candidateId
        capturedPayload = input
        return makeRejectedPayload(candidateId)
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/backflow/candidates/cand-4/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rejectedBy: 'reviewer-B',
        reviewNote: 'evidence is insufficient',
      }),
    })
    const body = (await res.json()) as RejectApiResponse

    expect(res.status).toBe(200)
    expect(capturedId).toBe('cand-4')
    expect(capturedPayload?.rejectedBy).toBe('reviewer-B')
    expect(capturedPayload?.reviewNote).toBe('evidence is insufficient')
    expect(body.data.candidate.status).toBe('rejected')
  })

  test('POST /api/community/backflow/candidates/:id/rollback forwards rollback payload', async () => {
    let capturedId = ''
    let capturedPayload: RollbackActionPayload | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      rollbackKnowledgeBackflowCandidate: async (candidateId, input) => {
        capturedId = candidateId
        capturedPayload = input
        return makeRollbackPayload(candidateId)
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/backflow/candidates/cand-5/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rolledBackBy: 'operator-1',
        reviewNote: 'wrong entry selected',
        rollbackToReviewId: 'review-approve-1',
        force: true,
      }),
    })
    const body = (await res.json()) as RollbackApiResponse

    expect(res.status).toBe(200)
    expect(capturedId).toBe('cand-5')
    expect(capturedPayload?.rolledBackBy).toBe('operator-1')
    expect(capturedPayload?.reviewNote).toBe('wrong entry selected')
    expect(capturedPayload?.rollbackToReviewId).toBe('review-approve-1')
    expect(capturedPayload?.force).toBe(true)
    expect(body.data.rollback.reverted).toBe(true)
    expect(body.data.candidate.lifecycleState).toBe('rolled_back')
  })

  test('GET /api/community/backflow/candidates/:id/reviews returns audit records', async () => {
    let captured: { candidateId: string; limit?: number } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      listKnowledgeBackflowReviews: async (input) => {
        captured = input
        return [
          makeReviewRecord({
            id: 'review-11',
            candidateId: input.candidateId,
            action: 'approve',
            reviewer: 'reviewer-A',
            reviewNote: 'approved',
          }),
          makeReviewRecord({
            id: 'review-12',
            candidateId: input.candidateId,
            action: 'rollback',
            reviewer: 'reviewer-B',
            reviewNote: 'rolled back',
          }),
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/backflow/candidates/cand-6/reviews?limit=10`)
    const body = (await res.json()) as ReviewListResponse

    expect(res.status).toBe(200)
    expect(captured?.candidateId).toBe('cand-6')
    expect(captured?.limit).toBe(10)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.action).toBe('approve')
    expect(body.items[1]?.action).toBe('rollback')
  })

  test('GET /api/community/backflow/candidates supports lifecycleState filter', async () => {
    let captured: { status?: string; candidateType?: string; limit?: number; lifecycleState?: string } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      listKnowledgeBackflowCandidates: async (input) => {
        captured = input
        return [
          makeCandidateRecord({
            id: 'cand-7',
            candidateType: 'source_index',
            status: 'pending',
            lifecycleState: 'conflicted',
          }),
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/backflow/candidates?status=pending&lifecycleState=conflicted&limit=6`)
    const body = (await res.json()) as CandidateListResponse

    expect(res.status).toBe(200)
    expect(captured?.status).toBe('pending')
    expect(captured?.lifecycleState).toBe('conflicted')
    expect(captured?.limit).toBe(6)
    expect(body.items[0]?.id).toBe('cand-7')
    expect(body.items[0]?.lifecycleState).toBe('conflicted')
  })
})

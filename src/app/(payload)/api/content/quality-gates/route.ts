import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkHardGates } from '../../../../../../content-system/quality/hard-gates'
import { extractTextFromLexical } from '../../../../../../content-system/embeddings/lexical-text'

export const dynamic = 'force-dynamic'

async function validateAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (
      token === process.env.CONTENT_SYSTEM_SECRET ||
      token === process.env.PAYLOAD_API_KEY
    ) {
      return true
    }
  }
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) return true
  } catch {}
  return false
}

export async function POST(request: NextRequest) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const project = await payload.findByID({
      collection: 'content-projects',
      id: Number(projectId),
      depth: 0,
    }) as unknown as Record<string, unknown>

    // Extract body text
    let bodyText = ''
    if (project.body) {
      bodyText = extractTextFromLexical(project.body)
    } else if (project.sections) {
      const sections = typeof project.sections === 'string'
        ? JSON.parse(project.sections as string)
        : project.sections
      bodyText = Object.values(sections || {}).map((v) => String(v || '')).join('\n\n')
    }

    const result = await checkHardGates({
      projectId: String(projectId),
      body: bodyText,
      metaTitle: (project.metaTitle as string) || undefined,
      metaDescription: (project.metaDescription as string) || undefined,
    })

    const now = new Date().toISOString()

    // Persist result on the project
    await payload.update({
      collection: 'content-projects',
      id: Number(projectId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        qualityGatesResult: result.passed ? 'pass' : 'fail',
        qualityGatesViolations: result.violations,
        qualityGatesCheckedAt: now,
        // Reset override when re-checking
        qualityGatesOverridden: false,
        qualityGatesOverrideNote: null,
      } as any,
    })

    return NextResponse.json({
      success: true,
      passed: result.passed,
      errorCount: result.violations.filter((v) => v.severity === 'error').length,
      warningCount: result.violations.filter((v) => v.severity === 'warning').length,
      violations: result.violations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

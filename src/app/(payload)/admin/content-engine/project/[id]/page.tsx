import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { transformProject } from '@/lib/transform-project'
import { ProjectWorkspace } from '@/components/content-system/workspace/ProjectWorkspace'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const projectId = Number(id)

  if (!projectId || isNaN(projectId)) {
    notFound()
  }

  const payload = await getPayload({ config: configPromise })

  let raw: Record<string, unknown>
  try {
    raw = (await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    notFound()
  }

  const project = transformProject(raw)

  // Resolve hero image media record if set
  if (project.heroImageId) {
    try {
      const heroMedia = await payload.findByID({
        collection: 'media',
        id: project.heroImageId,
        depth: 0,
      }) as unknown as Record<string, unknown>
      project.heroImageImgixUrl = (heroMedia.imgixUrl as string) || null
      project.heroImageAlt = (heroMedia.alt as string) || (heroMedia.altText as string) || null
    } catch {
      // Hero image may have been deleted
      project.heroImageId = null
    }
  }

  // Resolve article image media records
  if (project.articleImages && project.articleImages.length > 0) {
    for (const img of project.articleImages) {
      try {
        const media = await payload.findByID({
          collection: 'media', id: img.mediaId, depth: 0,
        }) as unknown as Record<string, unknown>
        img.imgixUrl = (media.imgixUrl as string) || undefined
        img.alt = (media.alt as string) || (media.altText as string) || undefined
      } catch {
        // Image may have been deleted
      }
    }
  }

  return <ProjectWorkspace project={project} projectId={projectId} />
}

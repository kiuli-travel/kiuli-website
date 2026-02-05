// src/lib/designers.ts — Round-robin designer assignment

import { getPayload } from 'payload'
import config from '@payload-config'

export interface Designer {
  id: string
  name: string
  email: string
  active: boolean
  hubspotUserId: string | null
  lastAssignedAt: string | null
  totalAssigned: number
}

export async function assignDesigner(): Promise<Designer> {
  const payload = await getPayload({ config })

  // Get active designers ordered by last assignment (nulls first)
  const designers = await payload.find({
    collection: 'designers',
    where: {
      active: {
        equals: true,
      },
    },
    sort: 'lastAssignedAt',
    limit: 1,
  })

  if (!designers.docs || designers.docs.length === 0) {
    throw new Error('No active designers available for assignment')
  }

  const designer = designers.docs[0] as any

  // Update assignment tracking
  await payload.update({
    collection: 'designers',
    id: designer.id,
    data: {
      lastAssignedAt: new Date().toISOString(),
      totalAssigned: (designer.totalAssigned || 0) + 1,
    },
  })

  return {
    id: designer.id,
    name: designer.name,
    email: designer.email,
    active: designer.active,
    hubspotUserId: designer.hubspotUserId || null,
    lastAssignedAt: designer.lastAssignedAt || null,
    totalAssigned: (designer.totalAssigned || 0) + 1,
  }
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Create designers table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "designers" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "email" varchar NOT NULL UNIQUE,
      "active" boolean DEFAULT true NOT NULL,
      "hubspot_user_id" varchar,
      "last_assigned_at" timestamp(3) with time zone,
      "total_assigned" numeric DEFAULT 0 NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Add assignedDesignerId column to inquiries if not exists
  await db.execute(sql`
    ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "assigned_designer_id" varchar;
  `)

  // Seed designers
  await payload.create({
    collection: 'designers',
    data: {
      name: 'Graham Wallington',
      email: 'graham@kiuli.com',
      active: true,
      hubspotUserId: '70855001',
      totalAssigned: 0,
    },
  })

  await payload.create({
    collection: 'designers',
    data: {
      name: 'Catherine Miller',
      email: 'catherine@kiuli.com',
      active: false,
      totalAssigned: 0,
    },
  })

  await payload.create({
    collection: 'designers',
    data: {
      name: 'Kate Williams',
      email: 'kate@kiuli.com',
      active: false,
      totalAssigned: 0,
    },
  })
}

export async function down({ db, payload }: MigrateDownArgs): Promise<void> {
  // Delete all designers
  const designers = await payload.find({ collection: 'designers', limit: 100 })
  for (const designer of designers.docs) {
    await payload.delete({ collection: 'designers', id: designer.id })
  }

  // Remove assignedDesignerId column from inquiries
  await db.execute(sql`
    ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "assigned_designer_id";
  `)

  // Drop designers table
  await db.execute(sql`DROP TABLE IF EXISTS "designers";`)
}

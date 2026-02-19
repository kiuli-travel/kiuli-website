import dotenv from 'dotenv'
import path from 'path'
import pg from 'pg'

// Load from the project root .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const connStr =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL_NO_SSL ||
    process.env.POSTGRES_URL

  if (!connStr) {
    console.error('No database connection string found')
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DATABASE')).join(', '))
    process.exit(1)
  }

  console.log('Connecting with:', connStr.substring(0, 40) + '...')

  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // Before
  const before = await client.query('SELECT image_model FROM content_system_settings')
  console.log('BEFORE image_model:', before.rows[0]?.image_model)

  // Update
  await client.query("UPDATE content_system_settings SET image_model = 'black-forest-labs/flux.2-max'")
  console.log('UPDATE: SET image_model = black-forest-labs/flux.2-max')

  // After
  const after = await client.query('SELECT image_model FROM content_system_settings')
  console.log('VERIFIED image_model:', after.rows[0]?.image_model)

  await client.end()
  process.exit(0)
}
main()

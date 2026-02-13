import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { bootstrap } from '../content-system/embeddings/bootstrap'
import { end } from '../content-system/db'

async function main() {
  console.log('Starting embedding bootstrap...')
  const result = await bootstrap()
  console.log('\nBootstrap complete:', JSON.stringify(result, null, 2))
  await end()
  process.exit(0)
}

main().catch(e => {
  console.error('Bootstrap failed:', e)
  process.exit(1)
})

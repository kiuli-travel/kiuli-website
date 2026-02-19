/**
 * Bootstrap for test scripts running outside Next.js.
 * Registers tsconfig path aliases and loads .env.local.
 * Import this FIRST in every test script.
 */
import dotenv from 'dotenv'
import path from 'path'
import { register } from 'tsconfig-paths'

const projectRoot = path.resolve(import.meta.dirname, '..', '..')

// Load environment
dotenv.config({ path: path.join(projectRoot, '.env.local') })

// Allow self-signed certs for Vercel Postgres WebSocket in local scripts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// Register tsconfig paths so @payload-config and @/* resolve
register({
  baseUrl: projectRoot,
  paths: {
    '@payload-config': ['./src/payload.config.ts'],
    '@/*': ['./src/*'],
  },
})

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function seedUser() {
  const payload = await getPayload({ config })

  try {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'pipeline@kiuli.com',
        password: 'PipelineBot2026!',
        name: 'Pipeline Bot',
        enableAPIKey: true,
        apiKey: process.env.PAYLOAD_API_KEY || ''
      }
    })

    console.log('Created user:', {
      id: user.id,
      email: user.email,
      name: user.name,
      apiKey: user.apiKey
    })
  } catch (error) {
    console.error('Error creating user:', error)
  } finally {
    process.exit(0)
  }
}

seedUser()

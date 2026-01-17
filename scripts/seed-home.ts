import { getPayload } from 'payload'
import config from '@payload-config'

async function seedHome() {
  const payload = await getPayload({ config })

  // Check if home page already exists
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'home' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('Home page already exists, updating...')
    await payload.update({
      collection: 'pages',
      id: existing.docs[0].id,
      data: {
        title: 'Welcome to Kiuli',
        slug: 'home',
        _status: 'published',
        hero: {
          type: 'lowImpact',
          richText: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'heading',
                  children: [
                    {
                      type: 'text',
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: 'Welcome to Kiuli',
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  tag: 'h1',
                  version: 1,
                },
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: 'Extraordinary African Safari Experiences',
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          },
        },
        layout: [],
        meta: {
          title: 'Kiuli - African Safari Experiences',
          description: 'Connect with extraordinary African safari experiences curated by expert travel designers.',
        },
      },
    })
    console.log('Home page updated!')
  } else {
    console.log('Creating new home page...')
    await payload.create({
      collection: 'pages',
      data: {
        title: 'Welcome to Kiuli',
        slug: 'home',
        _status: 'published',
        hero: {
          type: 'lowImpact',
          richText: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'heading',
                  children: [
                    {
                      type: 'text',
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: 'Welcome to Kiuli',
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  tag: 'h1',
                  version: 1,
                },
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: 'Extraordinary African Safari Experiences',
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          },
        },
        layout: [],
        meta: {
          title: 'Kiuli - African Safari Experiences',
          description: 'Connect with extraordinary African safari experiences curated by expert travel designers.',
        },
      },
    })
    console.log('Home page created!')
  }

  process.exit(0)
}

seedHome().catch((err) => {
  console.error('Error seeding home page:', err)
  process.exit(1)
})

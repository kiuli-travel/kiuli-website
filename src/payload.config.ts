import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { makeS3StoragePlugin } from './plugins/s3Storage'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Destinations } from './collections/Destinations'
import { ImageStatuses } from './collections/ImageStatuses'
import { Inquiries } from './collections/Inquiries'
import { Sessions } from './collections/Sessions'
import { Itineraries } from './collections/Itineraries'
import { ItineraryJobs } from './collections/ItineraryJobs'
import { Media } from './collections/Media'
import { Notifications } from './collections/Notifications'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { TripTypes } from './collections/TripTypes'
import { Users } from './collections/Users'
import { VoiceConfiguration } from './collections/VoiceConfiguration'
import { Designers } from './collections/Designers'
import { Authors } from './collections/Authors'
import { Properties } from './collections/Properties'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { PropertyNameMappings } from './globals/PropertyNameMappings'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    // TEMPORARILY DISABLED ALL CUSTOM COMPONENTS TO DEBUG ADMIN ERROR
    // components: {
    //   beforeLogin: ['@/components/BeforeLogin'],
    //   beforeDashboard: ['@/components/BeforeDashboard'],
    //   afterNavLinks: [
    //     '@/components/admin/ImportItineraryLink#ImportItineraryLink',
    //     '@/components/admin/NotificationBell#NotificationBell',
    //   ],
    // },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.POSTGRES_URL || '',
    },
    push: false, // Disable schema push - use migrations only
  }),
  collections: [Pages, Posts, Media, Categories, Users, Itineraries, ItineraryJobs, ImageStatuses, Notifications, VoiceConfiguration, Destinations, TripTypes, Inquiries, Sessions, Designers, Authors, Properties],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, PropertyNameMappings],
  // S3 storage disabled to debug dashboard error
  plugins: [
    // makeS3StoragePlugin(),
    ...plugins,
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [],
  },
})

import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  serverComponentsExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium',
    '@puppeteer/browsers',
    'proxy-agent',
    'agent-base',
  ],
  experimental: {
    outputFileTracingIncludes: {
      '/api/scrape-itinerary': [
        './scrapers/**/*',
        './processors/**/*',
        './pipelines/**/*',
        './loaders/**/*',
        './schemas/**/*',
        './validation_scripts/**/*',
        './node_modules/puppeteer-core/**/*',
        './node_modules/puppeteer/**/*',
        './node_modules/@sparticuz/chromium/**/*',
        './node_modules/@puppeteer/**/*',
        './node_modules/proxy-agent/**/*',
        './node_modules/agent-base/**/*',
        './node_modules/axios/**/*',
        './node_modules/form-data/**/*',
        './node_modules/@google/generative-ai/**/*',
        './node_modules/ajv/**/*',
        './node_modules/ajv-formats/**/*',
      ],
    },
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

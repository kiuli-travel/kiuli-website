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
  experimental: {
    outputFileTracingIncludes: {
      '/api/scrape-itinerary': [
        './scrapers/dist/**/*',
        './scrapers/itrvl_scraper.cjs',
        './processors/**/*',
        './pipelines/**/*',
        './loaders/**/*',
        './schemas/**/*',
        './validation_scripts/**/*',
        // Include all puppeteer and chromium related dependencies
        './node_modules/@sparticuz/**',
        './node_modules/@puppeteer/**',
        './node_modules/puppeteer-core/**',
        './node_modules/puppeteer/**',
        // Include all proxy agent variants
        './node_modules/proxy-agent/**',
        './node_modules/*proxy-agent/**',
        './node_modules/agent-base/**',
        // Include common utility dependencies used by puppeteer
        './node_modules/debug/**',
        './node_modules/ms/**',
        './node_modules/supports-color/**',
        './node_modules/has-flag/**',
        './node_modules/ws/**',
        './node_modules/cosmiconfig/**',
        './node_modules/import-fresh/**',
        './node_modules/parent-module/**',
        './node_modules/resolve-from/**',
        './node_modules/path-type/**',
        './node_modules/yaml/**',
        './node_modules/devtools-protocol/**',
        './node_modules/chromium-bidi/**',
        './node_modules/mitt/**',
        './node_modules/unbzip2-stream/**',
        './node_modules/tar-fs/**',
        './node_modules/extract-zip/**',
      ],
    },
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

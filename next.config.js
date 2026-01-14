import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // imgix CDN for optimized images
      {
        protocol: 'https',
        hostname: 'kiuli.imgix.net',
      },
      // S3 bucket for raw images
      {
        protocol: 'https',
        hostname: 'kiuli-bucket.s3.eu-north-1.amazonaws.com',
      },
      // S3 wildcard pattern for any S3 bucket
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      // GitHub raw content for Payload logo
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
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
  outputFileTracingIncludes: {
      '/api/scrape-itinerary': [
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
        // Include proxy-agent specific dependencies
        './node_modules/proxy-from-env/**',
        './node_modules/get-uri/**',
        './node_modules/data-uri-to-buffer/**',
        './node_modules/file-uri-to-path/**',
        './node_modules/fs-extra/**',
        './node_modules/ip-address/**',
        './node_modules/netmask/**',
        './node_modules/pac-resolver/**',
        './node_modules/degenerator/**',
        './node_modules/escodegen/**',
        './node_modules/estraverse/**',
        './node_modules/ast-types/**',
        './node_modules/progress/**',
        './node_modules/follow-redirects/**',
        './node_modules/yargs/**',
        './node_modules/semver/**',
        // Include tar-fs dependencies
        './node_modules/tar-stream/**',
        './node_modules/pump/**',
        './node_modules/bare-fs/**',
        './node_modules/bare-path/**',
        // Include tar-stream dependencies
        './node_modules/b4a/**',
        './node_modules/fast-fifo/**',
        './node_modules/streamx/**',
        // Include extract-zip dependencies
        './node_modules/get-stream/**',
        './node_modules/yauzl/**',
        // Include streamx dependencies
        './node_modules/events-universal/**',
        './node_modules/text-decoder/**',
        // Include yauzl dependencies
        './node_modules/fd-slicer/**',
        './node_modules/buffer-crc32/**',
        // Include pump dependencies
        './node_modules/once/**',
        './node_modules/end-of-stream/**',
        // Include fd-slicer dependencies
        './node_modules/pend/**',
        // Include once dependencies
        './node_modules/wrappy/**',
        // Include dotenv for processors
        './node_modules/dotenv/**',
        // Include processor dependencies
        './node_modules/axios/**',
        './node_modules/form-data/**',
        './node_modules/ajv/**',
        './node_modules/ajv-formats/**',
        // Include form-data dependencies
        './node_modules/asynckit/**',
        './node_modules/combined-stream/**',
        './node_modules/es-set-tostringtag/**',
        './node_modules/hasown/**',
        './node_modules/mime-types/**',
        './node_modules/mime-db/**',
        './node_modules/delayed-stream/**',
        // Include es-set-tostringtag deep dependencies (es-*, call-*, get-*, has-*, function-*, dunder-*, gopd, math-*)
        './node_modules/es-*/**',
        './node_modules/call-*/**',
        './node_modules/get-*/**',
        './node_modules/has-*/**',
        './node_modules/function-*/**',
        './node_modules/dunder-*/**',
        './node_modules/gopd/**',
        './node_modules/math-*/**',
        // Include Google Generative AI (Gemini) for content enhancement
        './node_modules/@google/generative-ai/**',
      ],
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

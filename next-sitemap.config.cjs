const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'https://kiuli.com'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: false, // We maintain robots.txt manually for better control
  exclude: [
    '/posts-sitemap.xml',
    '/pages-sitemap.xml',
    '/safaris-sitemap.xml',
    '/destinations-sitemap.xml',
    '/properties-sitemap.xml',
    '/*',
    '/posts/*',
    '/safaris/*',
    '/destinations/*',
    '/properties/*',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '/admin/*',
      },
    ],
    additionalSitemaps: [
      `${SITE_URL}/pages-sitemap.xml`,
      `${SITE_URL}/posts-sitemap.xml`,
      `${SITE_URL}/safaris-sitemap.xml`,
      `${SITE_URL}/destinations-sitemap.xml`,
      `${SITE_URL}/properties-sitemap.xml`,
    ],
  },
}

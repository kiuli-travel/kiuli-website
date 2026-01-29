const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // Redirect admin.kiuli.com root to /admin
  const adminRootRedirect = {
    source: '/',
    has: [
      {
        type: 'host',
        value: 'admin.kiuli.com',
      },
    ],
    destination: 'https://admin.kiuli.com/admin',
    permanent: true,
  }

  // Redirect old /itineraries/ URLs to new /safaris/ URLs (SEO keyword optimization)
  const itinerariesToSafarisRedirect = {
    source: '/itineraries/:slug*',
    destination: '/safaris/:slug*',
    permanent: true, // 301 redirect for SEO
  }

  const redirects = [internetExplorerRedirect, adminRootRedirect, itinerariesToSafarisRedirect]

  return redirects
}

export default redirects

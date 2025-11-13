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

  const redirects = [internetExplorerRedirect, adminRootRedirect]

  return redirects
}

export default redirects

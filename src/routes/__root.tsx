import { Outlet, createRootRoute } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { RootDocument } from '../components/RootDocument'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'Davos Links' },
      {
        name: 'description',
        content: 'Enlaces cortos con marca propia y métricas claras.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
})

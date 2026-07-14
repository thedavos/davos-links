import { Outlet, createRootRoute } from '@tanstack/react-router'

import appCss from '#/styles.css?url'
import { RootDocument } from '#/components/RootDocument'
import { BRAND_FULL_NAME, BRAND_NAME, PUBLIC_ORIGIN } from '#/lib/constants'

const siteDescription = 'Enlaces cortos con marca propia y métricas claras.'
const ogImageUrl = `${PUBLIC_ORIGIN}/og-image.png`

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
      { title: BRAND_FULL_NAME },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        name: 'application-name',
        content: BRAND_FULL_NAME,
      },
      {
        name: 'theme-color',
        content: '#faf9f6',
      },
      {
        property: 'og:site_name',
        content: BRAND_FULL_NAME,
      },
      {
        property: 'og:title',
        content: BRAND_FULL_NAME,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: PUBLIC_ORIGIN,
      },
      {
        property: 'og:image',
        content: ogImageUrl,
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      {
        property: 'og:image:alt',
        content: `${BRAND_NAME} by davosdo — enlaces cortos con marca propia`,
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: BRAND_FULL_NAME,
      },
      {
        name: 'twitter:description',
        content: siteDescription,
      },
      {
        name: 'twitter:image',
        content: ogImageUrl,
      },
      {
        name: 'twitter:image:alt',
        content: `${BRAND_NAME} by davosdo — enlaces cortos con marca propia`,
      },
    ],
    links: [
      {
        rel: 'canonical',
        href: PUBLIC_ORIGIN,
      },
      {
        rel: 'icon',
        href: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: 'any',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
})

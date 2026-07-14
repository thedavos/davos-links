export const BRAND_NAME = 'atajo'
export const BRAND_BYLINE = 'by davosdo'
export const BRAND_FULL_NAME = `${BRAND_NAME} ${BRAND_BYLINE}`
export const BRAND_TAGLINE = 'La ruta corta.'
export const PUBLIC_ORIGIN = 'https://links.davosdo.dev'
export const DEFAULT_WORKSPACE_ID = 'wsp_default'
export const DEFAULT_DOMAIN_ID = 'dom_links_davosdo_dev'
export const DEFAULT_DOMAIN = 'links.davosdo.dev'

export const RESERVED_PATHS = new Set([
  'dashboard',
  'api',
  'health',
  'assets',
  '_build',
  '_static',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'login',
  'logout',
  'register',
  'settings',
  'admin',
  'app',
])

export const RESERVED_PREFIXES = [
  'dashboard/',
  'api/',
  'assets/',
  '_build/',
  '_static/',
]

export const CACHE_TTL_SECONDS = 60 * 10

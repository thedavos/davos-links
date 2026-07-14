PRAGMA foreign_keys = ON;

-- Re-runnable local demo data. Stable IDs keep this seed idempotent while the
-- relative dates keep both the current and previous 30-day charts populated.
INSERT INTO links (
  id, workspace_id, domain_id, title, description, destination_url,
  short_path, short_path_normalized, redirect_type, status,
  preserve_query_params, created_at, updated_at
)
VALUES
  ('lnk_demo_launch', 'wsp_default', 'dom_links_davosdo_dev',
   'Lanzamiento de producto', 'Campaña principal con picos de tráfico.',
   'https://davosdo.dev/products', 'lanzamiento', 'lanzamiento', 302, 'active', 1,
   datetime('now', '-120 days'), datetime('now')),
  ('lnk_demo_docs', 'wsp_default', 'dom_links_davosdo_dev',
   'Documentación para developers', 'Tráfico estable desde documentación.',
   'https://davosdo.dev/docs', 'docs', 'docs', 302, 'active', 1,
   datetime('now', '-110 days'), datetime('now')),
  ('lnk_demo_newsletter', 'wsp_default', 'dom_links_davosdo_dev',
   'Newsletter semanal', 'Picos semanales después de cada envío.',
   'https://davosdo.dev/newsletter', 'newsletter', 'newsletter', 302, 'active', 1,
   datetime('now', '-100 days'), datetime('now')),
  ('lnk_demo_github', 'wsp_default', 'dom_links_davosdo_dev',
   'Repositorio de GitHub', 'Enlace evergreen de tráfico medio.',
   'https://github.com/davosdo', 'github', 'github', 301, 'active', 1,
   datetime('now', '-90 days'), datetime('now')),
  ('lnk_demo_event', 'wsp_default', 'dom_links_davosdo_dev',
   'Registro al evento', 'Campaña finalizada con actividad histórica.',
   'https://davosdo.dev/events', 'evento-dev', 'evento-dev', 302, 'inactive', 1,
   datetime('now', '-80 days'), datetime('now')),
  ('lnk_demo_portfolio', 'wsp_default', 'dom_links_davosdo_dev',
   'Portafolio', 'Enlace de baja frecuencia con días sin clics.',
   'https://davosdo.dev/work', 'portafolio', 'portafolio', 302, 'active', 1,
   datetime('now', '-70 days'), datetime('now'))
ON CONFLICT(domain_id, short_path_normalized) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  destination_url = excluded.destination_url,
  redirect_type = excluded.redirect_type,
  status = excluded.status,
  updated_at = excluded.updated_at;

INSERT INTO links (
  id, workspace_id, domain_id, title, description, destination_url,
  short_path, short_path_normalized, redirect_type, status,
  preserve_query_params, expires_at, fallback_url, created_at, updated_at
)
VALUES
  ('lnk_demo_pricing', 'wsp_default', 'dom_links_davosdo_dev',
   'Planes y precios', 'Página comercial con tráfico alto de intención.',
   'https://davosdo.dev/pricing', 'precios', 'precios', 308, 'active', 1,
   NULL, NULL, datetime('now', '-68 days'), datetime('now')),
  ('lnk_demo_api', 'wsp_default', 'dom_links_davosdo_dev',
   'Referencia de API', 'Acceso directo a la referencia técnica.',
   'https://davosdo.dev/docs/api', 'api-reference', 'api-reference', 301, 'active', 0,
   NULL, NULL, datetime('now', '-64 days'), datetime('now')),
  ('lnk_demo_changelog', 'wsp_default', 'dom_links_davosdo_dev',
   'Changelog', 'Novedades y notas de cada versión.',
   'https://davosdo.dev/changelog', 'changelog', 'changelog', 302, 'active', 1,
   NULL, NULL, datetime('now', '-58 days'), datetime('now')),
  ('lnk_demo_discord', 'wsp_default', 'dom_links_davosdo_dev',
   'Comunidad de Discord', 'Invitación a la comunidad de developers.',
   'https://discord.gg/davos-demo', 'comunidad', 'comunidad', 307, 'active', 0,
   datetime('now', '+90 days'), 'https://davosdo.dev/community', datetime('now', '-52 days'), datetime('now')),
  ('lnk_demo_webinar', 'wsp_default', 'dom_links_davosdo_dev',
   'Webinar de arquitectura', 'Registro temporal con fallback al contenido grabado.',
   'https://davosdo.dev/webinars/architecture/register', 'webinar-arquitectura', 'webinar-arquitectura', 302, 'active', 1,
   datetime('now', '-5 days'), 'https://davosdo.dev/webinars/architecture/replay', datetime('now', '-48 days'), datetime('now')),
  ('lnk_demo_report', 'wsp_default', 'dom_links_davosdo_dev',
   'Reporte anual 2026', 'Descarga del reporte para campañas B2B.',
   'https://davosdo.dev/reports/2026.pdf', 'reporte-2026', 'reporte-2026', 307, 'active', 1,
   NULL, NULL, datetime('now', '-42 days'), datetime('now')),
  ('lnk_demo_hiring', 'wsp_default', 'dom_links_davosdo_dev',
   'Vacantes abiertas', 'Página de contratación pausada temporalmente.',
   'https://davosdo.dev/careers', 'trabaja-con-nosotros', 'trabaja-con-nosotros', 302, 'inactive', 1,
   NULL, NULL, datetime('now', '-36 days'), datetime('now')),
  ('lnk_demo_mobile', 'wsp_default', 'dom_links_davosdo_dev',
   'Descarga de la app', 'Deep link de adquisición para dispositivos móviles.',
   'https://davosdo.dev/download?platform=auto', 'descargar-app', 'descargar-app', 302, 'active', 1,
   datetime('now', '+180 days'), 'https://davosdo.dev/download', datetime('now', '-30 days'), datetime('now')),
  ('lnk_demo_partner', 'wsp_default', 'dom_links_davosdo_dev',
   'Programa de partners', 'Landing de alianzas archivada para probar filtros.',
   'https://davosdo.dev/partners', 'partners', 'partners', 301, 'archived', 0,
   NULL, NULL, datetime('now', '-24 days'), datetime('now')),
  ('lnk_demo_support', 'wsp_default', 'dom_links_davosdo_dev',
   'Centro de soporte', 'Enlace de servicio con tráfico bajo pero constante.',
   'https://davosdo.dev/support', 'soporte', 'soporte', 308, 'active', 1,
   NULL, NULL, datetime('now', '-18 days'), datetime('now'))
ON CONFLICT(domain_id, short_path_normalized) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  destination_url = excluded.destination_url,
  redirect_type = excluded.redirect_type,
  status = excluded.status,
  preserve_query_params = excluded.preserve_query_params,
  expires_at = excluded.expires_at,
  fallback_url = excluded.fallback_url,
  updated_at = excluded.updated_at;

INSERT INTO tags (id, workspace_id, name, slug, color, created_at, updated_at)
VALUES
  ('tag_demo_marketing', 'wsp_default', 'Marketing', 'marketing', '#ec4899', datetime('now', '-120 days'), datetime('now')),
  ('tag_demo_product', 'wsp_default', 'Producto', 'producto', '#2563eb', datetime('now', '-120 days'), datetime('now')),
  ('tag_demo_developers', 'wsp_default', 'Developers', 'developers', '#7c3aed', datetime('now', '-110 days'), datetime('now')),
  ('tag_demo_social', 'wsp_default', 'Social', 'social', '#16a34a', datetime('now', '-100 days'), datetime('now')),
  ('tag_demo_events', 'wsp_default', 'Eventos', 'eventos', '#ea580c', datetime('now', '-90 days'), datetime('now')),
  ('tag_demo_evergreen', 'wsp_default', 'Evergreen', 'evergreen', '#0891b2', datetime('now', '-80 days'), datetime('now'))
ON CONFLICT(workspace_id, slug) DO UPDATE SET
  name = excluded.name,
  color = excluded.color,
  updated_at = excluded.updated_at;

INSERT OR IGNORE INTO link_tags (link_id, tag_id, workspace_id, created_at)
VALUES
  ('lnk_demo_launch', 'tag_demo_marketing', 'wsp_default', datetime('now')),
  ('lnk_demo_launch', 'tag_demo_product', 'wsp_default', datetime('now')),
  ('lnk_demo_docs', 'tag_demo_developers', 'wsp_default', datetime('now')),
  ('lnk_demo_docs', 'tag_demo_evergreen', 'wsp_default', datetime('now')),
  ('lnk_demo_newsletter', 'tag_demo_marketing', 'wsp_default', datetime('now')),
  ('lnk_demo_newsletter', 'tag_demo_social', 'wsp_default', datetime('now')),
  ('lnk_demo_github', 'tag_demo_developers', 'wsp_default', datetime('now')),
  ('lnk_demo_github', 'tag_demo_social', 'wsp_default', datetime('now')),
  ('lnk_demo_github', 'tag_demo_evergreen', 'wsp_default', datetime('now')),
  ('lnk_demo_event', 'tag_demo_marketing', 'wsp_default', datetime('now')),
  ('lnk_demo_event', 'tag_demo_events', 'wsp_default', datetime('now')),
  ('lnk_demo_portfolio', 'tag_demo_evergreen', 'wsp_default', datetime('now')),
  ('lnk_demo_pricing', 'tag_demo_product', 'wsp_default', datetime('now')),
  ('lnk_demo_pricing', 'tag_demo_marketing', 'wsp_default', datetime('now')),
  ('lnk_demo_api', 'tag_demo_developers', 'wsp_default', datetime('now')),
  ('lnk_demo_changelog', 'tag_demo_developers', 'wsp_default', datetime('now')),
  ('lnk_demo_discord', 'tag_demo_social', 'wsp_default', datetime('now')),
  ('lnk_demo_webinar', 'tag_demo_events', 'wsp_default', datetime('now')),
  ('lnk_demo_report', 'tag_demo_marketing', 'wsp_default', datetime('now')),
  ('lnk_demo_hiring', 'tag_demo_evergreen', 'wsp_default', datetime('now')),
  ('lnk_demo_mobile', 'tag_demo_product', 'wsp_default', datetime('now')),
  ('lnk_demo_partner', 'tag_demo_marketing', 'wsp_default', datetime('now')),
  ('lnk_demo_support', 'tag_demo_evergreen', 'wsp_default', datetime('now'));

INSERT INTO campaigns (
  id, workspace_id, name, slug, description, starts_at, ends_at,
  created_at, updated_at, archived_at
)
VALUES
  ('cmp_demo_launch', 'wsp_default', 'Lanzamiento Q3', 'lanzamiento-q3',
   'Campaña activa para probar picos altos y conversión de producto.',
   datetime('now', '-35 days'), datetime('now', '+25 days'),
   datetime('now', '-40 days'), datetime('now'), NULL),
  ('cmp_demo_developer', 'wsp_default', 'Developer Awareness', 'developer-awareness',
   'Distribución continua de documentación y contenido técnico.',
   datetime('now', '-60 days'), datetime('now', '+60 days'),
   datetime('now', '-65 days'), datetime('now'), NULL),
  ('cmp_demo_event', 'wsp_default', 'Davos Dev Meetup', 'davos-dev-meetup',
   'Campaña histórica de registro y seguimiento del evento.',
   datetime('now', '-55 days'), datetime('now', '-10 days'),
   datetime('now', '-60 days'), datetime('now'), datetime('now', '-9 days'))
ON CONFLICT(workspace_id, slug) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  archived_at = excluded.archived_at,
  updated_at = excluded.updated_at;

INSERT OR IGNORE INTO campaign_links (campaign_id, link_id, workspace_id, created_at)
VALUES
  ('cmp_demo_launch', 'lnk_demo_launch', 'wsp_default', datetime('now')),
  ('cmp_demo_launch', 'lnk_demo_newsletter', 'wsp_default', datetime('now')),
  ('cmp_demo_launch', 'lnk_demo_portfolio', 'wsp_default', datetime('now')),
  ('cmp_demo_developer', 'lnk_demo_docs', 'wsp_default', datetime('now')),
  ('cmp_demo_developer', 'lnk_demo_github', 'wsp_default', datetime('now')),
  ('cmp_demo_developer', 'lnk_demo_newsletter', 'wsp_default', datetime('now')),
  ('cmp_demo_developer', 'lnk_demo_api', 'wsp_default', datetime('now')),
  ('cmp_demo_developer', 'lnk_demo_changelog', 'wsp_default', datetime('now')),
  ('cmp_demo_launch', 'lnk_demo_pricing', 'wsp_default', datetime('now')),
  ('cmp_demo_launch', 'lnk_demo_mobile', 'wsp_default', datetime('now')),
  ('cmp_demo_event', 'lnk_demo_event', 'wsp_default', datetime('now')),
  ('cmp_demo_event', 'lnk_demo_newsletter', 'wsp_default', datetime('now')),
  ('cmp_demo_event', 'lnk_demo_webinar', 'wsp_default', datetime('now'));

WITH RECURSIVE days(day_offset, metric_date) AS (
  SELECT 0, date('now', '-59 days')
  UNION ALL
  SELECT day_offset + 1, date(metric_date, '+1 day')
  FROM days
  WHERE day_offset < 59
),
demo_links(link_id, weight) AS (
  VALUES
    ('lnk_demo_launch', 10),
    ('lnk_demo_docs', 6),
    ('lnk_demo_newsletter', 5),
    ('lnk_demo_github', 4),
    ('lnk_demo_event', 3),
    ('lnk_demo_portfolio', 1),
    ('lnk_demo_pricing', 9),
    ('lnk_demo_api', 7),
    ('lnk_demo_changelog', 3),
    ('lnk_demo_discord', 5),
    ('lnk_demo_webinar', 8),
    ('lnk_demo_report', 6),
    ('lnk_demo_hiring', 2),
    ('lnk_demo_mobile', 7),
    ('lnk_demo_partner', 2),
    ('lnk_demo_support', 2)
),
generated AS (
  SELECT
    link_id,
    metric_date,
    day_offset,
    CASE
      -- Two guaranteed zero days per week across the whole dashboard.
      WHEN day_offset % 7 IN (1, 5) THEN 0
      -- High spikes, medium waves, and low baseline days.
      WHEN day_offset % 13 = 0 THEN weight * 19 + (day_offset % 11)
      WHEN day_offset % 7 = 0 THEN weight * 9 + (day_offset % 8)
      WHEN day_offset % 4 = 0 THEN weight * 4 + (day_offset % 6)
      ELSE weight + ((day_offset * weight) % 9)
    END AS clicks
  FROM days
  CROSS JOIN demo_links
),
measured AS (
  SELECT
    link_id,
    metric_date,
    clicks,
    CASE WHEN clicks = 0 THEN 0 ELSE CAST(clicks * 0.06 AS INTEGER) END AS bot_clicks
  FROM generated
),
with_humans AS (
  SELECT
    link_id,
    metric_date,
    clicks,
    bot_clicks,
    MAX(clicks - bot_clicks, 0) AS human_clicks
  FROM measured
)
INSERT INTO daily_link_metrics (
  id, workspace_id, link_id, metric_date, clicks, unique_visitors, bot_clicks,
  countries_json, referrers_json, devices_json, browsers_json, created_at, updated_at
)
SELECT
  'met_demo_' || link_id || '_' || replace(metric_date, '-', ''),
  'wsp_default',
  link_id,
  metric_date,
  clicks,
  CASE WHEN clicks = 0 THEN 0 ELSE MAX(1, CAST(clicks * 0.78 AS INTEGER)) END,
  bot_clicks,
  json_object(
    'PE', human_clicks - CAST(human_clicks * 0.22 AS INTEGER) - CAST(human_clicks * 0.15 AS INTEGER) - CAST(human_clicks * 0.13 AS INTEGER) - CAST(human_clicks * 0.10 AS INTEGER),
    'US', CAST(human_clicks * 0.22 AS INTEGER),
    'ES', CAST(human_clicks * 0.15 AS INTEGER),
    'MX', CAST(human_clicks * 0.13 AS INTEGER),
    'CL', CAST(human_clicks * 0.10 AS INTEGER)
  ),
  json_object(
    'google.com', human_clicks - CAST(human_clicks * 0.28 AS INTEGER) - CAST(human_clicks * 0.18 AS INTEGER) - CAST(human_clicks * 0.12 AS INTEGER) - CAST(human_clicks * 0.10 AS INTEGER),
    '', CAST(human_clicks * 0.28 AS INTEGER),
    'linkedin.com', CAST(human_clicks * 0.18 AS INTEGER),
    'github.com', CAST(human_clicks * 0.12 AS INTEGER),
    'x.com', CAST(human_clicks * 0.10 AS INTEGER)
  ),
  json_object(
    'Mobile', human_clicks - CAST(human_clicks * 0.36 AS INTEGER) - CAST(human_clicks * 0.07 AS INTEGER) - CAST(human_clicks * 0.02 AS INTEGER),
    'Desktop', CAST(human_clicks * 0.36 AS INTEGER),
    'Tablet', CAST(human_clicks * 0.07 AS INTEGER),
    'Unknown', CAST(human_clicks * 0.02 AS INTEGER)
  ),
  json_object('Chrome', CAST(human_clicks * 0.58 AS INTEGER), 'Safari', CAST(human_clicks * 0.25 AS INTEGER), 'Firefox', CAST(human_clicks * 0.17 AS INTEGER)),
  datetime(metric_date),
  datetime('now')
FROM with_humans
WHERE 1
ON CONFLICT(link_id, metric_date) DO UPDATE SET
  clicks = excluded.clicks,
  unique_visitors = excluded.unique_visitors,
  bot_clicks = excluded.bot_clicks,
  countries_json = excluded.countries_json,
  referrers_json = excluded.referrers_json,
  devices_json = excluded.devices_json,
  browsers_json = excluded.browsers_json,
  updated_at = excluded.updated_at;

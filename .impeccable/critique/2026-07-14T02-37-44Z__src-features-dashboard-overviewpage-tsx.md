---
target: dashboard de Davos Links, especialmente coherencia temporal de KPIs y gráficos
total_score: 17
p0_count: 0
p1_count: 3
timestamp: 2026-07-14T02-37-44Z
slug: src-features-dashboard-overviewpage-tsx
---
# Crítica del dashboard de Davos Links

## Salud de diseño

| # | Heurística | Nota | Problema principal |
|---|---|---:|---|
| 1 | Visibilidad del estado | 1/4 | El filtro cambia antes que los datos y una respuesta antigua puede sobrescribir una nueva. |
| 2 | Correspondencia con el mundo real | 1/4 | “Clics totales” no es histórico total; 7d/30d son intersecciones ambiguas con el rango. |
| 3 | Control y libertad | 3/4 | Hay presets, fechas personalizadas, comparación y CSV, pero falta reset y validación clara. |
| 4 | Consistencia y estándares | 1/4 | Métricas de rendimiento y una instantánea de inventario parecen obedecer al mismo filtro aunque no lo hacen. |
| 5 | Prevención de errores | 1/4 | No hay límite visible de rango ni protección contra respuestas fuera de orden. |
| 6 | Reconocer antes que recordar | 2/4 | Las fechas están disponibles, pero no se repiten en títulos ni deltas. |
| 7 | Flexibilidad y eficiencia | 3/4 | Buen control temporal y exportación; el ranking no permite descubrir qué enlace impulsó el cambio. |
| 8 | Diseño estético y minimalista | 2/4 | Buena densidad, pero dos gráficos grandes repiten la misma serie diaria. |
| 9 | Recuperación ante errores | 1/4 | Error genérico sin reintento; estados vacíos sin explicación ni acción. |
| 10 | Ayuda y documentación | 2/4 | El tooltip de comparación ayuda, pero faltan población de clics, zona horaria y definición de “total”. |
| **Total** | | **17/40** | **Débil en confianza analítica, correcto en oficio visual.** |

## Veredicto sobre antipatrones

**Evaluación de diseño:** riesgo moderado de product-slop. La identidad vivid-light, la densidad compacta y el uso de azul/púrpura se sienten propios. La estructura, sin embargo, cae en una plantilla conocida: cuatro tarjetas métricas equivalentes, sparklines ornamentales y dos gráficos grandes que codifican la misma serie diaria. La interfaz parece confiable hasta que se intenta explicar qué significa cada número.

**Escaneo determinista:** cero hallazgos. El detector devolvió `[]` para `OverviewPage.tsx`, `Charts.tsx` y `date-range.tsx`. No hubo falsos positivos. Esto confirma que el defecto principal no es un patrón CSS detectable, sino semántica analítica y arquitectura de información.

**Evidencia visual:** no hubo overlay confiable. El cliente de navegador falló con `Cannot redefine property: process`; por HTTP, `/dashboard` respondió 307 hacia `/login`. Se usó como fallback evidencia de código, consultas SQL y respuesta HTTP sin autenticación.

## Impresión general

El dashboard tiene una buena base visual y un control temporal razonable, pero hoy promete más precisión de la que entrega. La mayor oportunidad es hacer que el rango seleccionado sea un contrato global: toda métrica de rendimiento, gráfico, ranking y exportación debe describir exactamente el mismo periodo y la misma población de clics. Las instantáneas que no puedan obedecerlo deben separarse y decir “Ahora”.

## Lo que funciona

1. El backend ya calcula un periodo anterior de igual duración, normaliza días sin datos y expone una comparación consistente.
2. Los presets 7d/30d/90d, el rango personalizado y el CSV permiten desde una consulta rápida hasta un análisis puntual.
3. La comparación azul actual contra púrpura punteado anterior usa color y estilo, no solo color; hay focus visible y soporte de movimiento reducido.

## Problemas prioritarios

### [P1] El contrato de métricas es matemáticamente incoherente

**Por qué importa:** destruye la confianza. “Clics totales” está limitado al rango elegido. “Últimos 7 días” y “Últimos 30 días” también están limitados por ese rango y, además, por una ventana respecto de hoy. En un rango histórico pueden mostrar cero aunque el sparkline muestre actividad. Los predicados `-7 days` y `-30 days` son inclusivos y abarcan 8/31 fechas.

**Solución:** reemplazar las tres tarjetas de clics por métricas del periodo seleccionado: `Clics humanos`, `Enlaces con actividad`, `Promedio diario` y, como secundaria opcional, `Clics automatizados` o `% bots`. Mostrar las fechas exactas y comparar contra el periodo anterior equivalente. Cuando la base anterior sea cero, usar `Nuevo` o `Sin base anterior`, nunca 100%.

**Comando sugerido:** `$impeccable clarify`, seguido de hardening del contrato backend.

### [P1] “Enlaces con más actividad” no es un ranking de actividad

**Por qué importa:** se toman los primeros cinco enlaces del listado general, sin conteo ni orden por clics. El usuario no puede saber qué causó un pico.

**Solución:** consulta server-side por el mismo rango, ordenada por clics humanos descendentes. Mostrar posición, título/ruta, clics, participación del tráfico y variación contra el periodo anterior.

**Comando sugerido:** `$impeccable shape`.

### [P1] El filtro puede quedar emparejado con datos de otra solicitud

**Por qué importa:** cambios rápidos pueden resolver fuera de orden. El botón seleccionado puede indicar 7d mientras la pantalla termina mostrando una respuesta anterior de 90d.

**Solución:** abortar la solicitud previa o validar un request ID; comprobar `response.ok`; usar skeleton/overlay durante la transición y repetir `8–14 jul 2026 · comparado con 1–7 jul` cerca del gráfico.

**Comando sugerido:** `$impeccable harden`.

### [P2] Los dos gráficos diarios son redundantes

**Por qué importa:** el área y las barras responden la misma pregunta con los mismos puntos. Duplican desplazamiento y carga sin producir una decisión nueva.

**Solución:** conservar un único gráfico temporal con comparación. Reemplazar el segundo por el ranking real de enlaces o, si existe una decisión operativa clara, por referrer/país/dispositivo. No añadir heatmap horario hasta tener suficiente volumen y un caso de uso de programación.

**Comando sugerido:** `$impeccable distill`.

### [P2] Se mezclan humanos y bots sin decirlo

**Por qué importa:** previews de Slack, WhatsApp y crawlers pueden inflar resultados. La pantalla de detalle ya usa el lenguaje “Solo clics humanos”, generando inconsistencia entre superficies.

**Solución:** usar clics humanos como métrica principal y exponer bots como métrica secundaria explícita.

**Comando sugerido:** `$impeccable clarify`.

## Personas y señales de riesgo

**Alex, operador avanzado:** elige 90d para detectar ganadores, pero recibe los enlaces más recientes y dos versiones de la misma tendencia. Debe abrir enlaces uno por uno para explicar un pico.

**Jordan, primer usuario:** elige 7d y ve que “Totales”, “7 días” y “30 días” convergen; o elige una semana histórica y obtiene tarjetas móviles en cero. Sin definiciones, concluye que la analítica está rota.

**Sam, usuario de lector de pantalla o baja visión:** los sparklines están ocultos del árbol accesible, las variaciones carecen de “vs. periodo anterior”, los estados no son regiones live/alert y los campos de fecha no tienen etiquetas visibles.

## Observaciones menores

- `comparison` y `heatmap` se descargan y guardan, pero no se usan en el overview.
- `Enlaces activos` es una instantánea actual y debe vivir en un grupo “Ahora”, fuera de KPIs filtrados.
- `/api/links` se vuelve a consultar cada vez que cambia el rango aunque no esté filtrado por rango.
- `max N` parece información de implementación, no una conclusión útil.
- “Actual” debería ser `Solo periodo`; “Comparar” debería ser `Comparar periodo anterior`.
- El tooltip comparativo alinea por posición, pero solo muestra la fecha actual; conviene mostrar ambas fechas.
- Los títulos de gráficos no declaran el rango efectivo ni la zona horaria.

## Modelo recomendado

**Contrato global:** un solo `DateRange` gobierna KPIs de rendimiento, ranking, gráfico, exportación y desglose. El rango exacto y el periodo comparado son visibles. Lo que no obedece el rango se separa bajo “Ahora”.

**Fila de KPIs:** `Clics humanos`, `Enlaces con actividad`, `Promedio diario` y opcionalmente `% bots`. Evitar tarjetas permanentes 7d/30d porque duplican el selector.

**Gráfico principal:** una sola tendencia diaria. Azul para el periodo seleccionado; púrpura punteado para el periodo anterior equivalente. Tooltip con ambas fechas reales.

**Panel de drivers:** `Enlaces con más clics` ordenado por clics del rango, con clics, share y delta. Este panel reemplaza el listado incorrecto y el gráfico diario redundante.

**Desgloses opcionales:** referrer, país o dispositivo solo si comparten rango y población. Heatmap día/hora solo cuando la densidad de datos y una decisión de publicación lo justifiquen.

## Preguntas a considerar

1. Si el usuario puede elegir cualquier periodo, ¿qué decisión siguen resolviendo tarjetas permanentes de 7 y 30 días?
2. ¿El producto optimiza eventos de redirect crudos o engagement humano?
3. ¿Qué debe saber el operador en cinco segundos: volumen, cambio o qué enlaces causaron el cambio?
4. Si desaparece el gráfico naranja, ¿qué capacidad real pierde el usuario?

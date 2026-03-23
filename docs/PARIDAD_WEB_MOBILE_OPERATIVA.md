# Paridad Operativa Web vs Mobile

## Alcance

Este documento compara la paridad real entre la web y la app mobile para los roles operativos:

- Cocina
- Bar
- Mesero

Queda fuera del alcance la vista de admin.

La comparación se basa en implementación real del repositorio y no solo en la bitácora.

## Estado de ejecución

| Fase | Estado | Objetivo | Resultado esperado |
| --- | --- | --- | --- |
| Fase 1 | En validación | Paridad funcional de mesero en entrega persistida | Web marca entrega real en backend y actualiza UI de forma consistente. |
| Fase 2 | En progreso | UX móvil de mesero en web | Flujo de mesa más cómodo en teléfono, menos dependencia de modales. |
| Fase 3 | En progreso | Filtros de producto en cocina y bar web | Operación más rápida y equivalente a mobile. |
| Fase 4 | En progreso | Afinado de compactos, reversión y vistas por mesa | Cierre de brechas de ergonomía y consistencia. |

## Backlog técnico acondicionable

### Fase 1. Paridad funcional de mesero en entrega persistida

- [x] Confirmar endpoint backend de entrega de comanda.
- [x] Exponer `marcarEntregada()` en el servicio web de comandas.
- [x] Reemplazar acknowledgment local por persistencia real en `MeseroView`.
- [x] Mantener feedback visual inmediato con estado optimista en web.
- [x] Escuchar evento `comanda-entregada` para refresco en tiempo real.
- [x] Verificar que los archivos modificados no introduzcan errores de editor.
- [x] Corregir uso de `localId` en preview admin para que cocina y bar reciban eventos del local real.
- [x] Agregar retorno explícito al admin cuando una vista operativa se abre en modo preview.
- [x] Restringir el catálogo de productos del modal de mesero al `localId` efectivo del preview.
- [x] Bloquear en backend la mezcla de productos de otros locales dentro de una comanda.
- [x] Volver tolerante el backend operativo ante comandas históricas con `localId` nulo usando `mesa.localId` como respaldo.
- [x] Clasificar operativamente productos `otros` por nombre y categoría para no perder pedidos de bar o cocina.
- [x] Normalizar datos locales ya creados en desarrollo para validar el preview sin esperar nuevas comandas limpias.
- [ ] Validar manualmente flujo completo desde teléfono en web.
- [ ] Ajustar modal o detalle de mesa si el estado entregado necesita restricciones adicionales.

### Fase 2. UX móvil de mesero en web

- [x] Definir un patrón móvil inicial tipo full-screen para el trabajo dentro de la mesa.
- [x] Reducir dependencia de modales encadenados cuando la mesa tiene una sola comanda.
- [x] Simplificar el ingreso al detalle de mesa para uso con una mano en casos frecuentes.
- [x] Mejorar densidad visual inicial del tablero con resumen rápido de mesas visibles y ocupadas.
- [ ] Unificar tratamiento de comandas cerradas y entregadas del día dentro del flujo de mesa.

### Fase 3. Filtros de producto en cocina y bar web

- [x] Agregar filtro por producto en cocina web.
- [x] Agregar filtro por producto en bar web.
- [x] Persistir filtros por usuario o por rol en web.
- [ ] Confirmar que el filtro no rompa modos agrupados ni recientes.

### Fase 4. Ajustes finos de paridad operativa

- [ ] Evaluar reversión de `listo` en web dentro de ventana corta.
- [x] Corregir transición visual para que un pedido marcado como listo permanezca breve tiempo en gris en cola y luego pase a recientes.
- [x] Alinear esa transición en vistas por pedido, compactas, por producto y por mesa.
- [ ] Definir si `por-mesa` debe quedar expuesto en bar y cocina en ambas plataformas.
- [ ] Alinear bitácora y documentación con la UI realmente expuesta.
- [x] Mejorar lectura de notas en compactos con acceso bajo demanda tipo modal.
- [x] Cerrar parte de la brecha de ergonomía en compactos de cocina y bar web.

## Leyenda

- ✅ Paridad completa: ambas plataformas cubren la misma capacidad de forma equivalente.
- 🟡 Paridad parcial: ambas la cubren, pero una plataforma tiene una UX o alcance inferior.
- 🔺 Web superior: la web expone una capacidad que mobile no expone o no completa.
- 🔻 Mobile superior: mobile expone una capacidad que la web no expone o no completa.
- ❌ Brecha crítica: diferencia funcional relevante para la operación.

## Fuentes revisadas

- [API_REFERENCE.md](../API_REFERENCE.md)
- [BITACORA.md](../BITACORA.md)
- [frontend/src/pages/bar/BarView.jsx](../frontend/src/pages/bar/BarView.jsx)
- [frontend/src/pages/cocina/CocinaView.jsx](../frontend/src/pages/cocina/CocinaView.jsx)
- [frontend/src/pages/mesero/MeseroView.jsx](../frontend/src/pages/mesero/MeseroView.jsx)
- [frontend/src/pages/mesero/ComandaModal.jsx](../frontend/src/pages/mesero/ComandaModal.jsx)
- [frontend/src/pages/mesero/MesaConComandaModal.jsx](../frontend/src/pages/mesero/MesaConComandaModal.jsx)
- [frontend/src/pages/mesero/AssignMesasModal.jsx](../frontend/src/pages/mesero/AssignMesasModal.jsx)
- [frontend/src/pages/mesero/PagoModal.jsx](../frontend/src/pages/mesero/PagoModal.jsx)
- [frontend/src/pages/mesero/ReporteDiaMesero.jsx](../frontend/src/pages/mesero/ReporteDiaMesero.jsx)
- [frontend/src/services/comandaService.js](../frontend/src/services/comandaService.js)
- [mobile/app/bar/index.tsx](../mobile/app/bar/index.tsx)
- [mobile/app/cocina/index.tsx](../mobile/app/cocina/index.tsx)
- [mobile/app/mesero/index.tsx](../mobile/app/mesero/index.tsx)
- [mobile/app/mesero/mesa/[mesaId].tsx](../mobile/app/mesero/mesa/%5BmesaId%5D.tsx)
- [mobile/src/services/comanda.ts](../mobile/src/services/comanda.ts)

## Resumen ejecutivo

| Rol | Estado general | Lectura operativa |
| --- | --- | --- |
| Bar | 🟡 Cercano a paridad | La web cubre el flujo principal, pero mobile tiene mejor filtrado y ergonomía táctil. |
| Cocina | 🟡 Cercano a paridad | La web cubre el flujo principal y expone una vista adicional; mobile conserva ventajas de filtro y compactación. |
| Mesero | ❌ Sin paridad real | La web funciona, pero no iguala el flujo táctil ni la persistencia de entrega que sí existe en mobile. |

## Capacidades transversales

| Capacidad | Web | Mobile | Estado | Observaciones |
| --- | --- | --- | --- | --- |
| Scope por local | Sí | Sí | ✅ | Ambas plataformas trabajan con `localId` y salas por rol/local. |
| Actualización en tiempo real por socket | Sí | Sí | ✅ | Hay suscripción por rol y por local. |
| Modo oscuro | Sí | Sí | ✅ | Web usa localStorage; mobile usa store + persistencia. |
| Persistencia de vista preferida | Sí | Sí | ✅ | En ambos casos se guarda localmente por rol. |
| Audio de notificación | Sí | Sí | 🟡 | Web usa audio HTML; mobile combina sonido y feedback háptico. |
| Soporte de assets operativos | Básico | Ampliado | 🔻 | Mobile usa gifs, audios y fondos específicos en `mobile/assets`. |

## Bar

| Capacidad | Web | Mobile | Estado | Observaciones |
| --- | --- | --- | --- | --- |
| Cola de pedidos pendientes | Sí | Sí | ✅ | Ambas consumen pendientes filtrados por `tipo = bebida`. |
| Vista de recientes | Sí | Sí | ✅ | Ambas exponen recientes con actualización en tiempo real. |
| Vista por pedido | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por pedido compacto | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por producto | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por producto compacto | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por mesa | Sí, visible en selector | Implementada pero no expuesta en selector | 🟡 | En mobile existe render de `por-mesa`, pero el selector visible no la ofrece. |
| Filtro por producto | No visible | Sí | 🔻 | Mobile tiene modal de filtro persistente por usuario. |
| Marcar pedido listo | Sí | Sí | ✅ | Ambas lo hacen contra backend. |
| Desmarcar listo | No visible | Sí | 🔻 | Mobile permite revertir dentro de ventana corta; en web no se vio flujo equivalente. |
| Acciones rápidas por mesa o batch | Sí | Sí | ✅ | Ambas soportan trabajo agrupado. |
| Ergonomía para teléfono | Correcta | Mejor | 🔻 | Mobile está más optimizada para una mano y densidad alta de operación. |

### Lectura de Bar

- La web ya puede sustituir a mobile para el flujo base.
- El principal faltante funcional-operativo es el filtro por producto.
- La principal mejora de UX pendiente es densidad y velocidad de interacción en pantallas pequeñas.

## Cocina

| Capacidad | Web | Mobile | Estado | Observaciones |
| --- | --- | --- | --- | --- |
| Cola de pedidos pendientes | Sí | Sí | ✅ | Ambas consumen pendientes filtrados por `tipo = comida`. |
| Vista de recientes | Sí | Sí | ✅ | Ambas exponen recientes. |
| Vista por pedido | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por pedido compacto | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por producto | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por producto compacto | Sí | Sí | ✅ | Disponible en ambas. |
| Vista por mesa | Sí | No visible | 🔺 | La web la expone; mobile no la ofrece en el modo declarado. |
| Filtro por producto | No visible | Sí | 🔻 | Mobile tiene modal y persistencia de selección. |
| Marcar pedido listo | Sí | Sí | ✅ | Ambas lo hacen contra backend. |
| Desmarcar listo | No visible | Sí | 🔻 | Mobile tiene reversión operativa; en web no se ve equivalente. |
| Lectura compacta de notas | Parcial | Mejor | 🔻 | Mobile resuelve mejor la lectura de notas dentro de tarjetas compactas. |
| Ergonomía para teléfono | Correcta | Mejor | 🔻 | Mobile está más ajustada a uso táctil intensivo. |

### Lectura de Cocina

- La web cubre el flujo principal y además expone una vista por mesa que puede ser útil.
- Mobile mantiene ventaja clara en filtrado por producto y en la operación compacta.
- Si se prioriza la web móvil, cocina necesita menos trabajo que mesero.

## Mesero

| Capacidad | Web | Mobile | Estado | Observaciones |
| --- | --- | --- | --- | --- |
| Dashboard de mesas | Sí | Sí | ✅ | Ambas tienen tablero principal. |
| Vista tipo lista | Sí | Sí | ✅ | Ambas la soportan. |
| Vista tipo cuadro o agrupada | Sí | Sí | ✅ | Ambas la soportan, aunque mobile está más afinada para móvil. |
| Asignación de mesas | Sí | Sí | ✅ | Existe modal o flujo dedicado en ambas. |
| Ver mesas asignadas vs no asignadas | Sí | Sí | ✅ | Ambas pueden filtrar la vista por asignación. |
| Abrir mesa sin comandas | Sí | Sí | ✅ | Ambas permiten crear nueva comanda desde mesa libre. |
| Continuar comanda existente | Sí | Sí | ✅ | Ambas lo soportan. |
| Crear nueva comanda cuando ya existe otra | Sí | Sí | ✅ | Ambas contemplan `forzar`. |
| Gestión de productos dentro de mesa | Sí | Sí | ✅ | Ambas permiten agregar productos con notas. |
| Cierre de comanda con efectivo | Sí | Sí | ✅ | Disponible en ambas. |
| Cierre de comanda con QR | Sí | Sí | ✅ | Disponible en ambas. |
| Cierre de comanda mixto | Sí | Sí | ✅ | Disponible en ambas. |
| Carga de comprobante QR | Sí | Sí | ✅ | Disponible en ambas. |
| Reporte del día | Sí | Sí | ✅ | Presente en ambas. |
| Mantener historial del día en la misma mesa | Parcial | Mejor | 🔻 | Mobile conserva mejor comandas cerradas y entregadas del día dentro del flujo de mesa. |
| Pantalla dedicada por mesa | No, usa modal | Sí | 🔻 | Mobile tiene ruta dedicada por mesa; la web depende de modales. |
| Flujo táctil de primer toque para entregar y segundo toque para abrir | No equivalente | Sí | 🔻 | Mobile lo resuelve con flujo optimista pensado para operación rápida. |
| Persistencia de entrega de comanda en backend | No visible | Sí | ❌ | Mobile usa `PUT /comandas/:id/entregar`; en web no se vio servicio ni uso equivalente. |
| Acknowledgment visual local | Sí | Sí, además de persistencia | 🟡 | En web el check es local al estado de la vista; en mobile se combina con persistencia real. |
| Reordenamiento inmediato tras entregar | Parcial | Sí | 🔻 | Mobile aplica optimismo y reorganiza la UI de inmediato. |
| Operación en una mano desde teléfono | Correcta | Mejor | 🔻 | La pantalla dedicada y el patrón táctil favorecen mucho a mobile. |

### Lectura de Mesero

Mesero es la brecha principal para una estrategia web-first en teléfonos.

La diferencia crítica no es solo visual:

- Mobile persiste la entrega real de comandas en backend.
- La web actualmente maneja un acknowledgment local en memoria de la pantalla.
- Eso implica que la web no replica exactamente el estado operativo de la app.

## Hallazgos críticos

### 1. Entrega persistida en mobile y no equivalente visible en web

En mobile existe servicio explícito para marcar la comanda como entregada:

- [mobile/src/services/comanda.ts](../mobile/src/services/comanda.ts)

Y ese servicio se usa activamente en el dashboard de mesero:

- [mobile/app/mesero/index.tsx](../mobile/app/mesero/index.tsx)

En la web, el flujo visible en mesero se resuelve con acknowledgment local de la comanda en estado React:

- [frontend/src/pages/mesero/MeseroView.jsx](../frontend/src/pages/mesero/MeseroView.jsx)

No se encontró un método equivalente en:

- [frontend/src/services/comandaService.js](../frontend/src/services/comandaService.js)

### 2. Filtros por producto faltantes en la web operativa

Bar y cocina en mobile cuentan con filtro por producto persistido por usuario.

En la web operativa no se detectó esa misma capacidad visible para el usuario.

### 3. La documentación de paridad no refleja del todo la exposición real en UI

La bitácora habla de paridad amplia en bar y cocina, pero en el código actual:

- Bar mobile tiene soporte de vista por mesa, aunque no está expuesta en el selector visible.
- Cocina mobile no expone la vista por mesa que sí aparece en la web.

## Priorización sugerida para el plan de trabajo

### Prioridad 1

Cerrar la brecha crítica de mesero:

- Integrar en web el flujo real de entregar comanda contra backend.
- Alinear el comportamiento visual con el estado persistido.

### Prioridad 2

Reducir fricción de uso de mesero en navegador móvil:

- Crear una vista dedicada por mesa o un drawer de pantalla completa.
- Evitar depender exclusivamente de modales grandes.

### Prioridad 3

Cerrar brechas operativas en cocina y bar:

- Agregar filtro por producto en web.
- Evaluar desmarcar listo en ventana corta.

### Prioridad 4

Unificar criterios de vistas:

- Definir si `por-mesa` debe ser estándar en ambas plataformas para bar y cocina.
- Alinear documentación con lo que realmente está expuesto en la UI.

## Plan de trabajo sugerido

| Fase | Objetivo | Impacto |
| --- | --- | --- |
| Fase 1 | Paridad funcional de mesero en entrega persistida | Crítico |
| Fase 2 | UX móvil de mesero en web | Alto |
| Fase 3 | Filtros de producto en cocina y bar web | Medio |
| Fase 4 | Afinado de compactos, reversión y vistas por mesa | Medio |

## Veredicto final

| Rol | ¿Web puede reemplazar mobile hoy? | Juicio |
| --- | --- | --- |
| Bar | Sí, con reservas | Operativamente viable, pero con pérdida de comodidad y filtrado. |
| Cocina | Sí, con reservas | Operativamente viable, con algunas ventajas incluso en web, pero faltan ajustes de ergonomía. |
| Mesero | No del todo | Falta paridad funcional real y una UX más apropiada para teléfono. |
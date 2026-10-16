# honorapp — logo (dirección 1b: "h con tilde de cobro")

Integrar el logo en la app reemplazando el logo/nombre anterior ("Consultorio").

## Archivos
- `HonorappLogo.tsx` — componente React. Usa CSS vars `--acc`, `--on-acc`, `--ink` (soporta tema claro/oscuro y acento petróleo). Props: `size` (px, default 34), `withWordmark` (default true).
- `honorapp-icon.svg` — ícono (fondo salvia #557F69, trazo blanco).
- `honorapp-icon-dark.svg` — ícono para tema oscuro (#8BB89F / #0E1A13).
- `honorapp-favicon.svg` — favicon, trazo más grueso para 16–32px.
- `honorapp-lockup.svg` / `honorapp-lockup-dark.svg` — ícono + wordmark. El texto depende de la fuente Figtree; para uso fuera de la app, convertir texto a contornos.

## Especificación
- Grilla 48×48, radio de esquina 12 (25%).
- Trazo: `M16 10v28M16 27c0-5 3.5-8 7.5-8s7.5 3 7.5 8v6l5-5`, ancho 4.2–4.6 (5.5 en ≤24px), extremos y uniones redondeados.
- Wordmark: "honorapp" en minúscula, Figtree 700, tracking −0.04em, tamaño ≈ 0.7× el alto del ícono, separación ≈ 0.3×.
- Colores: claro #557F69 / #FFFFFF / tinta #1E2420 · oscuro #8BB89F / #0E1A13 / tinta #ECEFEA.

## Dónde va
1. Login desktop (panel izquierdo), arriba a la izquierda — size 34.
2. Login mobile, sobre el formulario — size 34.
3. Sidebar desktop, encabezado — size 34.
4. `<link rel="icon" type="image/svg+xml" href="/honorapp-favicon.svg">` y título de la pestaña "honorapp".
5. PWA/manifest: generar PNG 192/512 desde `honorapp-icon.svg` (sin radio si el SO aplica máscara).

## Referencia
Implementación ya aplicada en el diseño: `Consultorio.dc.html` (Login y sidebar).

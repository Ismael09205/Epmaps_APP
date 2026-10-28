---
name: ui-epmaps
description: Custom Anti-Slop design system using brand hex codes (#243376, #1E72BA, #FFFFFF).
---

# Brand-Specific Anti-Slop Design System

Aplica esta skill junto a `@anti-slop`. Su objetivo es erradicar interfaces genéricas de IA forzando un diseño estructurado, limpio y de alto impacto visual basado únicamente en la paleta oficial.

Si esa no es la skill busca la skill con la que puedas trabajar en esta ruta .agents/skills

---

## 1. Definición Exacta de la Paleta Hexadecimal

Queda estrictamente prohibido usar grises o azules por defecto de Tailwind (`bg-slate-900`, `bg-gray-100`, `bg-indigo-600`). Toda la UI debe construirse a partir de estos 3 valores y sus derivados por opacidad/matiz:

| Rol | Color Hex | Uso Obligatorio |
| :--- | :--- | :--- |
| **Dominante / Estructura** | `#243376` *(Deep Navy)* | Textos principales, encabezados, bordes oscuros, paneles de alto contraste y fondos en modo oscuro. |
| **Acento / Interacción** | `#1E72BA` *(Electric Blue)* | Botones primarios, estados `:hover` de interacción, badges de estado activo, enlaces y *focus rings*. |
| **Lienzo / Limpieza** | `#FFFFFF` *(Pure White)* | Fondos limpios, tarjetas elevadas, texto sobre superficies oscuras `#243376`. |

---

## 2. Derivaciones Permitidas (Tonalidades sin romper la paleta)

Para no saturar la vista con azul puro y mantener capas de profundidad sin usar grises ajenos:

- **Superficie clara (Off-white matizado):**  
  Mezcla `#243376` al 3% sobre blanco (`#F5F7FB` o `rgba(36, 51, 118, 0.03)`). Úsalo para fondos de página o contenedores secundarios en lugar de grises neutros.
- **Bordes y Divisores de precisión:**  
  Usa `#243376` con 12% de opacidad (`border-[#243376]/12`) en modo claro, o `#FFFFFF` con 15% de opacidad (`border-white/15`) sobre fondos `#243376`.
- **Modo Oscuro Profundo (Deep Navy Base):**  
  Para paneles oscuros, utiliza el tono `#0E1430` (variación ultra profunda de `#243376`).

---

## 3. Tipografía Obligatoria (Anti-Slop Pairings)

Para evitar la estética genérica de *Inter*:

1. **Opción Tech-Corporate:**
   - Encabezados: `Plus Jakarta Sans` o `Space Grotesk` (Peso 700 / Bold, color `#243376`).
   - Cuerpo: `Plus Jakarta Sans` (Peso 400 / Regular, color `#243376` al 85% de opacidad).
   - Datos / Métricas / Código: `JetBrains Mono` (Color `#1E72BA`).

2. **Regla de Contraste Tipográfico:**
   - Títulos en **Bold / Heavy** usando `#243376`.
   - Etiquetas secundarias (*captions*) en **Uppercase / Tracking-wider (0.05em)** usando `#1E72BA`.

---

## 4. Componentes e Interacciones

### Botón Primario
- Fondo: `#1E72BA`
- Texto: `#FFFFFF`
- Estado Hover: Gradiente sutil o cambio a `#243376` (`hover:bg-[#243376] transition-colors duration-200`).
- Sombra: Descartada. Utilizar bordes nítidos de `1px` o micro-interacciones de escala (`active:scale-[0.98]`).

### Tarjetas y Contenedores
- Fondo: `#FFFFFF`
- Borde: `1px solid rgba(36, 51, 118, 0.12)` (`border-[#243376]/12`).
- Sin sombras difusas (`shadow-xl` prohibido). Si se requiere elevación, usar borde más marcado o sombra sólida corta estilo arquitectónico (`shadow-[3px_3px_0px_0px_#243376]`).

### Encabezados / Hero Sections
- Prohibido el texto centrado con gradientes multicolor.
- Usar bloques asimétricos: Columna izquierda con título grande en `#243376`, acentos en línea vertical o badges con borde `#1E72BA`.

---

## 5. Instrucción de Salida para el Agente

Al generar o modificar archivos del proyecto:
1. Anuncia en consola: `antislop active: brand-palette (#243376, #1E72BA, #FFFFFF)`.
2. Revisa que no exista ninguna clase de Tailwind tipo `bg-slate-*`, `bg-gray-*`, `text-indigo-*` ni `bg-blue-600`.
3. Aplica únicamente las reglas de derivación y componentes especificadas arriba.
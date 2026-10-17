// Aplica tema, tamaño de letra y colores antes de pintar (evita el parpadeo).
// Es un archivo aparte, y no un script dentro del HTML, para que la política de seguridad (vercel.json) no permita scripts sueltos.
try {
  var t = localStorage.getItem('tema')
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
  // Tamaño de letra elegido en Ajustes (todo escala con él).
  var l = { 1: '100%', 2: '112.5%', 3: '125%', 4: '137.5%', 5: '150%' }[localStorage.getItem('letra')]
  if (l) {
    document.documentElement.style.fontSize = l
    document.documentElement.dataset.letra = localStorage.getItem('letra')
  }
  // Colores para daltonismo (Ajustes).
  if (localStorage.getItem('colores') === 'daltonismo') document.documentElement.dataset.colores = 'daltonismo'
} catch (e) {}

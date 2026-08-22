# Cómo subir esta app a GitHub

## Antes de nada: limpia el repositorio

En `Mi-app-Engl`, borra TODO lo que subiste antes:
`assets`, `pc`, `css`, `js`, `index.html`, `manifest.json`, `sw.js`.
Sobrescribir no basta — los archivos viejos que no se repiten se quedan.

Cada carpeta se borra entrando a ella → menú `···` → Delete directory.

## Sube esto

Descomprime `ingles-app.zip`. Reconoces la carpeta correcta porque
adentro dice **estilos**, **codigo**, **iconos** — ninguno de esos
nombres existe en `ventas-ruta`, así que ya no hay forma de equivocarse.

En GitHub: **Add file → Upload files** y arrastra:

- los archivos `index.html`, `sw-ingles.js`, `app-ingles.webmanifest`
- las carpetas `estilos`, `codigo`, `iconos`

Arrastra el CONTENIDO de la carpeta, no la carpeta `ingles-app`.

Debe quedar así en la raíz:

```
codigo/  estilos/  iconos/  index.html  sw-ingles.js  app-ingles.webmanifest
```

## Activa Pages

**Settings → Pages → Deploy from a branch → main / (root) → Save.**
Espera 1–2 minutos.

## Borra el service worker viejo

La app de ventas quedó registrada en esa dirección y te la va a seguir
mostrando desde su caché aunque cambies los archivos.

En el PC, sobre `https://dhanielcontreras50.github.io/Mi-app-Engl/`:

1. F12 → pestaña **Application**
2. **Service Workers** → **Unregister**
3. **Storage** → **Clear site data**
4. Recarga con **Ctrl + Shift + R**

Si abriste la app de ventas en el celular desde esta misma dirección,
hazlo también allá: Chrome → Configuración → Privacidad → Borrar datos
de navegación.

## Comprueba que cargó

Debes ver fondo gris claro, el título "Repaso de **inglés**" arriba,
y un mensaje de que no hay nada vencido.

Si ves remisiones o clientes, el service worker viejo sigue vivo:
repite el paso anterior.

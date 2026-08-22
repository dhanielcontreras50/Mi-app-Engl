[LEEME.md](https://github.com/user-attachments/files/31326688/LEEME.md)
# Repaso de inglés

PWA personal de repaso espaciado. JS puro, sin framework ni compilación —
igual que `ventas-ruta`. Se publica en GitHub Pages y se instala desde Chrome
en Android.

## Publicar

```bash
git init && git add . && git commit -m "primera versión"
git remote add origin git@github.com:USUARIO/ingles.git
git push -u origin main
```

En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Queda en `https://USUARIO.github.io/ingles/`. Ábrela en Chrome de Android y
*Agregar a pantalla de inicio*.

Ojo: si haces el repositorio público, la clave de API **no** va en el código.
Se escribe en Ajustes y vive en IndexedDB, en el celular.

## Cómo está armado

```
index.html            cuatro vistas: repasar, agregar, progreso, ajustes
css/estilo.css        papel y tinta; azul para el inglés, vino para el español
js/db.js              IndexedDB: tarjetas, programacion, intentos, pasajes, config
js/srs.js             SM-2. No sabe qué hay dentro de una tarjeta
js/llm.js             genera tarjetas, valida gramática, califica speaking
js/voz.js             TTS y reconocimiento de voz del celular
js/app.js             sesión, generación, progreso, ajustes
sw.js                 cache del armazón para abrir sin datos
```

La separación importante: **`srs.js` nunca mira dentro de `carga`.** Pide las
tarjetas vencidas y devuelve la siguiente fecha. Por eso agregar un quinto tipo
de tarjeta no toca el algoritmo.

### Los cuatro tipos

| tipo | `carga` |
|---|---|
| `vocab` | `{en, es, ejemplo, ipa}` — una nota genera **dos** tarjetas (`direccion: en-es` y `es-en`) |
| `gramatica` | `{frase, solucion, aceptadas[], explicacion}` |
| `lectura` | `{pasajeId, pregunta, opciones[], correcta}` — el texto vive en el almacén `pasajes` |
| `speaking` | `{consigna, criterio, objetivo}` |

En gramática, si tu respuesta no coincide con ninguna aceptada, el modelo decide
si igual es válida; cuando lo es, se agrega a `aceptadas` y la tarjeta queda
mejor para la próxima.

En lectura no se guarda audio: el TTS del celular lee el texto cuando lo pides.

### El historial es el activo

`intentos` no se borra nunca. Al generar tarjetas nuevas con *Apuntar a mis
errores recientes*, se le pasan al modelo tus últimos 20 fallos para que el
material apunte ahí. Sin ese historial esto es un Anki cualquiera.

Exporta el JSON de vez en cuando desde Ajustes: es lo único irrecuperable.

## Lo que falta

- Editar o borrar tarjetas a mano.
- Gráfica de la carga de repasos que viene (hoy solo hay cifras).
- Detectar tarjetas quemadas: muchos fallos seguidos y facilidad en 1.3
  significa que la tarjeta está mal formulada, no que tú no sirvas.
  Conviene marcarlas y reescribirlas con el modelo.

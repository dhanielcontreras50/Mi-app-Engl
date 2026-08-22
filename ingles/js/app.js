// app.js — pega todo: sesión, generación, progreso, ajustes.
import * as db from './db.js';
import * as srs from './srs.js';
import * as llm from './llm.js';
import * as voz from './voz.js';

const $ = (s) => document.querySelector(s);
const el = (t, c, txt) => {
  const n = document.createElement(t);
  if (c) n.className = c;
  if (txt !== undefined) n.textContent = txt;
  return n;
};

const NOMBRE_TIPO = {
  vocab: 'Vocabulario', gramatica: 'Gramática',
  lectura: 'Lectura', speaking: 'Speaking',
};

let cola = [];
let actual = null;
let limiteSesion = 40;

/* ============ Navegación ============ */

function mostrarVista(nombre) {
  document.querySelectorAll('.vista').forEach((v) => v.classList.remove('activa'));
  $(`#vista-${nombre}`).classList.add('activa');
  document.querySelectorAll('nav button').forEach((b) =>
    b.classList.toggle('activa', b.dataset.vista === nombre));
  voz.callar();
  if (nombre === 'progreso') pintarProgreso();
  if (nombre === 'repasar' && !actual) iniciarSesion();
}

document.querySelectorAll('nav button').forEach((b) =>
  b.addEventListener('click', () => mostrarVista(b.dataset.vista)));

/* ============ Sesión de repaso ============ */

async function iniciarSesion() {
  const pendientes = await db.vencidas(limiteSesion);
  cola = pendientes;
  actualizarContador();
  siguiente();
}

function actualizarContador() {
  const n = cola.length + (actual ? 1 : 0);
  $('#contador').textContent = n ? `${n} pendiente${n === 1 ? '' : 's'}` : 'al día';
}

function siguiente() {
  actual = cola.shift() || null;
  actualizarContador();
  if (!actual) return pintarVacio();
  pintarTarjeta(actual);
}

function pintarVacio() {
  const c = $('#sesion');
  c.innerHTML = '';
  const v = el('div', 'vacio');
  v.appendChild(el('strong', null, 'No hay nada vencido'));
  v.appendChild(el('p', null, 'El repaso espaciado funciona porque respeta el descanso. Vuelve mañana, o crea tarjetas nuevas.'));
  const b = el('button', 'principal', 'Crear tarjetas');
  b.addEventListener('click', () => mostrarVista('agregar'));
  v.appendChild(b);
  c.appendChild(v);
}

function marcoTarjeta(tipo, extra) {
  const t = el('div', 'tarjeta');
  t.dataset.tipo = tipo;
  const e = el('div', 'etiqueta');
  e.appendChild(el('span', null, NOMBRE_TIPO[tipo]));
  e.appendChild(el('span', null, extra || ''));
  t.appendChild(e);
  return t;
}

function pintarTarjeta({ tarjeta, prog }) {
  const c = $('#sesion');
  c.innerHTML = '';
  const veces = prog.repeticiones ? `visto ${prog.repeticiones}×` : 'nueva';
  const marco = marcoTarjeta(tarjeta.tipo, veces);
  c.appendChild(marco);
  ({ vocab: pintarVocab, gramatica: pintarGramatica, lectura: pintarLectura, speaking: pintarSpeaking })
    [tarjeta.tipo](marco, c, tarjeta);
}

function filaNotas(contenedor, alCalificar) {
  const f = el('div', 'notas');
  srs.NOTAS.forEach((n) => {
    const b = el('button', null, n.texto);
    b.dataset.clave = n.clave;
    b.addEventListener('click', () => alCalificar(n.valor));
    f.appendChild(b);
  });
  contenedor.appendChild(f);
}

// La regla: muestra dónde quedó la tarjeta en la escala de intervalos.
function mostrarRegla(contenedor, intervalo) {
  const r = el('div', 'regla');
  srs.HITOS.forEach((h) => {
    const hito = el('div', 'hito', srs.textoIntervalo(h).replace(' días', 'd').replace(' día', 'd').replace(' meses', 'm'));
    hito.style.left = `${srs.posicionEnRegla(h) * 100}%`;
    r.appendChild(hito);
  });
  const m = el('div', 'marcador');
  m.dataset.texto = srs.textoIntervalo(intervalo);
  m.style.left = '0%';
  r.appendChild(m);
  contenedor.appendChild(r);
  requestAnimationFrame(() => { m.style.left = `${srs.posicionEnRegla(intervalo) * 100}%`; });
}

async function calificar(nota, respuesta = null, correccion = null) {
  const { tarjeta, prog } = actual;
  const nuevo = srs.calificar(prog, nota);
  await db.poner('programacion', nuevo);
  await db.registrarIntento({
    tarjetaId: tarjeta.id, fecha: Date.now(), nota, respuesta, correccion,
  });

  if (nota < 3) {
    cola.push({ tarjeta, prog: nuevo });   // vuelve al final de esta misma sesión
    siguiente();
    return;
  }

  const c = $('#sesion');
  c.innerHTML = '';
  const marco = marcoTarjeta(tarjeta.tipo, 'programada');
  marco.appendChild(el('p', 'anverso', srs.textoIntervalo(nuevo.intervalo)));
  marco.appendChild(el('p', 'pista', `Facilidad ${nuevo.facilidad.toFixed(2)} · ${nuevo.repeticiones} repasos seguidos`));
  mostrarRegla(marco, nuevo.intervalo);
  c.appendChild(marco);
  const b = el('button', 'principal', 'Siguiente');
  b.addEventListener('click', siguiente);
  c.appendChild(b);
  b.focus();
}

/* ---- vocab ---- */
function pintarVocab(marco, c, tarjeta) {
  const { en, es, ejemplo, ipa } = tarjeta.carga;
  const haciaEs = tarjeta.direccion === 'en-es';
  const frente = el('p', `anverso ${haciaEs ? 'en' : 'es'}`, haciaEs ? en : es);
  marco.appendChild(frente);
  if (haciaEs && ipa) marco.appendChild(el('span', 'ipa', ipa));

  const b = el('button', 'principal', 'Ver respuesta');
  c.appendChild(b);
  b.addEventListener('click', () => {
    b.remove();
    const r = el('div', 'reverso');
    r.appendChild(el('p', `anverso ${haciaEs ? 'es' : 'en'}`, haciaEs ? es : en));
    if (ejemplo) r.appendChild(el('p', 'ejemplo', ejemplo));
    if (voz.hayVoz()) {
      const bv = el('button', null, '▶ Escuchar');
      bv.style.marginTop = '12px';
      bv.addEventListener('click', () => voz.decir(ejemplo || en));
      r.appendChild(bv);
    }
    marco.appendChild(r);
    filaNotas(c, (n) => calificar(n));
  });
}

/* ---- gramatica ---- */
function pintarGramatica(marco, c, tarjeta) {
  const { frase, solucion, aceptadas = [], explicacion } = tarjeta.carga;
  marco.appendChild(el('p', 'anverso en', frase));
  const campo = el('input');
  campo.placeholder = 'Completa el espacio';
  campo.autocapitalize = 'none';
  campo.style.marginTop = '16px';
  marco.appendChild(campo);

  const b = el('button', 'principal', 'Revisar');
  c.appendChild(b);

  const normal = (s) => (s || '').toLowerCase().trim()
    .replace(/[’´`]/g, "'").replace(/\s+/g, ' ').replace(/[.,;!?]$/, '');

  b.addEventListener('click', async () => {
    const dada = campo.value;
    campo.disabled = true;
    b.remove();
    const validas = [solucion, ...aceptadas].map(normal);
    let acierto = validas.includes(normal(dada));
    const r = el('div', 'reverso');

    if (!acierto && dada.trim()) {
      const cargando = el('p', 'cargando', 'Revisando si tu versión también sirve…');
      r.appendChild(cargando);
      marco.appendChild(r);
      try {
        const v = await llm.esValida(frase, solucion, dada);
        cargando.remove();
        if (v.valida) {
          acierto = true;
          tarjeta.carga.aceptadas = [...aceptadas, dada.trim()];
          await db.poner('tarjetas', tarjeta);
          r.appendChild(el('div', 'aviso ok', `También es válida: ${v.nota}`));
        } else if (v.nota) {
          r.appendChild(el('div', 'aviso', v.nota));
        }
      } catch (e) {
        cargando.textContent = `No se pudo consultar: ${e.message}`;
      }
    } else {
      marco.appendChild(r);
    }

    r.appendChild(el('p', 'anverso en', solucion));
    if (aceptadas.length) r.appendChild(el('p', 'pista', `También: ${aceptadas.join(', ')}`));
    if (explicacion) r.appendChild(el('p', 'ejemplo', explicacion));
    r.insertBefore(el('div', acierto ? 'aviso ok' : 'aviso', acierto ? 'Correcto' : `Tu respuesta: ${dada || '(vacía)'}`), r.firstChild);

    if (acierto) filaNotas(c, (n) => calificar(n, dada));
    else calificarConBoton(c, dada);
  });
}

function calificarConBoton(c, respuesta) {
  const b = el('button', 'principal', 'Continuar');
  b.addEventListener('click', () => calificar(1, respuesta));
  c.appendChild(b);
}

/* ---- lectura ---- */
async function pintarLectura(marco, c, tarjeta) {
  const { pasajeId, pregunta, opciones, correcta } = tarjeta.carga;
  const pasaje = await db.obtener('pasajes', pasajeId);

  if (pasaje) {
    const p = el('div', 'pasaje');
    p.appendChild(el('h4', null, pasaje.titulo || ''));
    p.appendChild(el('p', null, pasaje.texto));
    marco.appendChild(p);
    if (voz.hayVoz()) {
      const bv = el('button', null, '▶ Escuchar el texto');
      bv.addEventListener('click', () => voz.decir(pasaje.texto, 0.9));
      marco.appendChild(bv);
    }
  }

  marco.appendChild(el('p', 'anverso en', pregunta));
  const caja = el('div', 'opciones');
  caja.style.marginTop = '14px';
  marco.appendChild(caja);

  opciones.forEach((o, i) => {
    const b = el('button', null, o);
    b.addEventListener('click', () => {
      [...caja.children].forEach((x) => { x.disabled = true; });
      const bien = i === correcta;
      b.classList.add(bien ? 'correcta' : 'errada');
      if (!bien) caja.children[correcta].classList.add('correcta');
      if (bien) filaNotas(c, (n) => calificar(n, o));
      else calificarConBoton(c, o);
    });
    caja.appendChild(b);
  });
}

/* ---- speaking ---- */
function pintarSpeaking(marco, c, tarjeta) {
  const { consigna, criterio, objetivo } = tarjeta.carga;
  marco.appendChild(el('p', 'anverso es', consigna));
  if (objetivo) marco.appendChild(el('p', 'pista', `Debe aparecer: ${objetivo}`));

  const trans = el('div', 'transcripcion');
  marco.appendChild(trans);

  if (!voz.hayMicrofono()) {
    marco.appendChild(el('div', 'aviso', 'Este navegador no reconoce voz. Escribe lo que dirías.'));
    const campo = el('textarea');
    campo.rows = 3;
    marco.appendChild(campo);
    const b = el('button', 'principal', 'Evaluar');
    b.addEventListener('click', () => evaluarHabla(c, marco, tarjeta, campo.value));
    c.appendChild(b);
    return;
  }

  let sesionVoz = null;
  const bGrabar = el('button', 'principal', '● Hablar');
  c.appendChild(bGrabar);

  bGrabar.addEventListener('click', () => {
    if (sesionVoz) {
      sesionVoz.detener();
      sesionVoz = null;
      bGrabar.textContent = '● Hablar';
      bGrabar.classList.remove('grabando');
      return;
    }
    trans.textContent = '';
    bGrabar.textContent = '■ Detener';
    bGrabar.classList.add('grabando');
    sesionVoz = voz.escuchar({
      alParcial: (t) => { trans.textContent = t; },
      alFinal: (t) => {
        sesionVoz = null;
        bGrabar.classList.remove('grabando');
        bGrabar.remove();
        evaluarHabla(c, marco, tarjeta, t || trans.textContent);
      },
      alError: (m) => { marco.appendChild(el('div', 'aviso', m)); },
    });
  });
}

async function evaluarHabla(c, marco, tarjeta, texto) {
  if (!texto || !texto.trim()) {
    marco.appendChild(el('div', 'aviso', 'No se captó nada. Intenta otra vez.'));
    return calificarConBoton(c, '');
  }
  c.innerHTML = '';
  const cargando = el('p', 'cargando', 'Evaluando lo que dijiste…');
  marco.appendChild(cargando);
  const { consigna, criterio, objetivo } = tarjeta.carga;
  try {
    const r = await llm.calificarHabla(consigna, criterio, objetivo, texto);
    cargando.remove();
    const rev = el('div', 'reverso');
    rev.appendChild(el('div', r.nota >= 3 ? 'aviso ok' : 'aviso', `Nota ${r.nota} de 5`));
    rev.appendChild(el('p', 'anverso en', r.correccion));
    if (r.comentario) rev.appendChild(el('p', 'ejemplo', r.comentario));
    if (voz.hayVoz()) {
      const bv = el('button', null, '▶ Escuchar la corrección');
      bv.style.marginTop = '12px';
      bv.addEventListener('click', () => voz.decir(r.correccion));
      rev.appendChild(bv);
    }
    marco.appendChild(rev);
    const b = el('button', 'principal', 'Continuar');
    b.addEventListener('click', () => calificar(r.nota, texto, r.correccion));
    c.appendChild(b);
  } catch (e) {
    cargando.remove();
    marco.appendChild(el('div', 'aviso', `No se pudo evaluar: ${e.message}`));
    calificarConBoton(c, texto);
  }
}

/* ============ Generar tarjetas ============ */

async function guardarGeneradas(tipo, datos) {
  const tarjetas = [];
  const programaciones = [];
  const nueva = (carga, extra = {}) => {
    const t = { id: db.uuid(), tipo, carga, creada: Date.now(), origen: 'modelo', ...extra };
    tarjetas.push(t);
    programaciones.push(srs.programacionInicial(t.id));
    return t;
  };

  if (tipo === 'vocab') {
    datos.forEach((d) => {
      const notaId = db.uuid();          // una nota, dos tarjetas
      nueva(d, { notaId, direccion: 'en-es' });
      nueva(d, { notaId, direccion: 'es-en' });
    });
  } else if (tipo === 'lectura') {
    const pasaje = { id: db.uuid(), ...datos.pasaje };
    await db.poner('pasajes', pasaje);
    datos.preguntas.forEach((p) => nueva({ pasajeId: pasaje.id, ...p }));
  } else {
    datos.forEach((d) => nueva(d));
  }

  await db.ponerVarios('tarjetas', tarjetas);
  await db.ponerVarios('programacion', programaciones);
  return tarjetas.length;
}

$('#btnGenerar').addEventListener('click', async () => {
  const salida = $('#resultadoGenerar');
  const tipo = $('#tipo').value;
  salida.innerHTML = '';
  salida.appendChild(el('p', 'cargando', 'Generando…'));
  try {
    const fallos = $('#usarFallos').checked ? await db.ultimosFallos(20) : [];
    const datos = await llm.generar(tipo, +$('#cantidad').value, $('#nivel').value, $('#tema').value.trim(), fallos);
    const n = await guardarGeneradas(tipo, datos);
    salida.innerHTML = '';
    salida.appendChild(el('div', 'aviso ok', `Listo: ${n} tarjeta${n === 1 ? '' : 's'} agregada${n === 1 ? '' : 's'}.`));
    const b = el('button', 'principal', 'Repasar ahora');
    b.addEventListener('click', () => mostrarVista('repasar'));
    salida.appendChild(b);
    actual = null;
    await refrescarContador();
  } catch (e) {
    salida.innerHTML = '';
    salida.appendChild(el('div', 'aviso', e.message));
  }
});

/* ============ Progreso ============ */

async function pintarProgreso() {
  const [tarjetas, prog, intentos] = await Promise.all([
    db.todos('tarjetas'), db.todos('programacion'), db.todos('intentos'),
  ]);
  const h = db.hoy();
  const deHoy = intentos.filter((i) => i.fecha >= h);
  const aciertos = deHoy.filter((i) => i.nota >= 3).length;
  const maduras = prog.filter((p) => p.intervalo >= 21).length;

  const cifras = [
    [tarjetas.length, 'tarjetas'],
    [prog.filter((p) => p.vence <= h).length, 'vencidas hoy'],
    [deHoy.length ? `${Math.round((aciertos / deHoy.length) * 100)}%` : '—', 'acierto hoy'],
    [maduras, 'ya asentadas'],
  ];
  const c = $('#cifras');
  c.innerHTML = '';
  cifras.forEach(([v, t]) => {
    const d = el('div', 'cifra');
    d.appendChild(el('b', null, String(v)));
    d.appendChild(el('span', null, t));
    c.appendChild(d);
  });

  const porTipo = {};
  tarjetas.forEach((t) => { porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1; });
  const p = $('#porTipo');
  p.innerHTML = '';
  Object.entries(NOMBRE_TIPO).forEach(([k, nombre]) => {
    const fila = el('div', 'etiqueta');
    fila.style.borderBottom = '1px solid var(--linea)';
    fila.style.padding = '10px 0';
    fila.appendChild(el('span', null, nombre));
    fila.appendChild(el('span', null, String(porTipo[k] || 0)));
    p.appendChild(fila);
  });
}

/* ============ Ajustes ============ */

async function cargarAjustes() {
  $('#apiKey').value = await db.leerConfig('apiKey', '');
  $('#modelo').value = await db.leerConfig('modelo', 'claude-sonnet-5');
  limiteSesion = await db.leerConfig('limite', 40);
  $('#limite').value = limiteSesion;
}

$('#btnGuardarAjustes').addEventListener('click', async () => {
  await db.guardarConfig('apiKey', $('#apiKey').value.trim());
  await db.guardarConfig('modelo', $('#modelo').value.trim() || 'claude-sonnet-5');
  limiteSesion = Math.max(5, +$('#limite').value || 40);
  await db.guardarConfig('limite', limiteSesion);
  const a = $('#avisoAjustes');
  a.innerHTML = '';
  a.appendChild(el('div', 'aviso ok', 'Ajustes guardados.'));
});

$('#btnExportar').addEventListener('click', async () => {
  const datos = await db.exportarTodo();
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ingles_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('#btnImportar').addEventListener('click', () => $('#archivoImportar').click());

$('#archivoImportar').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const a = $('#avisoAjustes');
  a.innerHTML = '';
  try {
    await db.importarTodo(JSON.parse(await f.text()));
    a.appendChild(el('div', 'aviso ok', 'Datos importados.'));
    actual = null;
    await refrescarContador();
  } catch (err) {
    a.appendChild(el('div', 'aviso', `No se pudo importar: ${err.message}`));
  }
});

/* ============ Arranque ============ */

async function refrescarContador() {
  const v = await db.vencidas(999);
  cola = [];
  $('#contador').textContent = v.length ? `${v.length} pendientes` : 'al día';
}

async function inicio() {
  await db.abrir();
  await cargarAjustes();
  await iniciarSesion();
  if (!(await llm.hayClave())) {
    const a = el('div', 'aviso');
    a.textContent = 'Pon tu clave de API en Ajustes para generar tarjetas.';
    $('#sesion').prepend(a);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

inicio();

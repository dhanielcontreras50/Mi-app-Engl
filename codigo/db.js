// db.js — IndexedDB. Cinco almacenes: tarjetas, programacion, intentos, pasajes, config.
const NOMBRE = 'ingles';
const VERSION = 1;
let _db = null;

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function hoy() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dias(n) {
  return hoy() + n * 86400000;
}

export function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('tarjetas')) {
        const s = db.createObjectStore('tarjetas', { keyPath: 'id' });
        s.createIndex('tipo', 'tipo');
        s.createIndex('notaId', 'notaId');
        s.createIndex('pasajeId', 'carga.pasajeId');
      }
      if (!db.objectStoreNames.contains('programacion')) {
        const s = db.createObjectStore('programacion', { keyPath: 'tarjetaId' });
        s.createIndex('vence', 'vence');
      }
      if (!db.objectStoreNames.contains('intentos')) {
        const s = db.createObjectStore('intentos', { keyPath: 'id', autoIncrement: true });
        s.createIndex('tarjetaId', 'tarjetaId');
        s.createIndex('fecha', 'fecha');
      }
      if (!db.objectStoreNames.contains('pasajes')) {
        db.createObjectStore('pasajes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'clave' });
      }
    };
    req.onsuccess = () => { _db = req.result; res(_db); };
    req.onerror = () => rej(req.error);
  });
}

function tx(almacen, modo) {
  return abrir().then((db) => db.transaction(almacen, modo).objectStore(almacen));
}

function pedir(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function poner(almacen, valor) {
  const s = await tx(almacen, 'readwrite');
  return pedir(s.put(valor));
}

export async function ponerVarios(almacen, valores) {
  const db = await abrir();
  return new Promise((res, rej) => {
    const t = db.transaction(almacen, 'readwrite');
    const s = t.objectStore(almacen);
    valores.forEach((v) => s.put(v));
    t.oncomplete = () => res(valores.length);
    t.onerror = () => rej(t.error);
  });
}

export async function obtener(almacen, clave) {
  const s = await tx(almacen, 'readonly');
  return pedir(s.get(clave));
}

export async function todos(almacen) {
  const s = await tx(almacen, 'readonly');
  return pedir(s.getAll());
}

export async function borrar(almacen, clave) {
  const s = await tx(almacen, 'readwrite');
  return pedir(s.delete(clave));
}

export async function porIndice(almacen, indice, valor) {
  const s = await tx(almacen, 'readonly');
  return pedir(s.index(indice).getAll(valor));
}

// Tarjetas cuya fecha de vencimiento ya llegó, con su tarjeta unida.
// Dos transacciones separadas a propósito: mezclar await con una sola
// transacción de IndexedDB la cierra sola en algunos navegadores.
export async function vencidas(limite = 40) {
  const s = await tx('programacion', 'readonly');
  const prog = await pedir(s.index('vence').getAll(IDBKeyRange.upperBound(hoy())));
  prog.sort((a, b) => a.vence - b.vence || a.intervalo - b.intervalo);
  const corte = prog.slice(0, limite);
  const st = await tx('tarjetas', 'readonly');
  const tarjetas = await Promise.all(corte.map((p) => pedir(st.get(p.tarjetaId))));
  return corte
    .map((p, i) => ({ tarjeta: tarjetas[i], prog: p }))
    .filter((x) => x.tarjeta);
}

export async function registrarIntento(intento) {
  const s = await tx('intentos', 'readwrite');
  return pedir(s.add(intento));
}

// Los últimos fallos, en texto plano. Es lo que se le pasa al modelo
// para que las tarjetas nuevas apunten a lo que de verdad se te dificulta.
export async function ultimosFallos(n = 20) {
  const si = await tx('intentos', 'readonly');
  const todosInt = await pedir(si.index('fecha').getAll());
  const malos = todosInt.filter((i) => i.nota < 3).slice(-n).reverse();
  const st = await tx('tarjetas', 'readonly');
  const tarjetas = await Promise.all(malos.map((i) => pedir(st.get(i.tarjetaId))));
  return malos
    .map((i, k) => (tarjetas[k] ? { tipo: tarjetas[k].tipo, carga: tarjetas[k].carga, respuesta: i.respuesta } : null))
    .filter(Boolean);
}

export async function leerConfig(clave, porDefecto = null) {
  const v = await obtener('config', clave);
  return v === undefined || v === null ? porDefecto : v.valor;
}

export async function guardarConfig(clave, valor) {
  return poner('config', { clave, valor });
}

export async function exportarTodo() {
  const [tarjetas, programacion, intentos, pasajes] = await Promise.all([
    todos('tarjetas'), todos('programacion'), todos('intentos'), todos('pasajes'),
  ]);
  return { formato: 'ingles-v1', fecha: new Date().toISOString(), tarjetas, programacion, intentos, pasajes };
}

export async function importarTodo(datos) {
  if (datos.formato !== 'ingles-v1') throw new Error('Formato no reconocido');
  await ponerVarios('pasajes', datos.pasajes || []);
  await ponerVarios('tarjetas', datos.tarjetas || []);
  await ponerVarios('programacion', datos.programacion || []);
  // Los intentos llevan id autoincremental: se reinsertan sin id para no chocar.
  const s = await tx('intentos', 'readwrite');
  (datos.intentos || []).forEach((i) => { const { id, ...resto } = i; s.add(resto); });
  return true;
}

// srs.js — SM-2. No sabe nada del contenido: solo mira la nota de 0 a 5.
import { hoy, dias } from './db.js';

export const NOTAS = [
  { valor: 1, texto: 'Otra vez', clave: 'otra' },
  { valor: 3, texto: 'Difícil', clave: 'dificil' },
  { valor: 4, texto: 'Bien', clave: 'bien' },
  { valor: 5, texto: 'Fácil', clave: 'facil' },
];

export function programacionInicial(tarjetaId) {
  return {
    tarjetaId,
    vence: hoy(),
    intervalo: 0,
    facilidad: 2.5,
    repeticiones: 0,
    fallos: 0,
    ultimoRepaso: null,
  };
}

// Devuelve una programación nueva. No muta la que recibe.
export function calificar(prog, nota) {
  const p = { ...prog };
  p.ultimoRepaso = Date.now();

  if (nota < 3) {
    p.repeticiones = 0;
    p.fallos = (p.fallos || 0) + 1;
    p.intervalo = 1;
    p.vence = dias(1);
  } else {
    p.repeticiones = (p.repeticiones || 0) + 1;
    if (p.repeticiones === 1) p.intervalo = 1;
    else if (p.repeticiones === 2) p.intervalo = 6;
    else p.intervalo = Math.round(p.intervalo * p.facilidad);
    p.vence = dias(p.intervalo);
  }

  const d = 5 - nota;
  p.facilidad = Math.max(1.3, p.facilidad + (0.1 - d * (0.08 + d * 0.02)));
  p.facilidad = Math.round(p.facilidad * 1000) / 1000;
  return p;
}

// Para la regla de intervalos: posición 0..1 en escala logarítmica.
export const HITOS = [1, 3, 7, 14, 30, 90, 180];

export function posicionEnRegla(intervalo) {
  const max = HITOS[HITOS.length - 1];
  const v = Math.min(Math.max(intervalo, 1), max);
  return Math.log(v) / Math.log(max);
}

export function textoIntervalo(dias_) {
  if (dias_ < 1) return 'hoy';
  if (dias_ === 1) return '1 día';
  if (dias_ < 30) return `${dias_} días`;
  if (dias_ < 365) return `${Math.round(dias_ / 30)} meses`;
  return `${(dias_ / 365).toFixed(1)} años`;
}

// voz.js — TTS y reconocimiento de voz del propio celular. Sin red, sin costo.
let vozIngles = null;

function cargarVoces() {
  const vs = speechSynthesis.getVoices();
  vozIngles = vs.find((v) => /^en[-_]US/i.test(v.lang))
    || vs.find((v) => /^en/i.test(v.lang))
    || null;
}

if ('speechSynthesis' in window) {
  cargarVoces();
  speechSynthesis.onvoiceschanged = cargarVoces;
}

export function hayVoz() {
  return 'speechSynthesis' in window;
}

export function decir(texto, velocidad = 0.95) {
  if (!hayVoz()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'en-US';
  u.rate = velocidad;
  if (vozIngles) u.voice = vozIngles;
  speechSynthesis.speak(u);
}

export function callar() {
  if (hayVoz()) speechSynthesis.cancel();
}

const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;

export function hayMicrofono() {
  return !!Reconocimiento;
}

// Devuelve { detener() } y llama a los callbacks con lo que va oyendo.
export function escuchar({ alParcial, alFinal, alError }) {
  if (!Reconocimiento) {
    alError && alError('Este navegador no reconoce voz. Usa Chrome en Android.');
    return { detener() {} };
  }
  const r = new Reconocimiento();
  r.lang = 'en-US';
  r.interimResults = true;
  r.continuous = true;
  let acumulado = '';

  r.onresult = (e) => {
    let parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) acumulado += t + ' ';
      else parcial += t;
    }
    alParcial && alParcial((acumulado + parcial).trim());
  };
  r.onerror = (e) => alError && alError(`Micrófono: ${e.error}`);
  r.onend = () => alFinal && alFinal(acumulado.trim());

  r.start();
  return { detener: () => r.stop() };
}

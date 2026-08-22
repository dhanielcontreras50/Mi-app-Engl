// llm.js — llamadas al modelo. La clave vive en IndexedDB, nunca en el repo.
import { leerConfig } from './db.js';

const URL_API = 'https://api.anthropic.com/v1/messages';

export async function hayClave() {
  const c = await leerConfig('apiKey', '');
  return !!c;
}

async function pedir(sistema, mensaje, maxTokens = 2000) {
  const clave = await leerConfig('apiKey', '');
  const modelo = await leerConfig('modelo', 'claude-sonnet-5');
  if (!clave) throw new Error('Falta la clave de API. Ponla en Ajustes.');

  const r = await fetch(URL_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': clave,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      system: sistema,
      messages: [{ role: 'user', content: mensaje }],
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`El modelo respondió ${r.status}. ${t.slice(0, 200)}`);
  }
  const datos = await r.json();
  return datos.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function extraerJSON(texto) {
  const limpio = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
  const i = limpio.indexOf('[');
  const j = limpio.indexOf('{');
  const inicio = i === -1 ? j : (j === -1 ? i : Math.min(i, j));
  const fin = Math.max(limpio.lastIndexOf(']'), limpio.lastIndexOf('}'));
  if (inicio === -1 || fin === -1) throw new Error('El modelo no devolvió JSON.');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

const FORMATOS = {
  vocab: `[{"en":"...","es":"...","ejemplo":"frase en inglés con la palabra","ipa":"/.../"}]`,
  gramatica: `[{"frase":"She ___ here since 2019.","solucion":"has lived","aceptadas":["has been living"],"explicacion":"por qué, en español, máximo 2 frases"}]`,
  lectura: `{"pasaje":{"titulo":"...","texto":"120-180 palabras en inglés","nivel":"B1","tema":"..."},"preguntas":[{"pregunta":"...","opciones":["a","b","c","d"],"correcta":0}]}`,
  speaking: `[{"consigna":"lo que debe decir, en español","criterio":"qué evaluar, en español","objetivo":"estructura o vocabulario que debe aparecer"}]`,
};

export async function generar(tipo, cantidad, nivel, tema, fallos) {
  const contexto = fallos && fallos.length
    ? `\n\nErrores recientes del estudiante — apunta a estos puntos débiles:\n${JSON.stringify(fallos).slice(0, 3000)}`
    : '';

  const sistema =
    `Creas material de estudio de inglés para un hispanohablante colombiano de nivel ${nivel}. ` +
    `Respondes ÚNICAMENTE con JSON válido, sin preámbulo ni backticks. ` +
    `Formato exacto: ${FORMATOS[tipo]}`;

  const mensaje =
    `Genera ${cantidad} elemento(s) de tipo "${tipo}"` +
    (tema ? ` sobre el tema: ${tema}.` : '.') +
    ` Nivel ${nivel}. Inglés natural y de uso real, no de libro de texto.` +
    contexto;

  return extraerJSON(await pedir(sistema, mensaje, 3000));
}

// Se llama solo cuando la respuesta escrita no coincide con ninguna aceptada.
export async function esValida(frase, solucion, respuesta) {
  const sistema =
    'Evalúas si una respuesta de gramática inglesa es aceptable. ' +
    'Respondes solo JSON: {"valida":true|false,"nota":"explicación breve en español"}';
  const mensaje = `Frase: ${frase}\nRespuesta esperada: ${solucion}\nRespuesta del estudiante: ${respuesta}`;
  return extraerJSON(await pedir(sistema, mensaje, 400));
}

export async function calificarHabla(consigna, criterio, objetivo, transcripcion) {
  const sistema =
    'Evalúas producción oral en inglés de un hispanohablante. Sé exigente pero concreto. ' +
    'Respondes solo JSON: {"nota":0-5,"correccion":"la versión corregida en inglés",' +
    '"comentario":"qué mejorar, en español, máximo 2 frases"}';
  const mensaje =
    `Consigna: ${consigna}\nCriterio: ${criterio}\nDebía aparecer: ${objetivo}\n` +
    `Lo que dijo (transcrito, puede traer errores del reconocimiento de voz): ${transcripcion}`;
  return extraerJSON(await pedir(sistema, mensaje, 600));
}

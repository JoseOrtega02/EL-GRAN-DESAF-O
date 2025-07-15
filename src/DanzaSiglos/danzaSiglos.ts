import { Locator, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

function convertCrLfToLf(buffer: Buffer): Buffer {
  const crlf = Buffer.from([0x0d, 0x0a]);
  const lf = Buffer.from([0x0a]);
  const parts: Buffer[] = [];
  let lastIndex = 0;
  let index = buffer.indexOf(crlf);

  while (index !== -1) {
    parts.push(buffer.slice(lastIndex, index));
    parts.push(lf);
    lastIndex = index + crlf.length;
    index = buffer.indexOf(crlf, lastIndex);
  }
  parts.push(buffer.slice(lastIndex));
  return Buffer.concat(parts);
}

function extraerCodigoAcceso(texto: string): string | null {
  // Busca el patrón "Código de acceso: <CÓDIGO>"
  const regex = /Código de acceso:\s*([A-Z]{4,}[0-9]{2,})/;
  const match = texto.match(regex);
  return match ? match[1] : null;
}

export async function ingresarCodigo(page: Page, codigo: string,input: Locator,i:number): Promise<void> {
  console.log(`🔓 Ingresando código: ${codigo}`);
  await input.fill(codigo);
  const botonDesbloquear =  page.locator('button:has-text("Desbloquear")').nth(i);
  await botonDesbloquear.click();
  await page.waitForTimeout(1000);
  return
}

export async function searchButton(page: Page) {
  //await page.waitForSelector('button:has-text("Descargar PDF")', { timeout: 3000 });

  const botones = await page.locator('button').all();
  const textosBotones = await Promise.all(botones.map(boton => boton.textContent()));

  const botonesDescarga = botones.filter((boton, i) => {
    const text = textosBotones[i];
    console.log(`🔍 Verificando botón: ${text}`);
    return text?.includes("Descargar PDF") || text?.includes("Desbloquear");
  });

  console.log(`📌 Se encontraron ${botonesDescarga.length} botones de descarga`);
  return botonesDescarga;
}

export async function downloadPdf(page: Page, boton: Locator) {
  await page.waitForTimeout(2000); // Esperar 2 segundos entre acciones

  const [download] = await Promise.all([
    page.waitForEvent('download',{timeout: 10000}), // Esperar evento de descarga
    boton.click(),
  ]);

  const rawFilename = download.suggestedFilename();
  const safeFilename = rawFilename.replace(/[^\w\d.-]/g, '_');
  const savePath = path.join('./pdfs', safeFilename);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  let buffer = Buffer.concat(chunks);
  buffer = convertCrLfToLf(buffer);

  // ✅ Validar encabezado
  const fileHeader = buffer.slice(0, 5).toString();
  if (!fileHeader.startsWith('%PDF-')) {
    console.warn(`⚠️ Descarga no es PDF válido. Encabezado: ${fileHeader}`);
    const fallbackPath = savePath.replace(/\.pdf$/, '.html');
    fs.writeFileSync(fallbackPath, buffer);
    throw new Error(`❌ Contenido no válido. Guardado en: ${fallbackPath}`);
  }

  // 💾 Guardar PDF (después del chequeo)
  fs.writeFileSync(savePath, buffer);
    let tiempo_espera = 3;
  await page.waitForTimeout(tiempo_espera * 1000);

  return savePath;
}

async function readPdf(path: string): Promise<string | null> {
  try {
    const dataBuffer = fs.readFileSync(path);
    const fileHeader = dataBuffer.slice(0, 5).toString();
    console.log(`Encabezado del archivo: ${fileHeader}`);

    if (!fileHeader.startsWith('%PDF-')) {
      console.error('❌ El archivo no es un PDF válido.');
      return null;
    }

    const textContent = dataBuffer.toString('utf-8');
    const codigoAcceso = extraerCodigoAcceso(textContent);
    return codigoAcceso
  } catch (error) {
    console.error('❌ Error al leer el PDF desde disco:', error);
    return null;
  }
}

export async function danzaSiglos(page: Page) {
  let botonesDescarga = await searchButton(page);

  if (botonesDescarga.length === 0) {
    console.warn('⚠️ No se encontró ningún botón de descarga.');
    return;
  }
  let tiempo_espera = 3;
  await page.waitForTimeout(tiempo_espera * 1000);
  const inputsCodigo = await page.locator('input[placeholder="Ingresá el código"]').all();
  if (inputsCodigo.length < 2) {
    console.warn('⚠️ No se encontraron suficientes inputs para ingresar códigos.');
    return;
  }
  let codigo:string | null = null;
  try {
    for (let i = 0; i < botonesDescarga.length; i++) {
  const path = await downloadPdf(page, botonesDescarga[i]);
  await page.waitForTimeout(3000);

   codigo = await readPdf(path);

  // 🔄 Volver a obtener los inputs actualizados
  const inputsCodigo = await page.locator('input[placeholder="Ingresá el código"]').all();

  // 💡 Asegurarse de que haya inputs disponibles
  if (inputsCodigo.length === 0) {
    console.warn('⚠️ No hay inputs disponibles para ingresar el código.');
    break;
  }

  // ✅ Ingresar el código en cada input actual
  for (let j = 0; j < inputsCodigo.length; j++) {
    const input = inputsCodigo[j];
    if (codigo) {
      await ingresarCodigo(page, codigo, input, j);
      await page.waitForTimeout(1000);
    }
  }

  // 🔁 Recalcular los botones por si cambian después de desbloquear
  botonesDescarga = await searchButton(page);
}

    // Última descarga fuera del bucle
    const nuevosBotones = await searchButton(page);
    if (nuevosBotones.length > 0) {
      const ultimoBoton = nuevosBotones[0];

      // Esperar que esté visible y habilitado
      await ultimoBoton.waitFor({ state: 'visible' });
      await ultimoBoton.click();

      const path = await downloadPdf(page, ultimoBoton);
      console.log('✅ Último PDF descargado en:', path);
      return codigo
    }

  } catch (error) {
    console.error('❌ Error en proceso de descarga o lectura:', error);
  }
}



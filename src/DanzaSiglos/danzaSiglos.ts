
import { Locator, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

function extraerCodigoAcceso(texto: string): string | null {
  const regex = /\b[A-Z]{4,}[0-9]{2,}\b/;
  const match = texto.match(regex);
  return match ? match[1] : null;
}

async function ingresarCodigo(page: Page, codigo: string): Promise<void> {
  console.log(`🔓 Ingresando código: ${codigo}`);
  await page.fill('input[placeholder="Ingresá el código"]', codigo);
  await page.click('button:has-text("Desbloquear")');
  await page.waitForTimeout(1000);
}

async function searchButton(page: Page) {
  await page.waitForSelector('button:has-text("Descargar PDF")', { timeout: 10000 });

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

async function downloadPdf(page: Page, boton: Locator) {
  await page.waitForTimeout(2000); // Esperar 2 segundos entre acciones

  const [download] = await Promise.all([
    page.waitForEvent('download',{timeout: 10000}), // Esperar evento de descarga
    boton.click(),
    page.waitForEvent('download', { timeout: 10000 })
  ]);

  const rawFilename = download.suggestedFilename();
  const safeFilename = rawFilename.replace(/[^\w\d.-]/g, '_');
  const savePath = path.join('./pdfs', safeFilename);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  // ✅ Validar encabezado
  const fileHeader = buffer.slice(0, 5).toString();
  if (!fileHeader.startsWith('%PDF-')) {
    console.warn(`⚠️ Descarga no es PDF válido. Encabezado: ${fileHeader}`);
    const fallbackPath = savePath.replace(/\.pdf$/, '.html');
    fs.writeFileSync(fallbackPath, buffer);
    throw new Error(`❌ Contenido no válido. Guardado en: ${fallbackPath}`);
  }
  // 📖 Extraer texto del PDF con manejo de errores
  try {
    const parsed = await pdfParse(buffer);
    console.log('Texto del PDF:\n', parsed.text);
  } catch (error) {
    console.error('❌ Error al parsear el PDF:', error);
    fs.writeFileSync(savePath.replace(/\.pdf$/, '.corrupt.pdf'), buffer);
    throw new Error('❌ PDF corrupto, guardado para depurar');
  }

  // 💾 Guardar PDF (después del chequeo)
  fs.writeFileSync(savePath, buffer);
  await page.waitForTimeout(1000);

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

    const data = await pdfParse(dataBuffer);
    console.log(`📄 Páginas: ${data.numpages}`);
    console.log(data.text);
    const codigoAcceso = extraerCodigoAcceso(data.text);
    return codigoAcceso
  } catch (error) {
    console.error('❌ Error al leer el PDF desde disco:', error);
    return null;
  }
}

export async function danzaSiglos(page: Page) {
  const botonesDescarga = await searchButton(page);

  if (botonesDescarga.length === 0) {
    console.warn('⚠️ No se encontró ningún botón de descarga.');
    return;
  }

  const boton = botonesDescarga[0];

  try {
    const path = await downloadPdf(page, boton);
    await page.waitForTimeout(2000);
    const codigo = await readPdf(path);
    console.log(`🔑 Código extraído: ${codigo}`);
  } catch (error) {
    console.error('❌ Error en proceso de descarga o lectura:', error);
  }
}


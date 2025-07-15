import { Locator, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const TIEMPO_ESPERA = 3000;

function esperar(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  const regex = /Código de acceso:\s*([A-Z]{4,}[0-9]{2,})/;
  const match = texto.match(regex);
  return match?.[1] ?? null;
}

export async function ingresarCodigo(page: Page, codigo: string, input: Locator, index: number): Promise<void> {
  console.log(`🔓 Ingresando código: ${codigo}`);
  await input.fill(codigo);
  const botonDesbloquear = page.locator('button:has-text("Desbloquear")').nth(index);
  await botonDesbloquear.click();
  await esperar(1000);
}

export async function searchButton(page: Page): Promise<Locator[]> {
  const botones = await page.locator('button').all();
  const textos = await Promise.all(botones.map(b => b.textContent()));

  return botones.filter((_, i) => {
    const texto = textos[i];
    console.log(`🔍 Verificando botón: ${texto}`);
    return texto?.includes("Descargar PDF") || texto?.includes("Desbloquear");
  });
}

export async function downloadPdf(page: Page, boton: Locator): Promise<string> {
  await esperar(2000);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
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

  let buffer = convertCrLfToLf(Buffer.concat(chunks));

  const fileHeader = buffer.slice(0, 5).toString();
  if (!fileHeader.startsWith('%PDF-')) {
    console.warn(`⚠️ Archivo no válido. Encabezado: ${fileHeader}`);
    const fallbackPath = savePath.replace(/\.pdf$/, '.html');
    fs.writeFileSync(fallbackPath, buffer);
    throw new Error(`❌ Contenido inválido. Guardado como: ${fallbackPath}`);
  }

  fs.writeFileSync(savePath, buffer);
  await esperar(TIEMPO_ESPERA);
  return savePath;
}

async function readPdf(filePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    const header = buffer.slice(0, 5).toString();

    if (!header.startsWith('%PDF-')) {
      console.error('❌ Archivo no es un PDF válido.');
      return null;
    }

    const text = buffer.toString('utf-8');
    return extraerCodigoAcceso(text);
  } catch (error) {
    console.error('❌ Error leyendo el PDF:', error);
    return null;
  }
}

async function descargarYLeerCodigo(page: Page, boton: Locator): Promise<string | null> {
  const path = await downloadPdf(page, boton);
  return readPdf(path);
}

export async function danzaSiglos(page: Page) {
  let codigo:string | null = null
  let botones = await searchButton(page);

  if (botones.length === 0) {
    console.warn('⚠️ No se encontró ningún botón de descarga.');
    return;
  }

  await esperar(TIEMPO_ESPERA);

  for (let i = 0; i < botones.length; i++) {
     codigo = await descargarYLeerCodigo(page, botones[i]);

    const inputs = await page.locator('input[placeholder="Ingresá el código"]').all();
    if (inputs.length === 0) {
      console.warn('⚠️ No hay inputs disponibles para ingresar el código.');
      break;
    }

    for (let j = 0; j < inputs.length; j++) {
      if (codigo) {
        await ingresarCodigo(page, codigo, inputs[j], j);
        await esperar(1000);
      }
    }

    botones = await searchButton(page);
  }

  const nuevosBotones = await searchButton(page);
  if (nuevosBotones.length > 0) {
    const ultimo = nuevosBotones[0];
    await ultimo.waitFor({ state: 'visible' });
    await ultimo.click();

    const finalPath = await downloadPdf(page, ultimo);
    console.log('✅ Último PDF descargado en:', finalPath);
  }
  return codigo
}

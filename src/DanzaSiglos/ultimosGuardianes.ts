import { Page } from "playwright";
import { downloadPdf, ingresarCodigo, searchButton } from "./danzaSiglos";

const libros = [
  { name: "XVII", code: "" },
  { name: "XVIII", code: "" },
];

async function pasarPortal(page: Page) {
  console.log("🔮 Ingresando a los últimos guardianes...");
  await page.waitForTimeout(1000);

  const buttonNext = page.locator("button:has-text('2')");
  await buttonNext.click();

  await page.waitForTimeout(1000);
}

export async function llamadaApi(page: Page, codigo: string, libro: string) {
  try {
    const modal = page.locator('[role="dialog"], .modal, .MuiDialog-root').first();
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    const popupText = await modal.innerText();

    const metodo = popupText.match(/Método:\s*(GET|POST|PUT|DELETE)/i)?.[1]?.toUpperCase() ?? 'GET';
    const endpoint = popupText.match(/Endpoint:\s*(https?:\/\/[^\s]+)/i)?.[1] ?? '';

    const querys: Record<string, string> = {
      bookTitle: libro,
      unlockCode: codigo,
    };

    console.log('📤 API extraída:', { metodo, endpoint, querys });
    return { metodo, endpoint, querys };
  } catch (error) {
    console.error('❌ Error extrayendo la API del modal:', error);
    return null;
  }
}

export async function ingresarCodigosYDescargar(
  page: Page,
  codigos: string[]
): Promise<string[] | null> {
  try {
    let botonesDescarga = await searchButton(page);

    if (botonesDescarga.length === 0) {
      console.warn('⚠️ No se encontró ningún botón de descarga.');
      return null;
    }

    const pathsDescargados: string[] = [];
    await page.waitForTimeout(3000);

    for (let i = 0; i < codigos.length; i++) {
      const codigo = codigos[i];
      const input = page.locator('input[placeholder="Ingresá el código"]').first();

      await input.waitFor({ state: 'visible', timeout: 3000 });
      await ingresarCodigo(page, codigo, input, 0);
      await page.waitForTimeout(1000);

      const closeButton = page.locator('button:has-text("Cerrar")');
      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeButton.click();
        await closeButton.waitFor({ state: 'detached', timeout: 3000 });
      }

      botonesDescarga = await searchButton(page);

      if (!botonesDescarga[0]) {
        console.warn(`⚠️ No se encontró botón de descarga para el índice ${i}`);
        continue;
      }

      const path = await downloadPdf(page, botonesDescarga[0]);
      pathsDescargados.push(path);

      await page.waitForTimeout(3000);
    }

    return pathsDescargados;
  } catch (error) {
    console.error('❌ Error en ingreso de códigos o descarga:', error);
    return null;
  }
}

export async function ultimosGuardianes(page: Page, codigo: string) {
  await pasarPortal(page);
  await page.waitForSelector("button:has-text('Ver Documentación')");

  for (let i = 0; i < libros.length; i++) {
    const libro = libros[i];
    const boton = page.locator("button:has-text('Ver Documentación')").nth(0);

    if (!boton) {
      console.warn(`❌ Botón no encontrado para el índice ${i}`);
      continue;
    }

    await boton.click();
    await page.waitForTimeout(3000);

    console.log(`📖 Solicitando libro: ${libro.name}`);
    const resultado = await llamadaApi(page, codigo, libro.name);

    if (resultado) {
      const { metodo, endpoint, querys } = resultado;
      console.log('✅ API:', metodo, endpoint, querys);
      libro.code = querys.unlockCode;
    } else {
      console.log("⚠️ No se encontró información para este libro.");
    }

    console.log("❎ Cerrando el popup...");
    const closePopUp = page.locator('button[aria-label="Cerrar modal"]');
    await closePopUp.waitFor({ state: 'visible' });
    await closePopUp.click();
    await closePopUp.waitFor({ state: 'detached' });
    console.log("✅ Popup cerrado.");
    await page.waitForTimeout(3000);
  }

  const codigos = libros.map(libro => libro.code);
  const pathDescargados = await ingresarCodigosYDescargar(page, codigos);
  if (pathDescargados) {
    console.log('✅ PDFs descargados:', pathDescargados);
  }

  console.log("Todos los pdf descargados correctamente, verificar carpeta descargas llamada pdfs")
}

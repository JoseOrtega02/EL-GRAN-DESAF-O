import {chromium, Page} from "playwright"
import { danzaSiglos } from "./DanzaSiglos/danzaSiglos";
import { ultimosGuardianes } from "./DanzaSiglos/ultimosGuardianes";
// Invocación del portal
const credentials = {
  email: 'monje@sherpa.local',
  password: 'cript@123'
}
async function iniciarAventura():Promise<Page> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({acceptDownloads:true});

await context.setExtraHTTPHeaders({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
});



  const page = await context.newPage()
  // Navegar a la cripta
  await page.goto('https://pruebatecnica-sherpa-production.up.railway.app/login');
  return page
}

async function login(page: Page): Promise<void> {
  console.log("Iniciando sesión en la cripta...");
  // Ingresar las credenciales
  await page.waitForSelector('#email');
  await page.fill('#email', credentials.email);
  await page.waitForSelector('#password');
  await page.fill('#password', credentials.password);
  await page.click('button[type="submit"]');

  await page.waitForURL('https://pruebatecnica-sherpa-production.up.railway.app/portal');
  let tiempo_espera = 3
  await page.waitForTimeout(tiempo_espera * 1000);
}



async function aventura(){

try {
    const page = await iniciarAventura();
    await login(page);
    let tiempo_espera = 3
    await page.waitForTimeout(tiempo_espera * 1000);
    const codigo = await danzaSiglos(page);
    if(codigo){
        await ultimosGuardianes(page,codigo)
    }
    await page.close()
    console.log("script finalizado")
  } catch (error) {
    console.error('❌ Error durante la aventura:', error);
  }
}

aventura()

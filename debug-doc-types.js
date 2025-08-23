const puppeteer = require('puppeteer');

async function debugDocTypesPage() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  console.log('Navigating to document-types page...');
  await page.goto('http://localhost:4200/document-types', { waitUntil: 'networkidle2' });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Take screenshot
  await page.screenshot({ path: 'debug-doc-types.png', fullPage: true });
  console.log('Screenshot saved as debug-doc-types.png');
  
  // Get page content
  const content = await page.content();
  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());
  
  // Look for buttons
  const buttons = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    return allButtons.map(btn => ({
      text: btn.textContent.trim(),
      className: btn.className,
      id: btn.id
    }));
  });
  
  console.log('Buttons found:');
  buttons.forEach(btn => {
    console.log(`- "${btn.text}" (class: ${btn.className}, id: ${btn.id})`);
  });
  
  // Check if there are any Angular components loaded
  const ngComponents = await page.evaluate(() => {
    return document.querySelectorAll('[ng-version]').length > 0;
  });
  
  console.log('Angular components loaded:', ngComponents);
  
  // Check for any errors in console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  await browser.close();
}

debugDocTypesPage().catch(console.error);
const puppeteer = require('puppeteer');

async function debugPage() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  
  console.log('Navigating to localhost:4200...');
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle2' });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  console.log('Screenshot saved as debug-screenshot.png');
  
  // Get page title and URL
  const title = await page.title();
  const url = page.url();
  console.log('Title:', title);
  console.log('URL:', url);
  
  // Check for navigation elements
  const navLinks = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    return allLinks.map(link => ({
      href: link.href,
      text: link.textContent.trim(),
      routerLink: link.getAttribute('routerLink')
    })).filter(link => link.text || link.routerLink);
  });
  
  console.log('Navigation links found:');
  navLinks.forEach(link => {
    console.log(`- "${link.text}" -> ${link.href || link.routerLink}`);
  });
  
  // Check if there's any error on the page
  const errorElements = await page.$$eval('[class*="error"], .alert-danger', elements => 
    elements.map(el => el.textContent.trim())
  );
  
  if (errorElements.length > 0) {
    console.log('Errors found on page:');
    errorElements.forEach(error => console.log('- ', error));
  }
  
  // Check console logs
  const logs = await page.evaluate(() => {
    return window.console.history || [];
  });
  
  await browser.close();
}

debugPage().catch(console.error);
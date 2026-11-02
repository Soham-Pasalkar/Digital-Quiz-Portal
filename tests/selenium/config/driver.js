/**
 * Digital Quiz Portal - Selenium WebDriver Configuration
 * [STQA Academic Demonstration]: Selenium 4 WebDriver Factory for Google Chrome
 */

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

/**
 * Creates and configures a Selenium 4 Chrome WebDriver instance.
 * Supports headless execution by default, and headed execution via SELENIUM_HEADLESS=false.
 * @returns {Promise<import('selenium-webdriver').WebDriver>}
 */
async function createDriver() {
  const isHeadless = process.env.SELENIUM_HEADLESS !== 'false';
  const options = new chrome.Options();

  if (isHeadless) {
    options.addArguments('--headless=new');
  }

  options.addArguments('--window-size=1280,800');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-gpu');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--no-first-run');
  options.addArguments('--no-default-browser-check');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  // Set standard script & page timeouts (10 seconds)
  await driver.manage().setTimeouts({
    implicit: 0, // Prefer explicit waits per Selenium best practices
    pageLoad: 15000,
    script: 10000
  });

  return driver;
}

module.exports = {
  createDriver
};


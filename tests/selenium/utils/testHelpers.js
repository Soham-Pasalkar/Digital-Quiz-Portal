/**
 * Digital Quiz Portal - Selenium Test Helpers & Server Lifecycle Management
 * [Test Data Isolation]: Starts isolated in-memory DB and ephemeral Express server.
 */

const fs = require('fs');
const path = require('path');
const { until, By } = require('selenium-webdriver');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const { createApp } = require(path.join(PROJECT_ROOT, 'src/app'));
const { initDatabase } = require(path.join(PROJECT_ROOT, 'src/database/db'));
const { seedDatabase } = require(path.join(PROJECT_ROOT, 'src/database/seed'));

const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'docs/stqa/screenshots');

/**
 * Boots an ephemeral Express server with an isolated in-memory SQLite database.
 * Completely isolates test data from the tracked `database.sqlite` file.
 * @param {number} port
 * @returns {Promise<{ server: import('http').Server, db: any, url: string }>}
 */
async function startTestServer(port = 3500) {
  const db = await initDatabase({ dbPath: ':memory:' });
  await seedDatabase(db);
  const app = createApp({ dbClient: db });

  const server = await new Promise((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  const url = `http://127.0.0.1:${port}`;
  return { server, db, url };
}

/**
 * Shuts down test server and closes in-memory database.
 * @param {import('http').Server} server
 * @param {any} db
 */
async function stopTestServer(server, db) {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (db) {
    db.close();
  }
}

/**
 * Captures a full browser screenshot and writes it to docs/stqa/screenshots/
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {string} filename
 * @returns {Promise<string>} File path
 */
async function takeScreenshot(driver, filename) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  const imageBase64 = await driver.takeScreenshot();
  const filePath = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(filePath, imageBase64, 'base64');
  return filePath;
}

/**
 * Waits explicitly until element is located and visible in DOM.
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {import('selenium-webdriver').Locator} locator
 * @param {number} timeoutMs
 * @returns {Promise<import('selenium-webdriver').WebElement>}
 */
async function waitForVisible(driver, locator, timeoutMs = 5000) {
  await driver.wait(until.elementLocated(locator), timeoutMs);
  const el = await driver.findElement(locator);
  await driver.wait(until.elementIsVisible(el), timeoutMs);
  return el;
}

/**
 * Waits explicitly until element disappears or has .hidden class.
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {import('selenium-webdriver').Locator} locator
 * @param {number} timeoutMs
 */
async function waitForHidden(driver, locator, timeoutMs = 5000) {
  await driver.wait(async () => {
    try {
      const el = await driver.findElement(locator);
      const cls = await el.getAttribute('class');
      const displayed = await el.isDisplayed();
      return !displayed || (cls && cls.includes('hidden'));
    } catch {
      return true; // Element no longer in DOM
    }
  }, timeoutMs, 'Element did not become hidden within timeout');
}

module.exports = {
  startTestServer,
  stopTestServer,
  takeScreenshot,
  waitForVisible,
  waitForHidden
};


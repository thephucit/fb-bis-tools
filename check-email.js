import _ from 'lodash';
import clc from 'cli-color';
import puppeteer from 'puppeteer';
import {
  waitFor,
  getProxy,
  saveLogs,
  listEmails,
  loadCommonResources,
  welcomeMsg,
} from './utils.js';

/**
 * Main process function
 *
 * @return Void
 */
const main = async () => {
  await welcomeMsg();

  // Load common resources
  const key = process.argv[2];
  const resources = await loadCommonResources();

  if (_.isEmpty(resources)) {
    return console.log(clc.red('Missing common resources!'));
  }

  const checked = await listEmails('checked.txt');
  const emails = (await listEmails('emails.txt')).filter(
    (i) => !checked.includes(i),
  );
  const chunks = _.chunk(emails, 10);

  for (const chunk of chunks) {
    await runBatch(chunk, key, resources);
  }

  return console.log(clc.green('Done!'));
};

/**
 * Perform batch
 *
 * @param String email
 * @return Boolean
 */
const runBatch = async (emails, key, resources) => {
  const proxy = await getProxy(key);
  console.log(clc.yellow(`Proxy: ${proxy}`));
  console.log('-----------------------------');

  const promises = emails.map((email) =>
    verifiedEmail(email, proxy, resources),
  );
  const responses = await Promise.all(promises);

  if (responses.every((i) => i)) return true;

  await waitFor(resources.waitFor);

  return runBatch(emails, key, resources);
};

/**
 * Verified email on X
 *
 * @param String email
 * @return Boolean
 */
const verifiedEmail = async (email, proxy, resources) => {
  const options = [
    '--disable-notifications',
    '--no-sandbox',
    '--enable-gpu',
    '--window-size=390,840',
  ];

  if (proxy) {
    options.push(`--proxy-server=${proxy}`);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: options,
    defaultViewport: {
      width: 390,
      height: 840,
    },
  });

  try {
    const page = await browser.newPage();
    await page.goto(resources.verify_url, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
    });

    await page.type(resources.input_email, email);
    await page.keyboard.press('Enter');

    const [isValidLogin, isSuspicious] = (
      await Promise.allSettled([
        validLogin(page, resources),
        suspicious(page, resources),
      ])
    ).map((i) => _.get(i, 'value', false));

    if (isSuspicious) {
      console.log(clc.red('Suspicious login prevented.'));
      await browser.close();
      return false;
    }

    if (!isValidLogin && !isSuspicious) {
      console.log(clc.green(`Email available: ${email}`));
      saveLogs(email, 'checked.txt');
      await browser.close();
      return true;
    }

    await browser.close();
    saveLogs(email, 'output.txt');
    saveLogs(email, 'checked.txt');
    console.log(clc.red(`Email registered: ${email}`));

    return true;
  } catch (e) {
    await browser.close();
    return false;
  }
};

/**
 * Suspicious login prevented
 *
 * @param  Object page
 * @return Boolean
 */
export const suspicious = async (page, resources) => {
  try {
    const element = await page.waitForSelector(resources.suspicious, {
      timeout: 3000,
    });
    const value = await element.evaluate((el) => el.textContent);

    return !!value && value === resources.suspicious_text;
  } catch (e) {
    return false;
  }
};

/**
 * Check is valid login
 *
 * @param  Object page
 * @return Array
 */
const validLogin = async (page, resources) => {
  return (
    (await hasPasswordField(page, resources)) ||
    (await hasPhoneField(page, resources))
  );
};

/**
 * Check can fill password
 *
 * @param  Object page
 * @return Array
 */
const hasPasswordField = async (page, resources) => {
  try {
    await page.waitForSelector(resources.input_pass, { timeout: 3000 });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Check can fill phone
 *
 * @param  Object page
 * @return Array
 */
const hasPhoneField = async (page, resources) => {
  try {
    await page.waitForSelector(resources.input_phone, {
      timeout: 3000,
    });
    return true;
  } catch (e) {
    return false;
  }
};

main().catch((e) => console.log(e));

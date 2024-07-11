import _ from 'lodash';
import clc from 'cli-color';
import puppeteer from 'puppeteer';
import {
  waitFor,
  getProxyByKey,
  saveLogs,
  readLine,
  loadCommonResources,
  welcomeMsg,
  pickProxyKey,
  pickProxyHost,
} from './utils.js';

/**
 * Main process function
 *
 * @return Void
 */
const main = async () => {
  await welcomeMsg();

  // Load common resources
  const proxyType = process.argv[2]; // Allow values: --https|null
  const resources = await loadCommonResources();
  const isHttpProxy = proxyType === '--https';

  if (_.isEmpty(resources)) {
    return console.log(clc.red('Missing common resources!'));
  }

  const checked = await readLine('checked.txt');
  const emails = (await readLine('emails.txt')).filter(
    (i) => !checked.includes(i),
  );
  const chunks = _.chunk(emails, 10);

  let index = 0;
  for (const chunk of chunks) {
    const {
      key = null,
      host = null,
      username = null,
      password = null,
      resetKey = false,
    } = isHttpProxy ? await pickProxyHost(index) : await pickProxyKey(index);

    await runBatch(chunk, resources, {
      key: isHttpProxy ? null : key,
      host: isHttpProxy ? host : null,
      username: isHttpProxy ? username : null,
      password: isHttpProxy ? password : null,
    });

    // reset or increase index
    if (resetKey) {
      index = 0;
    } else {
      index++;
    }
  }

  return console.log(clc.green('Done!'));
};

/**
 * Perform batch
 *
 * @param String email
 * @return Boolean
 */
const runBatch = async (emails, resources, proxyConfig) => {
  let {
    key = null,
    host = null,
    username = null,
    password = null,
  } = proxyConfig;

  host = _.isEmpty(key) ? host : await getProxyByKey(key);
  console.log(clc.yellow(`Proxy: ${host}`));
  console.log('-----------------------------');

  const promises = emails.map((email) =>
    verifiedEmail(email, resources, {
      host: host,
      username: username,
      password: password,
    }),
  );
  const responses = await Promise.all(promises);

  if (responses.every((i) => i)) return true;

  await waitFor(resources.waitFor);

  return runBatch(emails, resources, proxyConfig);
};

/**
 * Verified email on X
 *
 * @param String email
 * @return Boolean
 */
const verifiedEmail = async (email, resources, proxy = {}) => {
  const options = [
    '--disable-notifications',
    '--no-sandbox',
    '--enable-gpu',
    '--window-size=390,840',
  ];

  const { host = null, username = null, password = null } = proxy;

  if (host) {
    options.push(`--proxy-server=${host}`);
  }

  if (username && password) {
    options.push(`--proxy-auth=${username}:${password}`);
  }

  const browser = await puppeteer.launch({
    headless: 'shell',
    args: options,
    defaultViewport: {
      width: 390,
      height: 840,
    },
  });

  try {
    const page = await browser.newPage();

    if (username && password) {
      await page.authenticate({
        username,
        password,
      });
    }

    await page.setUserAgent(fakeUserAgent());
    await page.goto(resources.verify_url, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
    });

    await page.type(resources.input_email, email);
    await page.keyboard.press('Enter');

    const [isValidLogin, isSuspicious, isAuthenticate] = (
      await Promise.allSettled([
        validLogin(page, resources),
        suspicious(page, resources),
        authenticate(page, resources),
      ])
    ).map((i) => _.get(i, 'value', false));

    if (isSuspicious || isAuthenticate) {
      console.log(clc.red('Suspicious login prevented.'));
      await browser.close();
      return false;
    }

    // Save checked email
    saveLogs(email, 'checked.txt');

    if (!isValidLogin && !isSuspicious) {
      console.log(clc.green(`Email available: ${email}`));
      await browser.close();
      return true;
    }

    await browser.close();
    saveLogs(email, 'output.txt');
    console.log(clc.red(`Email registered: ${email}`));

    return true;
  } catch (e) {
    await browser.close();
    return false;
  }
};

/**
 * Random user agent
 *
 * @return String
 */
const fakeUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_16_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Debian; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  ];

  const randomIndex = Math.floor(Math.random() * userAgents.length);

  return userAgents[randomIndex];
};

/**
 * Suspicious login prevented
 *
 * @param  Object page
 * @return Boolean
 */
const suspicious = async (page, resources) => {
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
 * Check require authenticate
 *
 * @param  Object page
 * @return Boolean
 */
const authenticate = async (page, resources) => {
  try {
    const element = await page.waitForSelector(resources.authenticate, {
      timeout: 3000,
    });
    const value = await element.evaluate((el) => el.textContent);

    return !!value && value === resources.authenticate_text;
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

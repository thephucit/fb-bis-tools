import _ from 'lodash';
import clc from 'cli-color';
import puppeteer from 'puppeteer';
import {
  getProxyByKey,
  readLine,
  loadCommonResources,
  welcomeMsg,
  pickProxyKey,
  safeParseJson,
} from './utils.js';

import { fakeUserAgent, someActionAfterRequest } from './twitter/helpers.js';

/**
 * Main process function
 *
 * @return Void
 */
const main = async () => {
  await welcomeMsg();

  // Load common resources
  const resources = await loadCommonResources();

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
    const { key = null, resetKey = false } = await pickProxyKey(index);

    await runBatch(chunk, resources, key);

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
const runBatch = async (emails, resources, key) => {
  const proxy = await getProxyByKey(key);
  console.log(clc.yellow(`Proxy: ${proxy}`));
  console.log('-----------------------------');

  const promises = emails.map((email) =>
    verifiedEmail(email, resources, proxy),
  );

  await Promise.all(promises);

  return runBatch(emails, resources, key);
};

/**
 * Verified email on X
 *
 * @param String email
 * @return Boolean
 */
const verifiedEmail = async (email, resources, proxy) => {
  const { page, browser } = await buildPage(email, proxy);

  try {
    page.on('request', (request) => request.continue());
    page.on('response', async (res) => {
      const url = res.url();
      const method = res.request().method();
      const postData = safeParseJson(res.request().postData());

      if (url === resources.response_url && method === 'POST') {
        const json = await res.json();
        const reqEmail = _.get(postData, resources.request_email, null);

        if (reqEmail === email) {
          someActionAfterRequest(email, json, resources);
          await browser.close();
        }
      }
    });

    await page.goto(resources.verify_url, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
    });

    await page.type(resources.input_email, email);
    await page.keyboard.press('Enter');

    return true;
  } catch (e) {
    await browser.close();
    return false;
  }
};

/**
 * Build new page
 *
 * @return Page
 */
const buildPage = async (email, proxy) => {
  console.log(clc.yellow(`Checking email: ${email} | proxy: ${proxy}`));

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
    headless: true,
    args: options,
    defaultViewport: {
      width: 390,
      height: 840,
    },
  });

  const page = await browser.newPage();
  await page.setUserAgent(fakeUserAgent());
  await page.setRequestInterception(true);

  return { page, browser };
};

main().catch((e) => console.log(e));

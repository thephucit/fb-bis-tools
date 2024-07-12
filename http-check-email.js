import _ from 'lodash';
import clc from 'cli-color';
import puppeteer from 'puppeteer';
import {
  readLine,
  loadCommonResources,
  welcomeMsg,
  listHttpProxy,
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

  const numberOfEmail = parseInt(process.argv[2] || 10);
  const numberOfProxy = parseInt(process.argv[3] || 1);

  const checked = await readLine('checked.txt');
  const emails = (await readLine('emails.txt')).filter(
    (i) => !checked.includes(i),
  );

  let promises = [];
  let proIndex = 0;
  let countIps = 0;
  const emailChunks = _.chunk(emails, numberOfEmail);
  const proxies = await listHttpProxy();

  for (const chunk of emailChunks) {
    countIps++;

    const proxy = proxies[proIndex % proxies.length];
    promises = [
      ...promises,
      ...chunk.map((email) => verifiedEmail(email, resources, proxy)),
    ];

    if (countIps === numberOfProxy) {
      console.log(`Total checking: ${promises.length} emails`);
      await Promise.all(promises);
      promises = [];
      countIps = 0;
    }

    proIndex++;
  }

  return console.log(clc.green('Done!'));
};

/**
 * Verified email on X
 *
 * @param String email
 * @return Boolean
 */
const verifiedEmail = async (email, resources, proxy = {}) => {
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
    console.log(clc.red(`Failed: ${email} | proxy: ${proxy.host}`));
    return false;
  }
};

/**
 * Build new page
 *
 * @return Page
 */
const buildPage = async (email, proxy) => {
  const { host = null, username = null, password = null } = proxy;
  console.log(clc.yellow(`Checking email: ${email} | proxy: ${host}`));

  const options = [
    '--disable-notifications',
    '--no-sandbox',
    '--enable-gpu',
    '--window-size=390,840',
  ];

  if (host) {
    options.push(`--proxy-server=${host}`);
  }

  if (username && password) {
    options.push(`--proxy-auth=${username}:${password}`);
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

  if (username && password) {
    await page.authenticate({
      username,
      password,
    });
  }

  await page.setUserAgent(fakeUserAgent());
  await page.setRequestInterception(true);

  return { page, browser };
};

main().catch((e) => console.log(e));

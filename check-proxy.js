import _ from 'lodash';
import puppeteer from 'puppeteer';

/**
 * Main function process
 *
 * @return Void
 */
(async () => {
  const proxyServer = 'pr.z76phpxn.lunaproxy.net:12233';
  const username = 'user-lu7384322';
  const password = 'nguyenlen1';

  const options = ['--disable-notifications', `--proxy-server=${proxyServer}`];

  if (!_.isEmpty(username) && !_.isEmpty(password)) {
    options.push(`--proxy-auth=${username}:${password}`);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: options,
  });

  const page = await browser.newPage();

  if (!_.isEmpty(username) && !_.isEmpty(password)) {
    await page.authenticate({
      username,
      password,
    });
  }

  await page.goto('https://ipaddress.my/', {
    waitUntil: ['domcontentloaded', 'networkidle0'],
    // timeout: 100000,
  });
  // await page.goto('https://ipaddress.my/', { waitUntil: 'networkidle0' });
  // await page.screenshot({ path: 'myip.png' });
  // await browser.close();
})();

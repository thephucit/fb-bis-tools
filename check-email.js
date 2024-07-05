import _ from "lodash";
import fs from "fs";
import axios from "axios";
import puppeteer from "puppeteer";
import { promises as fsp } from "fs";
import { waitFor } from "./utils.js";

/**
 * Main process function
 *
 * @return Void
 */
const main = async () => {
  const key = process.argv[2];
  const checked = await listEmails("checked.txt");
  const emails = (await listEmails("emails.txt")).filter(
    (i) => !checked.includes(i),
  );
  const chunks = _.chunk(emails, 10);

  for (const chunk of chunks) {
    await runBatch(chunk, key);
  }

  console.log(`Done!`);
};

/**
 * Perform batch
 *
 * @param String email
 * @return Boolean
 */
const runBatch = async (emails, key) => {
  const proxy = await getProxy(key);
  console.log(`Proxy: ${proxy}`);
  console.log("-----------------------");

  const promises = emails.map((email) => verifiedEmail(email, proxy));
  const responses = await Promise.all(promises);

  if (responses.every((i) => i)) return true;

  await waitFor(10000);

  return runBatch(emails, key);
};

/**
 * Verified email on X
 *
 * @param String email
 * @return Boolean
 */
const verifiedEmail = async (email, proxy) => {
  const options = [
    "--disable-notifications",
    "--no-sandbox",
    "--enable-gpu",
    "--window-size=390,840",
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
    await page.goto("https://x.com/i/flow/login", {
      waitUntil: ["domcontentloaded", "networkidle0"],
    });

    await page.type("input[name='text']", email);
    await page.keyboard.press("Enter");
    const isValidLogin = await validLogin(page);
    const isSuspicious = await suspicious(page);

    if (isSuspicious) {
      console.log("Suspicious login prevented");
      await browser.close();
      return false;
    }

    if (!isValidLogin && !isSuspicious) {
      saveLogs(email, "checked.txt");
      await browser.close();
      return true;
    }

    await browser.close();
    saveLogs(email, "output.txt");
    saveLogs(email, "checked.txt");
    console.log(`Email đã đăng ký: ${email}`);

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
export const suspicious = async (page) => {
  try {
    const element = await page.waitForSelector(
      'button[data-testid="OCF_CallToAction_Button"] > div > span > span',
      { timeout: 3000 },
    );
    const value = await element.evaluate((el) => el.textContent);

    return !!value && value === "Got it";
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
const validLogin = async (page) => {
  return (await hasPasswordField(page)) || (await hasPhoneField(page));
};

/**
 * Check can fill password
 *
 * @param  Object page
 * @return Array
 */
const hasPasswordField = async (page) => {
  try {
    await page.waitForSelector('input[name="password"]', { timeout: 5000 });
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
const hasPhoneField = async (page) => {
  try {
    await page.waitForSelector('input[data-testid="ocfEnterTextTextInput"]', {
      timeout: 5000,
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get proxy
 *
 * @return Array
 */
const getProxy = async (key) => {
  try {
    console.log("Loading new proxy...");
    await changeProxy(key);

    const proxy = await axios.get(`http://api.proxyfb.com/api/getProxy.php`, {
      params: {
        key,
      },
      headers: {
        accept: "application/json",
      },
    });

    if (_.get(proxy, "data.success", false)) {
      return proxy.data.proxy;
    }

    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Change proxy
 *
 * @return Array
 */
const changeProxy = async (key) => {
  try {
    const change = await axios.get(
      `http://api.proxyfb.com/api/changeProxy.php`,
      {
        params: {
          key,
        },
        headers: {
          accept: "application/json",
        },
      },
    );

    if (_.get(change, "data.success", false)) {
      return change.data.proxy;
    }

    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Save logs

 * @type Void
 */
const saveLogs = (email, file) => {
  const createFiles = fs.createWriteStream(`./${file}`, {
    flags: "a",
  });

  return createFiles.write(email + "\r\n");
};

/**
 * Get list emails
 *
 * @return Array
 */
const listEmails = async (file) => {
  try {
    return (await fsp.readFile(file))
      .toString()
      .split("\n")
      .map((i) => i.replace(/(\r\n|\n|\r)/gm, ""))
      .filter((i) => i);
  } catch (e) {
    return [];
  }
};

main().catch((e) => console.log(e));

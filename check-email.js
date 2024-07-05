import _ from "lodash";
import fs from "fs";
import axios from "axios";
import puppeteer from "puppeteer";
import { promises as fsp } from "fs";

/**
 * Main process function
 *
 * @return Void
 */
const main = async () => {
  const key = process.argv[2];
  const emails = await listEmails("emails.txt");
  const checked = await listEmails("checked.txt");
  const proxy = await genProxy(key);
  const chunks = _.chunk(emails, 10);
  console.log(`Proxy: ${proxy}`);

  for (const chunk of chunks) {
    const promises = chunk.map((email) => verifiedEmail(checked, email, proxy));
    await Promise.all(promises);
  }

  console.log(`Done!`);
};

/**
 * Verified email on X
 *
 * @param String email
 * @return Boolean
 */
const verifiedEmail = async (checked, email, proxy) => {
  if (checked.includes(email)) return false; // ignore if email is checked

  saveLogs(email, "checked.txt");

  const options = [
    "--disable-notifications",
    "--no-sandbox",
    "--enable-gpu",
    `--window-size=390,840`,
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
    await page.goto("https://x.com/i/flow/password_reset", {
      waitUntil: ["domcontentloaded", "networkidle0"],
    });

    await page.type("input[name='username']", email);
    await page.keyboard.press("Enter");
    await page.waitForSelector('input[name="text"]', { timeout: 3000 });
    await browser.close();
    saveLogs(email, "output.txt");
    console.log(`Email đã đăng ký: ${email}`);

    return true;
  } catch (e) {
    await browser.close();
    return false;
  }
};

/**
 * Generate proxy
 *
 * @return Array
 */
const genProxy = async (key) => {
  const proxy = await getProxy(key);

  if (!proxy) {
    return await changeProxy(key);
  }

  return proxy;
};

/**
 * Get proxy
 *
 * @return Array
 */
const getProxy = async (key) => {
  try {
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

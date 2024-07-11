import _ from 'lodash';
import fs from 'fs';
import axios from 'axios';
import clc from 'cli-color';
import { promises as fsp } from 'fs';
import { config } from './config.js';

/**
 * Wait For
 *
 * @param ms
 */
export const waitFor = (ms) => {
  console.log(clc.yellow(`Sleeping for ${ms} ms.`));

  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};

/**
 * Load common resources
 *
 * @return Array
 */
export const loadCommonResources = async (key) => {
  try {
    console.log(clc.blue('Loading common resources...'));

    const responses = await axios.post(
      'https://bsocials.net/api/verify-x-email',
      {},
      {
        headers: {
          accept: 'application/json',
          'X-Bsocials-Access-Token': config.bsocials_access_token,
        },
      },
    );

    return _.get(responses, 'data.elements', {});
  } catch (e) {
    return null;
  }
};

/**
 * Pick proxy key
 *
 * @param Number index
 * @return String
 */
export const pickProxyKey = async (index) => {
  const proxies = await readLine('proxies.txt');
  const key = _.get(proxies, `[${index}]`, null);
  const resetKey = index >= proxies.length - 1 ? true : false;

  return { key, resetKey };
};

/**
 * Get proxy
 *
 * @return Array
 */
export const getProxy = async (key) => {
  try {
    console.log(clc.blue('Loading new proxy...'));
    await changeProxy(key);

    const proxy = await axios.get(`http://api.proxyfb.com/api/getProxy.php`, {
      params: {
        key,
      },
      headers: {
        accept: 'application/json',
      },
    });

    if (_.get(proxy, 'data.success', false)) {
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
export const changeProxy = async (key) => {
  try {
    const change = await axios.get(
      `http://api.proxyfb.com/api/changeProxy.php`,
      {
        params: {
          key,
        },
        headers: {
          accept: 'application/json',
        },
      },
    );

    if (_.get(change, 'data.success', false)) {
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
export const saveLogs = (email, file) => {
  const createFiles = fs.createWriteStream(`./${file}`, {
    flags: 'a',
  });

  return createFiles.write(email + '\r\n');
};

/**
 * Get list emails
 *
 * @return Array
 */
export const readLine = async (file) => {
  try {
    return (await fsp.readFile(file))
      .toString()
      .split('\n')
      .map((i) => i.replace(/(\r\n|\n|\r)/gm, ''))
      .filter((i) => i);
  } catch (e) {
    return [];
  }
};

/**
 * Display welcome title
 *
 * @return Array
 */
export const welcomeMsg = async () => {
  const content = (await fsp.readFile('author.txt')).toString();
  return console.log(content);
};

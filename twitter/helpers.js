import _ from 'lodash';
import clc from 'cli-color';
import { saveLogs } from '../utils.js';

/**
 * Random user agent
 *
 * @return String
 */
export const fakeUserAgent = () => {
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
 * Some action after requested
 *
 * @param  Object page
 * @return Boolean
 */
export const someActionAfterRequest = (email, response, resources) => {
  const isValidLogin = validLogin(response, resources);
  const isInvalidLogin = invalidLogin(response);

  if (isValidLogin) {
    saveLogs(email, 'checked.txt');
    saveLogs(email, 'output.txt');
    return console.log(clc.red(`Email registered: ${email}`));
  }

  if (isInvalidLogin) {
    saveLogs(email, 'checked.txt');
    return console.log(clc.green(`Email available: ${email}`));
  }

  // return console.log(clc.red('Suspicious login prevented.'));
};

/**
 * Check is invalid login
 *
 * @param  Object response
 * @return Boolean
 */
export const invalidLogin = (response) => {
  const code = _.get(response, 'errors[0].code', null);
  return code && code == 399;
};

/**
 * Check is valid login
 *
 * @param  Object response
 * @return Boolean
 */
export const validLogin = (response, resources) => {
  const subtask = _.get(response, 'subtasks[0].subtask_id', '');
  return resources.valid_login_msg.includes(subtask);
};

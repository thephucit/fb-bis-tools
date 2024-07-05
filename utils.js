/**
 * Wait For
 *
 * @param ms
 */
export const waitFor = (ms) => {
  console.log(`Sleeping for ${ms} ms.`);
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};

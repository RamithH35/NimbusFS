/**
 * Retries an asynchronous function up to maxAttempts times with exponential backoff.
 * 
 * @param {Function} fn - The asynchronous function to execute
 * @param {number} maxAttempts - Maximum execution attempts (default: 3)
 * @param {number} baseDelayMs - Delay multiplier in milliseconds (default: 200)
 * @returns {Promise<any>}
 */
export async function retryWithBackoff(fn, maxAttempts = 3, baseDelayMs = 200) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed: ${error.message || error}`);
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export default retryWithBackoff;

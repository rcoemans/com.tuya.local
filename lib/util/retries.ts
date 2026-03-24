'use strict';

import { RECONNECT_BASE_DELAY, RECONNECT_MAX_DELAY } from '../tuya/constants';

/** Calculate exponential backoff delay with jitter */
export function getBackoffDelay(attempt: number, baseDelay: number = RECONNECT_BASE_DELAY, maxDelay: number = RECONNECT_MAX_DELAY): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = delay * 0.2 * Math.random();
  return Math.round(delay + jitter);
}

/** Sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

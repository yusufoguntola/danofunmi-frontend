import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// vitest.config.js doesn't set `test.globals: true` (deliberately — see that
// file), so @testing-library/react's own auto-cleanup (which relies on a
// global afterEach) never registers unless done explicitly here. Without
// this, every render() in a file accumulates in document.body across tests.
afterEach(() => {
  cleanup();
});

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// vitest.config's `globals: false` means `afterEach` isn't a global, so
// React Testing Library's own auto-cleanup (which relies on detecting a
// global afterEach) silently never registers. Wiring it explicitly here
// instead — without it, every component test leaks its rendered DOM into
// the next one in the same file.
afterEach(cleanup)

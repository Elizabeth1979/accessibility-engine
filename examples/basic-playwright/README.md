# Example: AEE + an existing Playwright test

The only change to adopt AEE is the import:

```diff
- import { test, expect } from '@playwright/test';
+ import { test, expect } from '@aee/playwright';
```

That gives you an `aee` fixture. Optionally call `aee.checkpoint(name, { intent })`
to declare a page's purpose so the AI judges naming/alt-text in context. Evidence
is collected automatically and a report is written on teardown.

> Scaffold note: `checkpoint()` is currently a no-op; the capture + judging loop
> lands with the walking-skeleton milestone.

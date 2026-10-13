# Agent instructions

Follow these rules on every task in this repository, in addition to doing the task itself. `README.md` has the project structure, how to run it, and the checks to run before a pull request.

## Pull request description

Every pull request description must contain these three sections, with these exact headings, after the summary and before the test plan:

- `## Files changed`
- `## Screenshots`
- `## Docs updated`

Never leave a section out. When one does not apply, keep the heading and say so in one line.

## Files changed

- List every file the pull request adds, modifies, renames or deletes, with a few words on what changed in each.
- Build the list from `git diff --name-status origin/main...HEAD`, not from memory.
- Group it by area: `apps/api`, `apps/client`, `packages/contracts`, `docs`, other.
- Give the same list in your final message when you finish the work.

## Screenshots

A UI change is anything that alters what a user sees: screens in `apps/client/app`, components in `apps/client/features`, or theme tokens. When the pull request contains one, capture the result and embed it in the description. When it contains none, write "No UI changes." under the heading.

### Capture

1. Start the web client with `CI=1 pnpm --filter @ee/client web` and wait for `http://localhost:8081`. Screens behind sign-in also need the api, the database and the demo data: follow "Run it" in `README.md`, including `demo:hyderabad`.
2. In a temporary folder outside the repository, run `npm install playwright-core`. Never add it to a `package.json` here.
3. Capture with a script like this one, which drives the installed Google Chrome:

   ```js
   import { chromium } from 'playwright-core';

   const browser = await chromium.launch({ channel: 'chrome' });
   const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
   await page.goto('http://localhost:8081/sign-in', { waitUntil: 'networkidle', timeout: 120_000 });
   await page.screenshot({ path: 'sign-in-390.png' });
   await browser.close();
   ```

4. For a signed-in screen, first sign in through the `/sign-in` form in the same page, using a demo account from `README.md`. The web session cannot be injected from outside the browser.
5. Capture every changed screen at 390×844. Also capture 1280×800 when the change affects the layout at 768 and wider. Capture each new state the change adds, such as an error or empty state.
6. Open each image and check that it shows the change, not a spinner, a blank page or the sign-in screen.

### Post

1. Save the images as `.artifacts/screenshots/<branch>/<screen>-<width>.png`, where `<branch>` is the branch name with `/` replaced by `-`.
2. Commit only those images with `git add .artifacts/screenshots/<branch>`. Leave everything else in `.artifacts/` uncommitted.
3. Starting the web client can rewrite `apps/client/tsconfig.json` and delete `apps/client/expo-env.d.ts`. Restore both with `git checkout --` before committing, and stop the servers you started.
4. Push, then embed each image under `## Screenshots` with this exact URL form. `<sha>` is the full hash of the pushed commit that contains the image (`git rev-parse HEAD`), and `<owner>/<repo>` comes from `git remote get-url origin`:

   ```md
   ![Supplier fleet, 390 wide](https://github.com/<owner>/<repo>/blob/<sha>/.artifacts/screenshots/<branch>/supplier-fleet-390.png?raw=true)
   ```

   Use the commit hash, not the branch name, so the image survives branch deletion.

### When a capture is not possible

Do not skip it silently. Under `## Screenshots`, name each screen you could not capture, the reason, and what you tried. Only the web build can be captured; say so when a change is specific to iOS or Android.

## Docs updated

When a change adds, removes or alters behaviour, update the documents that describe it in the same pull request.

| What changed                                             | Update                                          |
| -------------------------------------------------------- | ----------------------------------------------- |
| An api route, or a shared schema in `packages/contracts` | `docs/api-reference.md` and `docs/contracts.md` |
| Requests, quotes, bookings or availability               | `docs/rental-flow.md`                           |
| Requirements, matching or notifications                  | `docs/requirements.md`                          |
| Supplier screens or the tracker                          | `docs/supplier-screens.md`                      |
| The equipment assistant or the supplier agent            | `docs/assistants.md`                            |
| Environment variables, Docker, deployment or builds      | `docs/deployment.md`                            |
| A user flow or the demo data                             | `docs/walkthrough.md`                           |
| A feature area, script, folder or document               | `README.md` (its tables and Structure)          |
| Colours, typography, layout or shared components         | `DESIGN.md`                                     |
| Users, scope or product principles                       | `PRODUCT.md`                                    |

- Under `## Docs updated`, list each document you changed and why. If none needed changing, write "No doc changes needed" and the reason. A refactor with no change in behaviour needs no doc update.
- If no document covers a new feature, add one under `docs/` and link it from the Documentation table in `README.md`.
- `docs/knowledge/` is loaded into the supplier agent's knowledge base, so its text is what the in-app assistant tells users. Change it only when the user-facing behaviour it describes changes. Keep each file's front matter and a body of 200 to 500 words. If you add, rename or delete a file there, update `EXPECTED_FILES` in `scripts/check-knowledge.test.mjs`, then run `pnpm test:docs`.

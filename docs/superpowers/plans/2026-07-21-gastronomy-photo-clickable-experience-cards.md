# Gastronomy Photo and Clickable Experience Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the «Вкус гор» imagery with the supplied wine photo and make every available experience card a single accessible link across its full area.

**Architecture:** Keep `experience.astro` server-rendered and JavaScript-free: active cards become semantic anchors while the unavailable card remains an article. Add one optimized local WebP asset and pass its real dimensions through optional `TourLanding` image props so the card, hero, Open Graph, and JSON-LD all use the same canonical image.

**Tech Stack:** Astro 5, Node.js test runner, existing `CldImage` responsive image component, `cwebp`.

## Global Constraints

- Use `/Users/greg/Desktop/IMG_7372.jpeg` as the only new source image.
- Keep the «Кулинарные мастер-классы» coming-soon card on `/images/cooking-class.webp` and non-clickable.
- Keep all current copy, prices, booking forms, Telegram configuration, and unrelated imagery unchanged.
- Do not add client-side JavaScript for card navigation.
- Preserve the existing visual button treatment and add a visible keyboard focus state to linked cards.

---

## File Map

- Create `public/images/gastronomy-wine.webp`: optimized 2000 × 2000 production image.
- Create `tests/experience-cards.test.mjs`: source-level regression tests for the new image and semantic card links.
- Modify `src/components/TourLanding.astro`: accept optional intrinsic image dimensions while retaining current defaults.
- Modify `src/pages/tours-gastronomy.astro`: select the new image and its square dimensions.
- Modify `src/pages/experience.astro`: update gastronomy schema/card imagery and convert active cards to anchors.

### Task 1: Replace the «Вкус гор» image everywhere

**Files:**
- Create: `public/images/gastronomy-wine.webp`
- Create: `tests/experience-cards.test.mjs`
- Modify: `src/components/TourLanding.astro`
- Modify: `src/pages/tours-gastronomy.astro`
- Modify: `src/pages/experience.astro`

**Interfaces:**
- Consumes: `TourLanding`'s existing `image: string` and `imageAlt: string` props.
- Produces: optional `imageWidth?: number` and `imageHeight?: number` props, defaulting to `2400` and `1600`.

- [ ] **Step 1: Write the failing image test**

Create `tests/experience-cards.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const imagePath = '/images/gastronomy-wine.webp';

test('the supplied wine photo represents the gastronomy tour everywhere', () => {
  const experience = read('src/pages/experience.astro');
  const landing = read('src/pages/tours-gastronomy.astro');

  assert.ok(existsSync(join(root, 'public/images/gastronomy-wine.webp')));
  assert.ok(experience.split(imagePath).length - 1 >= 2, 'card and ItemList schema must use the image');
  assert.match(landing, /image="\/images\/gastronomy-wine\.webp"/);
  assert.match(landing, /imageWidth=\{2000\}/);
  assert.match(landing, /imageHeight=\{2000\}/);
  assert.match(experience, /src="\/images\/cooking-class\.webp" alt="Кулинарный мастер-класс/);
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```bash
node --test tests/experience-cards.test.mjs
```

Expected: FAIL because `public/images/gastronomy-wine.webp` does not exist and the source still references `cooking-class.webp` for «Вкус гор».

- [ ] **Step 3: Generate the optimized asset**

Run:

```bash
cwebp -quiet -q 82 -resize 2000 2000 /Users/greg/Desktop/IMG_7372.jpeg -o public/images/gastronomy-wine.webp
```

Verify:

```bash
sips -g pixelWidth -g pixelHeight -g format public/images/gastronomy-wine.webp
```

Expected: `pixelWidth: 2000`, `pixelHeight: 2000`, `format: webp`.

- [ ] **Step 4: Add real intrinsic dimensions to `TourLanding`**

Replace the `Props` interface and Astro props destructuring in `src/components/TourLanding.astro` with:

```astro
interface Props {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  image: string;
  imageAlt: string;
  serviceKey: string;
  serviceName: string;
  priceLabel: string;
  details: Detail[];
  highlights: string[];
  schemaType?: 'TouristTrip' | 'Service';
  offerPrice?: string;
  imageWidth?: number;
  imageHeight?: number;
}

const {
  title,
  description,
  eyebrow,
  heading,
  intro,
  image,
  imageAlt,
  serviceKey,
  serviceName,
  priceLabel,
  details,
  highlights,
  schemaType = 'TouristTrip',
  offerPrice,
  imageWidth = 2400,
  imageHeight = 1600,
} = Astro.props;
```

Use the values in the hero image:

```astro
<CldImage src={image} alt={imageAlt} width={imageWidth} height={imageHeight} sizes="100vw" priority />
```

- [ ] **Step 5: Point the gastronomy landing and experience hub to the new image**

In `src/pages/tours-gastronomy.astro`, set:

```astro
image="/images/gastronomy-wine.webp"
imageAlt="Бокал красного вина во время гастрономической экскурсии в Трамонти"
imageWidth={2000}
imageHeight={2000}
```

In `src/pages/experience.astro`, change the gastronomy `ItemList` image to:

```js
"image": `${SITE}/images/gastronomy-wine.webp`,
```

Change only the «Вкус гор» card image to:

```astro
<CldImage src="/images/gastronomy-wine.webp" alt="Бокал местного вина на гастрономической экскурсии в Трамонти" width={2000} height={2000} sizes="(max-width: 768px) 100vw, 33vw" />
```

- [ ] **Step 6: Run the focused test and commit**

Run:

```bash
node --test tests/experience-cards.test.mjs
```

Expected: PASS.

Commit:

```bash
git add public/images/gastronomy-wine.webp tests/experience-cards.test.mjs src/components/TourLanding.astro src/pages/tours-gastronomy.astro src/pages/experience.astro
git commit -m "feat: update gastronomy tour photography"
```

### Task 2: Make active experience cards semantic full-card links

**Files:**
- Modify: `tests/experience-cards.test.mjs`
- Modify: `src/pages/experience.astro`

**Interfaces:**
- Consumes: the five existing destination routes `/tours-car`, `/tours-boat`, `/tours-vespa`, `/tours-gastronomy`, and `/photos`.
- Produces: five `<a class="experience-card reveal" href="…">` cards and one unchanged `<article class="experience-card reveal coming-soon">`.

- [ ] **Step 1: Add the failing semantic-link test**

Append to `tests/experience-cards.test.mjs`:

```js
test('available experience cards are single full-card links', () => {
  const experience = read('src/pages/experience.astro');
  const routes = ['/tours-car', '/tours-boat', '/tours-vespa', '/tours-gastronomy', '/photos'];

  for (const route of routes) {
    assert.match(experience, new RegExp(`<a class="experience-card reveal" href="${route}"`));
    assert.doesNotMatch(experience, new RegExp(`<a href="${route}" class="btn btn-primary"`));
  }

  assert.match(experience, /<article class="experience-card reveal coming-soon">/);
  assert.match(experience, /\.experience-card:focus-visible/);
  assert.doesNotMatch(experience, /onclick=/);
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```bash
node --test tests/experience-cards.test.mjs
```

Expected: FAIL because the active cards are still `<article>` elements with nested button links.

- [ ] **Step 3: Convert each active card to one anchor**

Use these exact opening tags for the five available cards in `src/pages/experience.astro`:

```astro
<a class="experience-card reveal" href="/tours-car" aria-label="Подробнее: На машине по побережью">
<a class="experience-card reveal" href="/tours-boat" aria-label="Подробнее: На катере">
<a class="experience-card reveal" href="/tours-vespa" aria-label="Подробнее: На мотоцикле">
<a class="experience-card reveal" href="/tours-gastronomy" aria-label="Подробнее: Вкус гор">
<a class="experience-card reveal" href="/photos" aria-label="Подробнее: Фотосессии">
```

Replace their five closing `</article>` tags with `</a>`. Replace only the five inner CTA anchors with these spans, in the same order:

```astro
<span class="btn btn-primary" aria-hidden="true">Узнать больше</span>
<span class="btn btn-primary" aria-hidden="true">Подробнее</span>
<span class="btn btn-primary" aria-hidden="true">Подробнее</span>
<span class="btn btn-primary" aria-hidden="true">Подробнее</span>
<span class="btn btn-primary" aria-hidden="true">Подробнее</span>
```

All header, image, body, price, and footer containers remain byte-for-byte unchanged. Do not alter the coming-soon `<article>` or its disabled button.

- [ ] **Step 4: Preserve appearance and add keyboard focus**

Add to the `.experience-card` rule:

```css
color: inherit;
text-decoration: none;
```

Add after that rule:

```css
.experience-card:focus-visible {
  outline: 4px solid var(--color-orange);
  outline-offset: 4px;
}
```

- [ ] **Step 5: Run the focused and full test suites, then commit**

Run:

```bash
node --test tests/experience-cards.test.mjs
node --test tests/*.test.mjs
```

Expected: both commands PASS.

Commit:

```bash
git add tests/experience-cards.test.mjs src/pages/experience.astro
git commit -m "feat: make experience cards fully clickable"
```

### Task 3: Build, inspect, publish, and verify production

**Files:**
- Verify only; no new source files expected.

**Interfaces:**
- Consumes: the completed image and linked-card changes from Tasks 1 and 2.
- Produces: a validated production build and deployed `main` revision.

- [ ] **Step 1: Run final local verification**

Run:

```bash
git diff --check
node --test tests/*.test.mjs
npm run build
git status --short
```

Expected: no whitespace errors, all tests PASS, build succeeds, and only intentional generated/ignored files exist.

- [ ] **Step 2: Inspect the generated pages**

Run:

```bash
rg -n 'gastronomy-wine|experience-card reveal' dist/experience/index.html dist/tours-gastronomy/index.html
```

Expected: both pages reference `gastronomy-wine`; the experience page contains the five destination links.

- [ ] **Step 3: Push `main` and deploy using the repository script**

Push first, wait for the GitHub-triggered rebuild to release the deploy lock, then run the full deployment from the new revision:

```bash
git push origin main
ssh sweden 'set -eu; while ! flock -n /tmp/atraniru-deploy.lock -c true; do sleep 1; done; cd /srv/atraniru; git pull --ff-only origin main; ./deploy.sh'
```

Expected: the server builds 419 or more pages, reports 227 or more sitemap URLs, waits for webhook readiness, and finishes with `Deployment complete`.

- [ ] **Step 4: Verify the public result without submitting a booking**

Run:

```bash
curl --fail --head https://atrani.ru/images/gastronomy-wine.webp
curl --fail --silent https://atrani.ru/experience | rg 'gastronomy-wine|href="/tours-gastronomy"'
curl --fail --silent https://atrani.ru/tours-gastronomy | rg 'gastronomy-wine'
ssh sweden 'systemctl is-active atraniru-webhook caddy && curl --fail --silent http://127.0.0.1:13103/webhook/health'
```

Expected: image and pages return success, the expected markup is present, both services are active, and health returns `{"status":"ok","rebuilding":false}`.

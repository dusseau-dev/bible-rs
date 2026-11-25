# Passage Selection and Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository's AGENTS.md requires sequential main-thread work, so use inline execution.

**Goal:** Replace the web reader's selection menu with the Scholarly folio flow: Ask, Explain, Simplify, sourced Go deeper tabs, and direct-then-related forum stories.

**Architecture:** Keep verse selection and existing actions in the reader app state. Add a focused selection toolbar and quick-action popover; adapt the existing study panel into a docked folio. Extend `/api/study` with a validated reading path and link-only forum metadata, keeping generated claims and forum results separate.

**Tech Stack:** Svelte 5, SvelteKit 3, TypeScript, Vitest, headless isolated Playwright, existing Web Bible core, existing OpenAI/Exa/YouTube integrations.

## Global Constraints

- One study request covers one chapter and at most 30 verses; the server accepts same-origin JSON only.
- The selected phrase from a non-WEB translation stays client-side; API evidence is labeled World English Bible.
- OpenAI keys stay in tab memory and never enter storage or URLs.
- Forum cards contain metadata and outbound links only; no copied post bodies or forum content in model prompts.
- Direct forum matches precede reviewed related-theme matches; weak matches are omitted.
- Christ links require attributable Scripture evidence; mark thematic links as thematic and leave unsupported steps empty.
- Preserve existing highlight, note, bookmark, copy, share, compare, parallel, right-click, touch, and keyboard behavior.
- Browser QA uses local headless Playwright with a fresh isolated context; do not use personal Chrome.

---

## File map

| File | Responsibility |
| --- | --- |
| `site/src/lib/read/study.ts` | Request/response and reading-path/testimonial contracts. |
| `site/src/lib/server/study/guide.ts` | Guide step labels, validation, curated NT cross-references. |
| `site/src/lib/server/study/community.ts` | Reviewed forum links, Exa discovery, strict host/relevance filtering. |
| `site/src/lib/server/study/answer.ts` | Structured generation and source-ID validation for guide/quick answers. |
| `site/src/routes/api/study/+server.ts` | Study modes and evidence aggregation. |
| `site/src/lib/read/overlays/VerseMenu.svelte` | Existing action list, repurposed as toolbar overflow menu. |
| `site/src/lib/read/overlays/SelectionToolbar.svelte` | Anchored primary actions and overflow state. |
| `site/src/lib/read/overlays/QuickStudy.svelte` | Ask composer, Explain, Simplify cards. |
| `site/src/lib/read/overlays/StudyPanel.svelte` | Responsive docked folio, reading path, four evidence tabs. |
| `site/src/lib/read/app.svelte.ts`, `Shell.svelte`, `reader/Reader.svelte` | State, action routing, selection opening, overlay lifecycle. |
| `site/src/lib/server/study/*.test.ts` | Validation, relevance, citation, and API behavior. |

### Task 1: Study contracts and reading-path validation

**Files:** Modify `site/src/lib/read/study.ts`; create `site/src/lib/server/study/guide.ts` and `guide.test.ts`.

**Interfaces:** Produce `StudyStepId = 'observe' | 'contextualize' | 'trace' | 'christ' | 'apply'`; `StudyGuideStep = { id: StudyStepId; question: string; answer: string | null; sourceIds: string[]; connection?: 'explicit' | 'allusion' | 'theme' }`; `StudyTestimonial = { id; title; author; url; scope: 'direct' | 'related'; theme?: string }`. Add `guide: StudyGuideStep[]` and `testimonials: StudyTestimonial[]` to `StudyResult`. Add request mode `'explain'` alongside `'open' | 'ask'`, with existing `style` controlling standard/simple output.

- [ ] **Step 1: Write `guide.test.ts`** with a fixed five-step ID order, missing-evidence answer `null`, unknown source ID removal, and rejection of a Christ answer without a valid Scripture source. Example assertion:

```ts
expect(buildGuide([], []).map((step) => step.id)).toEqual(['observe', 'contextualize', 'trace', 'christ', 'apply']);
expect(buildGuide([], []).every((step) => step.answer === null)).toBe(true);
```

- [ ] **Step 2: Run** `cd site && npx vitest run src/lib/server/study/guide.test.ts`; expect red because `guide.ts` does not exist.
- [ ] **Step 3: Add** the exact contracts above. Implement `buildGuide(generated, sources)` so it returns all five fixed prompts, truncates answers to 450 characters, retains only known source IDs, and sets `answer: null` when no valid citation remains. For `christ`, require one cited Scripture source outside the selected passage or a reviewed source that explicitly names the NT cross-reference; set `connection` from the validated enum only.
- [ ] **Step 4: Run** the focused test and `npm run check` from `site`; expect green. Commit the three files as `Define study guide and testimonial contracts`.

### Task 2: Forum discovery with a reviewed seed

**Files:** Create `site/src/lib/server/study/community.ts` and `community.test.ts`; modify `site/src/lib/server/study/limits.ts` only if the current discovery limit cannot be reused.

**Interfaces:** `reviewedTestimonials(p: StudyPassage): StudyTestimonial[]`; `discoverTestimonials(p: StudyPassage, apiKey: string): Promise<StudyTestimonial[]>`; `mergeTestimonials(reviewed, discovered): StudyTestimonial[]`.

- [ ] **Step 1: Write tests** for Genesis 3:7 returning the reviewed Crosswalk story as `related`, an unrelated passage returning none, direct-before-related sorting, canonical URL deduplication, and rejecting off-domain, non-HTTPS, debate, prayer request, and unverified first-person search hits. Test an Exa failure returning the reviewed list at the route integration layer.
- [ ] **Step 2: Run** `cd site && npx vitest run src/lib/server/study/community.test.ts`; expect red.
- [ ] **Step 3: Implement** a fixed `forums.crosswalk.com` allowlist; exact-reference search first, then reviewed themes only for overlapping Genesis 3:7–21 (shame, covering, forgiveness). Send `type: 'lite'`, `numResults: 6`, and `includeDomains: ['forums.crosswalk.com']` to Exa with the same 8-second timeout used by `research.ts`. Return title, canonical URL, public author alias, and scope; never return `text` or `highlights`. Seed the reviewed link `https://forums.crosswalk.com/t/my-testimony-march-2026/17499` for Genesis 3:7–21. If a search hit cannot be verified as a first-person account from metadata, omit it.
- [ ] **Step 4: Run** focused test and check; expect green. Commit as `Add link-only forum discovery`.

### Task 3: Structured API and model output

**Files:** Modify `site/src/lib/server/study/answer.ts`, `answer.test.ts`, `evidence.ts`, `site/src/routes/api/study/+server.ts`; add `site/src/routes/api/study/server.test.ts` if route tests are supported by the current Vitest setup.

**Interfaces:** `generateStudy(...)` returns `{ claims, answer, guide }`; response always contains `guide` and `testimonials`; `mode: 'explain'` returns a short sourced explanation, while `style: 'simple'` uses everyday words and keeps the same evidentiary limits.

- [ ] **Step 1: Add tests** showing guide claims drop invented source IDs, an uncited Christ step becomes empty, no key returns prompt-only guide, Exa outage retains local results, and forum metadata does not appear in the OpenAI request body. Include an API test for invalid modes and 31-verse ranges.
- [ ] **Step 2: Run** `cd site && npx vitest run src/lib/server/study/answer.test.ts src/lib/server/study/evidence.test.ts`; expect new assertions red.
- [ ] **Step 3: Extend** the JSON schema and validation in `answer.ts` to return guide entries with fixed IDs and source IDs. Add a small reviewed WEB cross-reference source for the Genesis 3 reading path, linked to its actual NT chapter; do not add a generic Christ source to every passage. Teach the prompt the five-step method and explicit/allusion/theme labels. Assemble forum metadata separately in the route after local evidence; use existing `allowDiscovery(client)` and fail open to reviewed links when Exa fails. Keep the current question, key, body-length, and origin checks.
- [ ] **Step 4: Run** focused tests, `npm run check`, and `npm test`; expect green. Commit as `Return sourced reading path and forum links`.

### Task 4: Selection toolbar and preserved actions

**Files:** Create `site/src/lib/read/overlays/SelectionToolbar.svelte`; modify `VerseMenu.svelte`, `HighlightBar.svelte`, `Shell.svelte`, `app.svelte.ts`, and `reader/Reader.svelte`.

**Interfaces:** State `selectionAction: 'ask' | 'explain' | 'simplify' | null`; `verseMenu` remains the anchor for desktop and touch toolbar. `goDeeper` continues to set `studyPassage`. The overflow delegates to the existing `app.dispatch` actions.

- [ ] **Step 1: Add a browser interaction check** that drag selection opens a toolbar with Ask/Explain/Simplify, overflow includes the old actions, Escape closes it, and right-click/touch still open the same actions. Assert a selected highlight color remains pressed.
- [ ] **Step 2: Run** the check against the current reader; expect red for the new toolbar controls.
- [ ] **Step 3: Implement** the toolbar anchored to `app.reader?.selectionRect()` with point fallback for right-click. Use the existing `Popover`/`Menu` focus and viewport positioning behavior. Route Ask/Explain/Simplify to `selectionAction`, overflow to a restyled `VerseMenu`, and note/highlight to existing dispatch. Remove the competing touch-only `HighlightBar` once touch exposes all toolbar controls. Close the popup on clear selection, navigation, outside click, and Escape; retain `heldWords` behavior while interacting with the toolbar.
- [ ] **Step 4: Run** browser interaction check and `npm run check`; expect green. Commit as `Unify selected-text actions in scholarly toolbar`.

### Task 5: Quick Ask, Explain, and Simplify

**Files:** Create `site/src/lib/read/overlays/QuickStudy.svelte`; modify `Shell.svelte`, `app.svelte.ts`, and `StudyPanel.svelte` only to share tab-memory API key state through one module-scoped helper.

**Interfaces:** Props are `passage: StudyPassage`, `mode: 'ask' | 'explain' | 'simplify'`, and `onclose`. `QuickStudy` posts to `/api/study` with `mode: 'ask'` for a question or `mode: 'explain'` for Explain/Simplify, with `style: 'simple'` for Simplify.

- [ ] **Step 1: Add a browser check** for the composer suggestions, editable question, key-needed state, source links, standard/simple switch, and stale-response abort when selection changes. A mocked `/api/study` response must show an answer only for its matching passage.
- [ ] **Step 2: Run** the check; expect red.
- [ ] **Step 3: Implement** the pale anchored composer and answer card. The Sources control opens an explanation of the current evidence set; it does not trigger unrestricted web search. Reuse one tab-memory key between the card and folio. Increment a request token and abort the previous controller on every passage/mode change; render a response only if its token matches. Keep the original reader text visible and label the explanation as WEB-based.
- [ ] **Step 4: Run** browser check and `npm run check`; expect green. Commit as `Add sourced Ask and quick explanations`.

### Task 6: Docked Scholarly folio

**Files:** Modify `site/src/lib/read/overlays/StudyPanel.svelte`, `site/src/lib/read/Shell.svelte`, and focused stylesheet if the panel styling exceeds the component's current size.

**Interfaces:** Tabs are `'history' | 'academic' | 'testimonials' | 'videos'`; retain `Tradition | 'all'` as a filter within Academic. `StudyPanel` reads the same `StudyResult` and keeps follow-up Ask inside the panel.

- [ ] **Step 1: Add browser checks** for four tab labels, the fixed five-step path, citation links, direct-before-related testimonials, unverified-video wording, scroll preservation, Escape/focus return, and a 390×844 bottom-sheet layout.
- [ ] **Step 2: Run** the checks; expect red against the current modal study panel.
- [ ] **Step 3: Replace** the centered `Sheet` composition with a right-docked nonmodal folio and mobile bottom sheet. Keep the text column visible and the panel's scroll independent. Render the five-step path above four tabs; put history, original-language and attributed scholarship, link-only forum cards, and videos in their respective tabs. Show the existing OpenAI key disclosure, follow-up composer, empty states, tradition filter, loading, and error notices. Use the chosen mockup's light surface, navy toolbar, jade selection guide, restrained rules, and serif reading typography.
- [ ] **Step 4: Run** browser checks, `npm run check`, and `npm test`; expect green. Commit as `Build responsive scholarly study folio`.

### Task 7: Final verification and documentation

**Files:** Modify `site/README.md` and `LICENSES/README.md` only for any new reviewed link provenance; update targeted tests where final QA exposes a real gap.

- [ ] **Step 1: Run** `cd site && npm run check && npm test && npm run build`. Expect zero errors and a successful build.
- [ ] **Step 2: Run isolated headless Playwright** for desktop and 390×844 mobile: selection drag, right-click, touch, all preserved menu actions, Ask key-needed and mocked success/failure, Explain/Simplify, four tabs, forum direct/related order, and keyboard focus. Save screenshots under `.context/` only for actual visual failures or final review artifacts.
- [ ] **Step 3: Inspect** DOM snapshot, console, and network for stale requests, key exposure, and unexpected external requests. Resolve concrete failures, then rerun only the affected checks.
- [ ] **Step 4: Document** Crosswalk link-only metadata, Exa optional discovery, reviewed Genesis seed, five-step method, and the WEB/current-translation distinction. Commit documentation and any final fixes as `Document scholarly passage study`.

## Self-review mapping

- Entry/selection and preserved actions: Task 4.
- Ask/Explain/Simplify and key/error behavior: Tasks 3 and 5.
- Reading path, four tabs, citations, and Christ guardrails: Tasks 1, 3, and 6.
- Direct/related testimonials and forum rights: Tasks 2, 3, and 6.
- Responsive, keyboard, focus, and final QA: Tasks 4, 6, and 7.

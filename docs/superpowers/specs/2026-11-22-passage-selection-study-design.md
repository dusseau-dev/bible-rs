# Passage selection and study design

**Status:** Approved for implementation

**Date:** 2026-11-22
**Visual direction:** Scholarly folio (mockup 2)

## Goal

Let a reader select words or verses and move from a quick explanation to a sourced study without losing the passage. The interface uses a light, quiet reading surface, a compact dark selection toolbar, a pale Ask composer, and a right-hand folio for deeper research. The experience teaches a text-driven reading path: **Observe → Contextualize → Trace → Connect to Christ → Apply**.

## Entry and selection

- Mouse text selection opens the toolbar beside the selection on release. Existing right-click and touch selection paths open the same actions. A verse selection without selected words uses the full selected verse range.
- The toolbar contains **Ask**, **Explain**, **Simplify**, an overflow button, highlight control, and note control. It stays within the viewport, moves above or below the selection as space requires, and closes on Escape, outside click, navigation, or a new selection.
- The overflow menu retains the reader's current actions: six highlight colors and clear, add/edit note, bookmark, Go deeper, Copy, Copy with Reference, Share as Image, Compare Translations, Open in Parallel, and the current verse-range hint. Existing keyboard shortcuts remain.
- The toolbar and menu show the current highlight and bookmark/note state. All actions still operate on the selected words when supported, otherwise the selected verses.
- The selected phrase shown in the interface comes from the current translation and stays client-side. The study request sends only the validated book/chapter/verse range. Sourced study text is labeled **World English Bible**, so the reader can distinguish it from an imported or different selected translation.

## Quick actions

**Ask** opens a pale composer anchored to the selection. It starts with “Ask about this passage” and three suggested questions: “Why this detail?”, “Where is this echoed?”, and “How does this point to Christ?” Clicking a suggestion fills the input; the reader can edit before sending. A visible Sources control explains that answers use the study evidence, not unrestricted web search. The answer appears in a compact card with citations and a route into Go deeper.

**Explain** opens a concise card for the selected passage. It separates observation, original context, and a possible Christ connection. The Christ connection names a New Testament link when one exists; otherwise it is labeled a thematic reading. The card links to Go deeper for evidence and disagreement.

**Simplify** opens a short plain-language explanation beside the original text. It simplifies the explanation, never replaces or rewrites the Bible text. It does not add an interpretation unsupported by the standard explanation. Readers can switch between Explain and Simplify without a new selection.

Ask, Explain, and Simplify use the existing `/api/study` evidence and the existing user-supplied OpenAI key flow. If the key is absent or rejected, the card explains what is needed and offers the sourced, non-AI Go deeper view. Keys remain in tab memory and are never written to storage or shown in the URL. Loading, failure, and retry states preserve the selection and question.

## Go deeper folio

Go deeper opens a right-hand folio connected visually to the selected text with a subtle green underline/guide. The header shows the passage reference and a short selected-text quotation. The main reading column remains visible and retains its scroll position. The folio scrolls independently and can close without clearing the selection. On narrow screens it becomes a bottom sheet with the same content and controls.

The folio begins with a compact, expandable **Reading path**. Each step is a question and, when generated evidence is available, a short, source-aware answer. Without an API key or adequate evidence, the questions remain useful prompts and no answer is fabricated:

1. **Observe:** What details, repetitions, contrasts, structure, or word choices does the text actually contain?
2. **Contextualize:** What would the passage mean in its immediate literary and historical setting, and to its first readers? This precedes personal application.
3. **Trace:** What patterns or echoes occur elsewhere in Scripture, and do later biblical writers use this passage? Distinguish explicit citation, plausible allusion, and broad theme.
4. **Connect to Christ:** Does a documented promise, pattern, contrast, or need find fulfillment in Jesus? Identify the textual basis; do not turn every detail into a formal type.
5. **Apply:** What response of faith, repentance, or hope follows in light of the gospel? Avoid a moral-only takeaway.

The Genesis 3 fig-leaf example is a model for the prompts, not a fixed answer imposed on every passage. In particular, “fig leaves → barren fig tree” and “skins → sacrifice” are potential thematic proposals, not direct claims of Genesis 3 or explicit New Testament citations. The UI labels them accordingly and allows uncertainty or no Christ link when the evidence is thin.

Four evidence tabs sit below the Reading path. Switching tabs retains the current passage and scrolls the tab content to its start. Tabs have keyboard-accessible controls and meaningful empty states.

| Tab | Content |
| --- | --- |
| **History** | Passage and paragraph, setting and first-reader context, and historical claims only when a linked source supports them. |
| **Academic** | Attributed scholarship, original-language notes, interpretive differences, tradition filters, and an explicit evidence/uncertainty section. A lexical gloss never determines meaning by itself. |
| **Testimonials** | First-person public forum stories. Posts that explicitly mention the selected reference appear first as **Direct passage**; stories matching a reviewed theme appear second as **Related theme**. Stories are personal experience, not evidence of the passage's meaning. |
| **Videos** | Reviewed videos with direct coverage first and related topics second. Show title, channel, and scope; do not claim to verify what a speaker says in the video. |

A follow-up Ask input stays available at the bottom of the folio. Answers cite only the evidence available for the current passage and say when it is insufficient.

## Testimonials source and treatment

The initial public forum is [Christian Forums at Crosswalk](https://forums.crosswalk.com/). The discovery path is server-side, domain-restricted, bounded, and rate-limited. It searches for the exact reference first, then for reviewed passage themes; it does not accept arbitrary user URLs. The provider returns metadata only: title, canonical URL, public author name when available, and matching scope. The panel links to the original post to read the story in full. It does not copy post bodies or ask the AI to summarize them, because [Crosswalk's terms](https://forums.crosswalk.com/tos) grant reuse rights to its operator but do not state a third-party republication license.

Theme matching requires a reviewed passage-to-theme mapping. Start with passages covered by that mapping; do not infer a theme merely from a generic forum search hit. If no reviewed theme exists, show exact-reference results only. A candidate must be a first-person account rather than a debate, sermon, prayer request, or quoted third-party story. Exclude posts exposing private details or describing acute crises. Show no card when the match cannot be verified. This favors trustworthy sparse coverage over weak matches.

The forum search uses the project's existing Exa discovery key and shared discovery limit. A reviewed local manifest supplies the first related example for Genesis 3:7–21 (themes: shame, covering, forgiveness): [“My Testimony, March 2026”](https://forums.crosswalk.com/t/my-testimony-march-2026/17499), linked without its body text. Without Exa, only reviewed manifest links appear; all other passages show “No community stories found for this passage yet.” A selected range must overlap the manifest's reviewed range to use its themes. No forum content enters the AI evidence prompt.

## Data and implementation boundaries

- Keep selection state and popup placement in the reader UI. Reuse existing action dispatch and selection/mark APIs instead of duplicating highlight, notes, bookmark, copy, and comparison behavior.
- Extend the existing study response with a structured Reading path and testimonial metadata. Treat each step as optional when evidence is insufficient. Source IDs remain the only citation references for generated claims. New Testament cross-references used for the Christ step must be supplied as attributable Scripture evidence; the model cannot create an uncited connection from its own memory.
- Keep forum discovery separate from academic/commentary discovery and from video verification. Validate URLs against a fixed host list, cap result count, deduplicate canonical URLs, and never render forum HTML.
- Preserve the current request limits: one chapter, at most 30 verses, same-origin JSON request, and bounded question/key lengths. Handle aborted requests and selection changes so an old answer cannot overwrite a new selection.
- Preserve the existing source and tradition distinctions. The reading framework shapes questions and labeling; it does not erase scholarly disagreement or present theological interpretation as historical fact.

## Responsive and accessibility behavior

- Desktop: the folio docks to the right without obscuring the active text column. Ask/Explain/Simplify cards stay near the selection but flip or constrain to fit the viewport.
- Small screens: the toolbar becomes a compact wrapping row; the folio becomes a bottom sheet. Touch targets meet the app's size conventions, and the keyboard can reach every action.
- The menu and folio have clear labels, visible focus, Escape handling, and focus return to the reader. The four tabs expose selected state to assistive technology. Selection color is not the sole cue for active state.
- External links state their destination and open safely. Empty, loading, error, key-needed, and no-evidence states use plain language and retain the passage context.

## Acceptance checks

1. Selecting words by drag, selecting a verse, right-clicking, and touch selection each expose the correct toolbar and preserve the existing actions.
2. Ask, Explain, and Simplify stay anchored to the chosen passage; a new selection or aborted request cannot show a stale answer.
3. Go deeper opens the Scholarly folio with the five-step reading path, four tabs, and cited claims. Thin evidence produces an honest empty or uncertainty state.
4. Testimonials show direct matches before related matches, use only reviewed first-person forum links, and never display copied body text.
5. Desktop and mobile layouts, keyboard navigation, focus return, screen-reader labels, and reduced-motion behavior work in isolated headless browser QA.
6. Existing study API validation, source citation checks, and reader selection behavior remain covered by targeted tests.

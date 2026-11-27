# Passage discoveries — approved design

Date: 2026-11-27
Status: approved by the user on 2026-11-27 after review of the linked design draft.

The approved draft is preserved below; only this title and approval status have changed.

## Confirmed direction

The reader selects a passage and receives 3–5 concise discoveries, each expandable into a 900–1,200-word lesson. The target is unfamiliar, well-supported context that materially changes how someone reads that passage. Evidence and explanatory value take precedence over novelty. Three is not a minimum quota: fewer findings are appropriate when support is thin.

Alternatives considered: one complete lesson per selection offers a continuous argument but imposes a large reading commitment; concise notes alone are easy to browse but leave inadequate room for evidence and disagreement. The user selected expandable discoveries.

## Reading experience

Keep the existing passage-selection toolbar and Go deeper panel. Opening research shows a visible research status followed by a reviewed list. Each discovery has a specific title, an approximately 80–120-word explanation including the interpretive payoff, inline citations, its existing category, and a Read the full lesson button. The title's premise must be supported independently of the explanation.

The 3–5 target applies across the passage, not to each category. Existing History, Related, Academic and Reflection filters remain useful ways to find discoveries; none requires a quota. In All, discoveries appear before a collapsed Further reading group. Papers, forum links and videos remain available as supporting resources and through their existing filters; they do not inflate the discovery count. Category counts retain clearly defined meanings: discovery counts for interpretive categories and resource counts for resource categories. All displays separate discovery/resource counts rather than conflating them.

Read the full lesson expands the selected discovery inline. Only one lesson is expanded at a time, keeping the list navigable on phones. Keep the selected passage and a collapse control available; collapse returns focus and scroll to the discovery. Completed lessons and their scroll positions remain available in panel state when switching discoveries. Keyboard users can expand, follow citations and collapse without losing their place. Existing themes, touch targets and safe-area behavior carry through.

Generate a full lesson only on first expansion. Reopening a completed lesson uses the same verified result; it does not spend another inference request. Changing the selected passage cancels outstanding browser requests and prevents late results from appearing under the new selection.

## Lesson and editorial contract

Use the user's sequence: discovery, passage, evidence, disagreement, payoff, and a reading exercise containing 2–4 passages and three questions. Develop setting and people within the explanation where relevant, rather than forcing separate encyclopedia entries into every lesson. The word target applies to teaching prose, excluding source lists and image credits.

Setting explains conditions that affect the passage: place, institutions, economics, social obligations, practical constraints, and the beliefs or expectations of relevant groups. Distinguish the narrated period from the text's composition, later testimony and modern discovery dates. Poetry and visions need literary setting; they should not acquire invented physical scenery.

Characters are described through their stated actions/desires, attributed narrative characterization, and clearly labeled historical inference about their pressures or incentives. Do not invent interior thoughts, dialogue, mood, weather, flaws or motives. A scholarly interpretation of a character is attributed, not converted into a biographical fact.

Every lesson explicitly identifies the detail that readers should now read differently and explains why. Define unfamiliar terms. Present the strongest credible alternative when retrieved evidence supports one; when none was found, state that limitation without inventing a debate or claiming unanimity. Treat Jewish and Christian perspectives respectfully. Connections to Jesus require a relevant textual basis and distinguish explicit citation, proposed allusion and broader theological interpretation.

## Research and evidence

Use a bounded research sequence: examine the selected text and immediate context; identify promising historical, literary, linguistic or manuscript questions; search specialist scholarship and appropriate primary records; consult public discussions for common misunderstandings; check news for directly relevant research; then select distinct findings with a clear payoff.

Broaden the current six-domain discovery configuration to reviewed scholarly, museum, university, excavation and publication sources. A site's inclusion permits discovery, not automatic trust in every claim. Trace popular articles and news to the underlying research when possible. Multiple summaries of one paper are not independent corroboration. Forum questions may guide the lesson, but forum answers cannot establish historical claims. Preserve the existing link-only treatment of forum content where reuse rights are absent. Never imply that a search ran when its provider was disabled or failed.

Retrieve sufficient permitted evidence for the actual claims. A paper title or metadata record cannot support conclusions about its findings; an abstract can support only what it actually states. Unavailable full texts remain further-reading links. Record source identity, author, document location, date, available supporting excerpt, evidence scope and reuse information. Support citations at the material-claim level, not merely as a bibliography attached to an entire lesson.

Discovery selection and long-form teaching use separate prompt contracts. The first selects a few supported, distinct ideas; the second develops one selected idea using the user's lesson structure. Both receive retrieved evidence as untrusted data. Retain and extend the current source-ID validation and evidence review to titles, factual claims, interpretive labels, captions and diagram connections. Citation presence alone is not proof that a claim follows from the source.

## Visuals

Each publishable full lesson includes one explanatory visual: a relationship map, timeline, literary structure, geographical map or quantitative chart. Use numerical charts only for meaningful sourced data with units and uncertainty. Every visual includes a plain-language explanation, supporting citations, accessible text, and a statement of its limits. Arrows must identify their meaning; association must not be drawn as causation or direct textual dependence.

Relevant artifact photographs, manuscript images or excavation plans may supplement that visual. Require a verified source, credit/reuse basis, date/provenance when available, useful caption and alt text. Clearly identify reconstructions and later artwork. If a suitable image cannot be used, keep the evidence-based diagram and source link. Do not fabricate an artifact illustration and present it as documentation.

Render diagrams from validated structured data using application-controlled templates. Retrieved pages and model output cannot supply executable HTML, arbitrary SVG or code. Remote image failures leave captions and source links usable.

## Application boundaries and operation

Extend the existing study flow rather than creating an autonomous research platform. The discovery response supplies stable IDs, passage/evidence versions, concise findings, citations and research status. An authenticated lesson request identifies one server-issued discovery. The server resolves its evidence and rejects client-authored source packs or IDs belonging to another passage.

Keep research collection, discovery selection, lesson composition/review, and visual rendering as bounded responsibilities within the existing study modules and folio components. Additive response fields preserve current Ask, Explain, local evidence and older response handling. A separate lesson request avoids placing five long generations inside the initial study request.

Reuse durable provider budgets and require permission for each paid provider call, including review calls; do not silently raise existing limits. Set finite retrieval and generation deadlines. Cache only validated results, scoped to the authenticated owner and keyed by passage, discovery, evidence and prompt versions. Retain current no-store HTTP and service-worker privacy behavior; generated private lessons are not added to offline browser caches. Bound duplicate in-flight requests so repeated taps do not multiply paid work.

When research or review fails, retain supported findings and readable sources. Distinguish incomplete searches, unavailable research and completed searches with no matches. If expansion lacks enough evidence for a supported lesson, retain the concise discovery and explain the limitation instead of padding to 900 words. Retry affects the failed lesson, not the whole passage list.

## Acceptance checks

1. Distinct discoveries include a supported hook, explicit passage connection, citations and payoff; weak evidence produces fewer findings.
2. Expansion yields one coherent lesson with the requested structure, reading exercise and visual, or an honest evidence/unavailability state.
3. Unsupported titles, fabricated motives, forum-derived historical claims, metadata-derived paper conclusions, invalid citations and unsupported visual relationships are rejected.
4. Source reuse rights and image provenance are visible where needed; a failed image does not break reading.
5. Repeated expansion reuses validated content; changing passages or racing requests cannot display stale lessons. Provider limits and authentication remain enforced.
6. Desktop and phone Chromium plus WebKit cover expansion/collapse, focus restoration, citations, long prose, accessible visuals, overflow, themes and partial failures using isolated test contexts.
7. Editorial review uses varied cases: a historical narrative, a literary/language insight, a disputed manuscript or interpretation, and an evidence-poor selection. Review asks whether the evidence actually supports the explanation and whether its payoff changes the reading; schema checks alone cannot establish quality.

## Scope

This iteration covers discovery-led passage study and on-demand lessons, including supporting visuals and images. It does not add a general web browser, user accounts, personalized knowledge scoring, a social feed, video transcription, offline private lessons or mandatory current-events connections.

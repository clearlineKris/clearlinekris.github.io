# Intelligence Rollout (IR) — Content Structure

## Why This Directory Exists

No existing IR directory was present in the repository. This `ir/` directory was created as the smallest sensible content structure to house ClearLine's state-level Intelligence Rollout packages — the deliverable document suite described in [Issue #18](https://github.com/clearlineKris/clearlinekris.github.io/issues/18) and [Issue #19](https://github.com/clearlineKris/clearlinekris.github.io/issues/19).

The structure is designed to:
- Mirror the per-state model described in Issue #18 (each state gets its own subdirectory)
- Support the two-variant Compliance Guide format (White-Ops / Grey-Ops) from Issue #19
- Integrate with the existing site's style without redesigning anything
- Keep template scaffolding clearly separated from Colorado-specific placeholder content

## Directory Layout

```
ir/
├── README.md                 ← You are here
├── ir-styles.css             ← Supplemental styles for IR pages (extends main site CSS)
├── index.html                ← IR section landing page
└── colorado/
    ├── index.html                          ← Colorado IR package overview
    ├── compliance-guide-white-ops.html     ← [PRIORITY] White-Ops Compliance Guide outline
    ├── compliance-guide-grey-ops.html      ← [PRIORITY] Grey-Ops Compliance Guide outline
    ├── penumbrant-papers.md                ← Outline placeholder
    ├── working-class-exhaustive.md         ← Outline placeholder
    ├── reg-pol-volume.md                   ← Outline placeholder
    ├── margin-notes.md                     ← Outline placeholder
    ├── field-problems.md                   ← Outline placeholder
    ├── lotl-stack.md                       ← Outline placeholder
    └── lil-lotl.md                         ← Outline placeholder
```

## Document Types (from Issue #18)

| Document | Status | Format | Description |
|----------|--------|--------|-------------|
| **Compliance Guide (White-Ops)** | Outline complete | HTML | Licensed operator guidance — regulations, tables, actionable steps |
| **Compliance Guide (Grey-Ops)** | Outline complete | HTML | Unlicensed-but-compliant operator guidance — risk-aware, practical |
| Penumbrant Papers & One-Pager | Outline placeholder | Markdown | Deep-dive analysis of gray-area enforcement patterns |
| Working Class Exhaustive | Outline placeholder | Markdown | Comprehensive operational compliance reference |
| Reg & Pol Volume | Outline placeholder | Markdown | Regulatory and policy compendium |
| Margin Notes | Outline placeholder | Markdown | Observations from the edges — enforcement discretion insights |
| Field Problems (fmr. Field Notes) | Outline placeholder | Markdown | Real-world compliance issues encountered in the field |
| Letter of the Law Stack (LOTL) | Outline placeholder | Markdown | Full statutory/regulatory text reference stack |
| Lil LOTL | Outline placeholder | Markdown | Condensed LOTL companion reference |

## Content Labels

All content uses these labels to indicate maturity:

- **`[TEMPLATE]`** — Reusable structure not tied to any state; safe to copy for new states
- **`[CO-PLACEHOLDER]`** — Colorado-specific outline with placeholder content requiring human input
- **`[CO-DRAFT]`** — Colorado-specific content in draft form (not yet present)

## Adding a New State

1. Create `ir/<state-abbreviation-lowercase>/` (e.g., `ir/minnesota/`)
2. Copy the Colorado HTML compliance guides as starting templates
3. Replace `[CO-PLACEHOLDER]` content with state-specific material
4. Create markdown outline files for the remaining document types
5. Add the state to `ir/index.html`

## Gaps Requiring Human Input

- **Compliance Guide content**: Outlines contain structural scaffolding and section headings but need real regulatory citations, tables, and guidance text from a subject-matter expert
- **Grey-Ops risk thresholds**: The Grey-Ops guide outline flags areas where legal risk assessment is needed — these require domain expertise to populate
- **Remaining IR documents**: Only outline-level placeholders exist; full outlines need SME authoring
- **Navigation integration**: The main site (`index.html`) does not yet link to the IR section — this is intentional per the "Coming Soon" status, but will need a link when ready
- **Document versioning**: No version tracking beyond git history; consider adding version metadata if documents will be shared externally

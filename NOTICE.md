# Notices

This file documents third-party names, marks, and references that appear in iThread and in its
upstream project, MindMap Studio. iThread is a derivative work based on MindMap Studio and preserves
the upstream Apache-2.0 licence, copyright notices, book licence, and attribution.

## Trademark notice — iThoughts

"iThoughts" is a trademark or product name belonging to its respective owner. iThread is an
independent open-source project and is not affiliated with, endorsed by, sponsored by, or a
continuation of the original iThoughts product. References to iThoughts and `.itmz` are nominative
and describe file-format interoperability and keyboard-workflow compatibility only.

## Trademark notice — MindManager

"MindManager" is a trademark of Corel Corporation (and/or its predecessors and
successors in interest, including Mindjet). MindMap Studio is an independent,
open-source project. There is **no affiliation, endorsement, sponsorship, or
partnership** between MindMap Studio and the owner of the MindManager trademark.

Every reference to "MindManager" in this repository is **nominative** — used
only to identify the third-party product to which MindMap Studio relates by
interoperability, comparison, or factual reference. Specifically:

- **File format interoperability.** MindMap Studio can read MindManager `.mmap`
  files. This one-way importer was implemented from the publicly distributed
  MindManager XML Schema (the bundled XSD), for the purpose of letting users
  bring existing maps into MindMap Studio. Interoperability of this kind is
  recognized as a legitimate use of a trademark to identify the format being
  interoperated with.

- **Comparative reference.** MindMap Studio's documentation describes the project
  as "a MindManager replacement" — a local-first, open alternative. That phrasing
  is comparative product positioning, not a claim of affiliation.

Users who hold the MindManager trademark or its associated rights and who believe
any specific reference in this repository exceeds nominative use are invited to
contact the project maintainer via the repository's issue tracker; we will revise
the language in good faith.

## Trademark notice — "Mind Map" / the Buzan Organisation

"Mind Map" and "Mind Mapping" are associated with, and claimed as marks by, the
Buzan Organisation in some jurisdictions. MindMap Studio uses the term "mind map"
**descriptively**, to name the radiant, node-and-branch diagram type the tool
produces — the ordinary generic meaning of the phrase. No affiliation with, or
endorsement by, the Buzan Organisation is implied.

## Trademark notice — other third-party products

Other product and format names appearing in MindMap Studio's documentation —
including but not limited to **XMind**, **FreeMind**, **Freeplane**, **Coggle**,
**Miro**, **Microsoft OneNote**, **Microsoft Word / PowerPoint / Project**,
**OPML**, and **Markdown** — are the trademarks or marks of their respective
owners. Their use in this repository is nominative or comparative; no affiliation
or endorsement is implied.

## Open-source dependencies

MindMap Studio's production runtime depends on third-party open-source software,
including **@xyflow/react** (React Flow — the canvas renderer, MIT), **d3-hierarchy**
(tree / radial layout, ISC), **fast-xml-parser** (`.mmap`/OPML parsing), **fflate**
(compression for `.mmap`), **idb** (IndexedDB wrapper), and **React** /
**React-DOM**. Each dependency carries its own license; the full list and license
texts are produced by the package manager's manifest (`package.json` +
`pnpm-lock.yaml`).

## MindMap Studio's own license

MindMap Studio is dual-licensed across two distinct artefacts in this repository:

- **The software** — all source code (`src/`, `test/`, `scripts/`, build
  configuration, etc.) — is licensed under the **Apache License 2.0**. See
  [`LICENSE`](LICENSE) in the repository root for the full text. Permissive: free
  for use, modification, and redistribution (including commercial use) with
  attribution and a patent grant.

- **The book** — the practitioner guide in [`docs/guide/`](docs/guide/),
  including the assembled EPUB and PDF artefacts — is licensed under **Creative
  Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**. See
  [`LICENSE-BOOK`](LICENSE-BOOK) in the repository root for the full text and
  scope. Free for non-commercial use with attribution; commercial use (paid
  courses, paid consulting deliverables, paid republishing) requires prior written
  permission from the author.

Both licenses apply only to the original work of the MindMap Studio project.
Third-party trademarks and third-party authors' work referenced in the book remain
the property of their respective owners; see the trademark notices above and the
**Scope of this license** section of `LICENSE-BOOK` for the boundary.

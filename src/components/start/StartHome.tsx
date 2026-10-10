import { t } from "../../i18n/registry";
import "./messages";
import { useState } from "react";
import { EXAMPLE_DESCRIPTIONS, buildExample } from "../../exampleBuilders";
import { examples } from "../../examples";
import { TEMPLATE_DESCRIPTIONS, buildTemplate, templates } from "../../templates";
import { AppTips } from "./AppTips";
import { CaptureCard } from "./CaptureCard";
import { MapCard } from "./MapCard";
import { TemplateCard } from "./TemplateCard";
import { blankDoc, outlineDoc, topicDoc } from "./docBuilders";
import { handleMapAction } from "./mapActions";
import type { StartContext } from "./types";
import { useLibrary } from "./useLibrary";

// The default "Start" section: capture hero + "pick up where you left off" (3 most-recent maps) +
// a curated set of starter templates / worked examples + "Learn the app" tips. Recent hides when empty.

// Hand-picked featured sets (vs a positional slice) so the home surface always leads with the most
// broadly useful starters, regardless of definition order. Falls back gracefully if an id is missing.
const FEATURED_TEMPLATES = ["brainstorm", "swot", "project", "five-whys"];
const FEATURED_EXAMPLES = ["launch", "okrs", "retro", "runbook"];

// Takes the BUILDER as an argument rather than reading a `build` off each entry: the example index is
// now id+name only, so that its bodies can stay out of the entry chunk (see src/examples.ts).
function pick<T extends { id: string; name: string }>(
  all: T[],
  ids: string[],
  descriptions: Record<string, string>,
  build: (id: string) => import("../../model/types").MindMapDoc,
) {
  return ids
    .map((id) => all.find((x) => x.id === id))
    .filter((x): x is T => !!x)
    .map((x) => ({ id: x.id, name: x.name, description: descriptions[x.id], doc: build(x.id) }));
}

export function StartHome({ ctx }: { ctx: StartContext }) {
  const recent = [...useLibrary(ctx.libraryRev)]
    .sort((a, b) => {
      // Pinned maps lead "pick up where you left off" so a curated map is always one click away.
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    })
    .slice(0, 3);
  const featured = pick(templates, FEATURED_TEMPLATES, TEMPLATE_DESCRIPTIONS, buildTemplate);
  const featuredExamples = pick(examples, FEATURED_EXAMPLES, EXAMPLE_DESCRIPTIONS, buildExample);
  const [newHereDismissed, setNewHereDismissed] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  return (
    <div className="st-content">
      {ctx.showNewHere && !newHereDismissed ? (
        <div className="st-newhere" role="note">
          <div>
            <strong>{t("start.newHere")}</strong>{" "}
            {touch ? t("start.captureAThoughtBelowThen") : t("start.captureAThoughtBelowThen2")}
          </div>
          <div className="st-newhere-actions">
            <button
              type="button"
              className="st-new st-empty-new"
              onClick={() => ctx.onOpen(blankDoc())}
            >
              <span aria-hidden="true">＋</span> {t("start.startYourOwn")}
            </button>
            <button
              type="button"
              className="st-newhere-x"
              aria-label={t("start.dismiss")}
              onClick={() => setNewHereDismissed(true)}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <CaptureCard
        onTopic={(text) => ctx.onOpen(topicDoc(text))}
        onPaste={(text) => {
          const d = outlineDoc(text);
          if (d) ctx.onOpen(d);
        }}
        onBlank={(layout) => ctx.onOpen(blankDoc(), layout)}
      />

      {recent.length > 0 ? (
        <section>
          <div className="st-row">
            <h2 className="st-section-title">{t("start.pickUpWhereYouLeft")}</h2>
            <button type="button" className="st-link" onClick={() => ctx.go("all")}>
              {t("start.viewAllMaps")}
            </button>
          </div>
          <div className="st-grid" style={{ marginTop: 12 }}>
            {recent.map((e) => (
              <MapCard key={e.id} entry={e} onAction={(a, en) => handleMapAction(a, en, ctx)} />
            ))}
          </div>
        </section>
      ) : null}

      <fieldset className="st-tabs" aria-label={t("start.templateLibrary")}>
        <button
          type="button"
          className="st-tab"
          aria-pressed={!showExamples}
          onClick={() => setShowExamples(false)}
        >
          {t("start.structureTemplates")}
        </button>
        <button
          type="button"
          className="st-tab"
          aria-pressed={showExamples}
          onClick={() => setShowExamples(true)}
        >
          {t("start.workedExamples")}
        </button>
      </fieldset>
      {!showExamples && (
        <section>
          <div className="st-row">
            <h2 className="st-section-title">{t("start.startFromATemplate")}</h2>
            <button type="button" className="st-link" onClick={() => ctx.go("templates")}>
              {t("start.browseAllTemplates")}
            </button>
          </div>
          <div className="st-grid" style={{ marginTop: 12 }}>
            {featured.map((t) => (
              <TemplateCard
                key={t.id}
                name={t.name}
                description={t.description}
                doc={t.doc}
                seed={t.id}
                onOpen={() => ctx.onOpen(buildTemplate(t.id))}
              />
            ))}
          </div>
        </section>
      )}

      {showExamples && (
        <section>
          <div className="st-row">
            <h2 className="st-section-title">{t("start.orOpenAWorkedExample")}</h2>
            <button type="button" className="st-link" onClick={() => ctx.go("examples")}>
              {t("start.browseAllExamples")}
            </button>
          </div>
          <div className="st-grid" style={{ marginTop: 12 }}>
            {featuredExamples.map((e) => (
              <TemplateCard
                key={e.id}
                name={e.name}
                description={e.description}
                doc={e.doc}
                seed={e.id}
                onOpen={() => ctx.onOpen(buildExample(e.id))}
              />
            ))}
          </div>
        </section>
      )}

      <AppTips onOpenCommandPalette={ctx.openCommandPalette} />
    </div>
  );
}

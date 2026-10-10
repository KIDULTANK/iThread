import { t } from "../../../i18n/registry";
import "../messages";
import { useState } from "react";
import { EXAMPLE_DESCRIPTIONS, buildExample } from "../../../exampleBuilders";
import { examples } from "../../../examples";
import { TemplateCard } from "../TemplateCard";
import { branchLabels } from "../nodeStats";
import type { StartContext } from "../types";

// Data-driven from examples.ts: a card for every worked example — complete, pre-filled maps that show
// the tool off across domains and features (the same set as the editor's New-map "Examples" group).
// Mirrors the Templates section; adding an example makes a card appear with no extra work. Searchable.

export function Examples({ ctx }: { ctx: StartContext }) {
  const [q, setQ] = useState("");
  const built = examples.map((e) => ({
    id: e.id,
    name: e.name,
    description: EXAMPLE_DESCRIPTIONS[e.id],
    doc: buildExample(e.id),
  }));
  const query = q.trim().toLowerCase();
  const shown = query
    ? built.filter((e) =>
        `${e.name} ${e.description ?? ""} ${branchLabels(e.doc).join(" ")}`
          .toLowerCase()
          .includes(query),
      )
    : built;

  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("start.workedExamples")}</h2>
        <p className="st-section-sub">{t("start.examplesExplain", { n: built.length })}</p>
      </section>
      <input
        className="st-input"
        placeholder={t("start.searchExamples")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {shown.length === 0 ? (
        <div className="st-empty">{t("start.noExamplesMatch", { query: q })}</div>
      ) : (
        <div className="st-grid">
          {shown.map((e) => (
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
      )}
    </div>
  );
}

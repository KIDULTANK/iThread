import { t } from "../../../i18n/registry";
import "../messages";
import { useState } from "react";
import { TEMPLATE_DESCRIPTIONS, buildTemplate, templates } from "../../../templates";
import { TemplateCard } from "../TemplateCard";
import { branchLabels } from "../nodeStats";
import type { StartContext } from "../types";

// Data-driven from templates.ts: a card for every non-blank template, with computed node counts +
// branch pills. Adding a template makes a card appear with zero extra work. Searchable.

export function Templates({ ctx }: { ctx: StartContext }) {
  const [q, setQ] = useState("");
  const built = templates
    .filter((t) => t.id !== "blank")
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: TEMPLATE_DESCRIPTIONS[t.id],
      doc: t.build(),
    }));
  const query = q.trim().toLowerCase();
  const shown = query
    ? built.filter((t) =>
        `${t.name} ${t.description ?? ""} ${branchLabels(t.doc).join(" ")}`
          .toLowerCase()
          .includes(query),
      )
    : built;

  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("start.structureTemplates")}</h2>
        <p className="st-section-sub">{t("start.templatesBlurb", { n: built.length })}</p>
      </section>
      <input
        className="st-input"
        placeholder={t("start.searchTemplates")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {shown.length === 0 ? (
        <div className="st-empty">{t("start.noTemplatesMatch", { query: q })}</div>
      ) : (
        <div className="st-grid">
          {shown.map((t) => (
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
      )}
    </div>
  );
}

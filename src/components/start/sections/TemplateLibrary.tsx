import { t } from "../../../i18n/registry";
import "../messages";
import type { StartContext } from "../types";
import { Examples } from "./Examples";
import { Templates } from "./Templates";

export function TemplateLibrary({
  ctx,
  examples = false,
}: { ctx: StartContext; examples?: boolean }) {
  return (
    <>
      <div className="st-library-intro">
        <p className="st-section-sub">{t("start.libraryBlurb")}</p>
        <fieldset className="st-tabs" aria-label={t("start.templateLibrary")}>
          <button
            type="button"
            className="st-tab"
            aria-pressed={!examples}
            onClick={() => ctx.go("templates")}
          >
            {t("start.structureTemplates")}
          </button>
          <button
            type="button"
            className="st-tab"
            aria-pressed={examples}
            onClick={() => ctx.go("examples")}
          >
            {t("start.workedExamples")}
          </button>
        </fieldset>
      </div>
      {examples ? <Examples ctx={ctx} /> : <Templates ctx={ctx} />}
    </>
  );
}

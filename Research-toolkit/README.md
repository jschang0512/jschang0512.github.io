# Research Toolkit

Browser-based figure tools for research papers. Everything runs in the browser — files are never uploaded.

| Tool | Folder |
|---|---|
| PRISMA 2020 flow diagram | `prismaflow/` |
| Cohort patient-selection flowchart | `cohortflow/` |
| Cohort study timeline (study design diagram), edited in the form or directly on the figure: several segments per row, text boxes, arrows, brackets, custom types and a legend | `timeline/` |
| Figure DPI & format converter | `figureconvert/` |
| Forest plot | `forestplot/` |
| E-value calculator (unmeasured confounding) | `evalue/` |
| Effect sizes & sample size: sample size, NNT/NNH, OR → RR, SE from a CI | `effectsize/` |
| Submission & project tracker: projects with IRB / data milestones, submission rounds, reviewer comments and response letters (account needed; sign-up by invite code; its own Supabase project) | `submissions/` |
| Causal diagram (DAG) with back-door path check | `dag/` |
| Treatment pathway Sankey diagram | `sankey/` |
| Exposure definition diagram | `exposure/` |
| Multi-panel figure composer | `panels/` |
| RoB 2 risk-of-bias plots and tables | `rob2/` |
| ROBINS-I V2 risk-of-bias plots and tables | `robinsi/` |
| Code list builder: ICD-10-CM, ICD-9-CM diagnoses and procedures, ATC and Taiwan NHI drug codes in groups, ICD-9-CM ↔ ICD-10-CM mapping (GEMs), ready-made Charlson and Elixhauser groups (Quan 2005), with a Word appendix table, CSV and SAS / R / Stata / SQL / Python selection code | `codelist/` |
| Taiwan drug lookup: NHI drug list (price, price history, reimbursement rules, ATC, price groups) joined with TFDA drug licences; results can be listed by price group, and each item shows where its price sits in its group | `drugs/` |

Interface in Traditional Chinese and English, in a light or dark theme that follows the system or is set with the button beside the language switch. Figures export to PNG, TIFF, JPG, PDF, SVG, editable Word and PowerPoint (a 16:9 slide of native, editable shapes plus a slide with the figure as a picture).

The figure tools open figure-first: the settings column stays hidden until Settings is pressed, quick menus above the figure hold the most-used settings, and text boxes, arrows and brackets can be added and dragged on any figure, and clicking a box, title, axis label or study name opens its fields beside the figure (shared/figedit.js). Each tool also keeps named versions of its figure, previews colour-blind and black-and-white readability, drafts a figure legend, and can send its figure to the multi-panel composer. Exports offer publisher presets (Elsevier, Springer, Nature, BMC, PLOS, JAMA Network, Wiley, BMJ). The toolkit works offline once visited and can be installed as an app. Each tool shows a few tips on first use, saves automatically (shown in the toolbar), keeps its export options folded under Advanced, and has keyboard shortcuts (press ? to list them) and a search box in its settings column.

## Notes

- Cite the reporting guideline or assessment tool you followed (PRISMA 2020, Schneeweiss et al. 2019, RoB 2, ROBINS-I V2), not this toolkit. Full references are listed on each page.
- PRISMA 2020 flow diagram templates are licensed CC BY 4.0. RoB 2 and ROBINS-I are © their authors, licensed CC BY-NC-ND 4.0 (riskofbias.info); this toolkit records judgements and draws plots only and does not reproduce their signalling questions.
- Example data are fictional.
- Drug data (`drugs/`, `codelist/`): NHI drug list (NHIA) and all drug licences (TFDA), Open Government Data License, Taiwan v1.0. `.github/workflows/tw-drugs.yml` rebuilds them weekly with `.github/scripts/tw-drugs.mjs` into the branch `tw-drugs-data`, which the pages read from raw.githubusercontent.com. Each source is downloaded on its own and one that cannot be reached keeps last week's data; because the NHI site may refuse GitHub's servers, `.github/scripts/tw-drugs-local.sh` runs the same build on a computer in Taiwan and pushes to the same branch. ICD codes and ATC class names come from the US National Library of Medicine (Clinical Tables, RxNav); search terms typed into the code list builder are sent there. Names of ICD-10-CM category and subcategory codes (`codelist/icd10cm-heads.json`) come from the CDC ICD-10-CM tabular order file; rebuild it yearly with `.github/scripts/icd10cm-heads.mjs` and bump its `?v=`. ICD-9-CM names (`codelist/icd9-heads.json`) come from the CDC FY2012 tabular lists via `.github/scripts/icd9-heads.mjs` (ICD-9-CM is frozen, so this never needs rerunning). The ICD-9-CM ↔ ICD-10-CM mapping (`codelist/icd-gems.json`) is the CMS / CDC 2018 diagnosis GEMs, the final release, built once by `.github/scripts/icd-gems.mjs`. The Charlson and Elixhauser groups (`codelist/comorbidity.json`) are the Quan 2005 ICD-9-CM and ICD-10 code lists, checked against the R package comorbidity. The drug lookup also shows TFDA appearance data with photos, leaflet and carton links, and the full text of the NHI reimbursement rules, which `.github/scripts/tw-drug-rules.mjs` extracts from the NHIA PDFs each week (only new or revised ones). Pages load the licences behind reimbursed codes first (`fda-paid.json`) and the rest on request, and keep each parsed data file in IndexedDB under its data version, so a second visit skips download and parsing.
- Testing: `.github/workflows/toolkit-smoke.yml` opens the home page and every tool in headless Chromium after each push that touches `Research-toolkit/`, loads each example and fails on script errors, missing files or an example that draws nothing (`.github/scripts/toolkit-smoke.mjs`; run it locally against a served copy with `BASE=http://localhost:8765 CHANNEL=msedge`).
- Third-party libraries (loaded from CDNs): pdf.js, docx-preview (Apache-2.0); jsPDF, svg2pdf.js, html2canvas, UTIF.js (MIT); JSZip (MIT or GPL-3.0).

## Developer

張家菘 — questions, bug reports and suggestions: [js.chang0512@gmail.com](mailto:js.chang0512@gmail.com)

Version: v3.12 (2026-11-24)

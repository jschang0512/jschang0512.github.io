# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner is Chia-Sung (Bruce) Chang: a licensed pharmacist (R.Ph.) working at Taipei Medical University Hospital, and an M.Sc. student in Clinical Medicine at Taipei Medical University. His research covers pharmacoepidemiology and real-world evidence.

Two public audiences carry equal weight:

- **Academic reviewers.** Supervisors, graduate-program committees, prospective employers and potential collaborators. They visit to judge credibility, and their path runs through the CV, publications and blog.
- **Researchers who use the tools.** They usually arrive from search with a task in hand, such as drawing a PRISMA or cohort flow diagram, a robvis-style RoB 2 or ROBINS-I plot, a study timeline or a target-trial specification table, converting a figure's DPI, or following the NMA tutorial. The CV is secondary for them.

There are also private audiences. These areas are internal, noindex, and not a design priority:

- **Trip pages:** the owner and his travel companions.
- **menu:** the owner's bookmarks.
- **Pharmacy (調劑台複習):** the owner's own review tool for dispensing work.

## Product Purpose

The site is one person's academic home plus a set of free working tools.

Success over the next one to two years means four things:

- The CV is convincing enough for further study or a research post.
- People get in touch to collaborate after seeing the research or the tools.
- The Research Toolkit and the NMA tutorial get real use and are cited in papers' methods sections.
- The personal tools (pharmacy review, trip pages, splitbill) work smoothly in daily use.

## Positioning

The research tools are built by a working pharmacoepidemiology researcher for the figures and tables that journals actually ask for. Four things set them apart:

- **Nothing is uploaded.** Every tool runs entirely in the browser.
- **Editable Word export.** Each tool exports an editable Word file alongside the image formats.
- **Current guidance.** The risk-of-bias tools track the official versions, including ROBINS-I V2 (2025-11-20 draft) with its archived variants.
- **A guided NMA tutorial.** It walks through a Bayesian network meta-analysis step by step in R (multinma). Shared settings, such as outcome names, are defined once up front.

## Operating Context

- **Hosting.** GitHub Pages, legacy Jekyll build from `main`.
- **Which parts use Jekyll.** Only `personalcv/` uses Jekyll templates; the other apps are static files.
- **CV content.** It lives in `_data/cv.json` and is edited through Pages CMS (`.pages.yml`). `personalcv/content.json` is generated from it.
- **Languages.** The CV is trilingual (中文 / English / 日本語). The Research Toolkit is bilingual (中文 / English).
- **Blog.** It lives at `personalcv/blog/`, with scheduled publishing via GitHub Actions.
- **Trip pages.** They share one engine in `trip/engine/`. Each trip is `schedule.html` + `data.js` + `theme.css`, and new trips start from `trip/_template/`.
- **Pharmacy.** It is an installable PWA used on a phone during dispensing work.
- **splitbill.** A public tool for splitting trip expenses.

## Capabilities and Constraints

- **splitbill:** must keep working exactly as it does. Do not modify it.
- **404 page:** shows only the requested URL, with no links to other pages.
- **Site root:** shows the 404 page. It must not auto-redirect to `personalcv/`.
- **NMA tutorial:** must not link to the bookmarks page (`menu/`).
- **Research Toolkit developer card:** carries no link to the personal site.
- **Private pages:** trip pages, `menu/` and Pharmacy stay noindex.
- **Trip pages:** must keep their localStorage keys (`<key>-theme`, `<key>-packing-v1`), or saved checklists are lost.
- **Risk-of-bias tools:** use only domain names and judgement categories. The official signalling questions live in the official tools and are not reproduced.
- **Pharmacy content:** a review aid, not clinical advice. Any calculator added there must say so.
- **Toolkit libraries:** external libraries (pdf.js, docx-preview, jsPDF, JSZip) load from a CDN only when needed.

## Brand Commitments

- **Name:** the owner's name appears as 張家菘 / Chia-Sung (Bruce) Chang.

## Evidence on Hand

- **CV data:** education, experience, publications, honors and research directions in `_data/cv.json`.
- **Photo:** the profile photo in `personalcv/media/profile/`.
- **Tools:** seven working Toolkit tools plus the NMA tutorial.
- **Not available:** the blog has no published posts yet. There are no testimonials, usage statistics, citation counts or download numbers. Do not fabricate any of these.

## Product Principles

1. **Credibility comes from real work.** The publications, tools and tutorial are the proof, so show them plainly and never pad them with invented metrics.
2. **Tools are for finishing the task.** Someone arriving from search should get from landing to an exported, journal-ready figure without needing the CV.
3. **Keep data private.** Research inputs never leave the browser, and the site says so where it matters.
4. **Public and private stay separate.** Personal pages work well for their few users but never compete with the public CV and tools for attention or search visibility.
5. **Match current guidance.** Research tools follow the latest official reporting and risk-of-bias guidance and say which version they implement.

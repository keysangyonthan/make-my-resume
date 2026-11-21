# Make My Resume — free resume builder

A form-on-the-left, live-preview-on-the-right resume builder. Users sign in with Google,
their resumes autosave to their account, and they export print-quality, multi-page PDFs.

- **Landing page** with a single "Sign in / Get started" call to action
- **Google sign-in** (Firebase Auth) — resumes saved per user in Firestore
- **Editor**: Google-Forms-style cards on the left, live preview on the right, autosave
- **5 templates**: Modern, Classic, Concise (fits more on one page), Spacious, Sidebar
- **Accent colors**, **A4 / US Letter**, reorder or hide sections
- **Export PDF**: real, selectable text (ATS-friendly); pages break exactly as shown in the preview
- **Mobile**: Edit / Preview tabs

> **Rename the product** in `src/config.js` (and the `<title>` in `index.html`).

---

## 1. Run it locally (2 minutes)

You need [Node.js 18+](https://nodejs.org).

```bash
cd resume-builder
npm install
npm run dev
```

Open http://localhost:5173. With no Firebase keys the app runs in **demo mode**:
no sign-in, resumes are saved in your browser. Everything else works.

## 2. Turn on Google sign-in (Firebase, free tier)

1. Go to https://console.firebase.google.com → **Add project** (Google Analytics optional).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** → Save.
3. **Build → Firestore Database → Create database** → choose a region (e.g. `asia-south1` for India) → start in **production mode**.
4. **Firestore → Rules**: paste the contents of `firestore.rules` from this project → **Publish**.
   (Only the signed-in owner can read/write their resumes.)
5. **Project settings (gear) → Your apps → Web (`</>`)** → register an app → copy the config values.
6. In the project folder: `cp .env.example .env.local` and paste the values in.
7. Restart `npm run dev`. The "Sign in" button now opens Google sign-in.

## 3. Deploy (Firebase Hosting — free)

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick the project you created
npm run build
firebase deploy               # deploys the site + Firestore rules
```

Then in **Authentication → Settings → Authorized domains**, make sure your live domain
(e.g. `your-project.web.app` or your custom domain) is listed.

**Vercel** also works: import the GitHub repo at vercel.com/new and click Deploy — `vercel.json`
already sets the build and the page rewrites. Add the `VITE_FIREBASE_*` variables under
Project → Settings → Environment Variables, redeploy, and add your `*.vercel.app` domain to
Firebase → Authentication → Settings → Authorized domains.

---

## How it's built

| Piece | Where |
| --- | --- |
| Product name | `src/config.js` |
| Landing page | `src/pages/Landing.jsx` |
| Dashboard (list / create / duplicate / delete) | `src/pages/Dashboard.jsx` |
| Editor (form, design drawer, autosave, export) | `src/pages/Editor.jsx` |
| Templates (markup) | `src/templates/index.jsx` |
| Templates (styles) | `src/styles/resume.css` |
| Pagination + print | `src/components/ResumePages.jsx` |
| Auth (Google / demo) | `src/lib/auth.jsx` |
| Data (Firestore / localStorage) | `src/lib/store.js` |

**Pagination.** Each resume is broken into small blocks (header, section title, each job
heading, each bullet). Blocks are measured off-screen and packed onto fixed-size pages;
section titles and job headings are never left alone at the bottom of a page. The preview
and the exported PDF use the same pages, so what you see is what you get.

**PDF export** uses the browser's print engine (`window.print()` with `@page` sizing), which
produces vector text and working links. Users choose "Save as PDF" in the dialog.

**Adding a template:** add an entry to `TEMPLATES` in `src/templates/index.jsx`
and a `.rs-<key>` block in `src/styles/resume.css` (override the CSS variables at the top of
that file — font, size, spacing, padding).

**Data model** (Firestore `users/{uid}/resumes/{id}`):
`{ title, template, accent, pageSize, sectionOrder[], hidden[], data: { personal, summary, experience[], education[], skills[], projects[], custom[] }, updatedAt }`

## Updates & the What's new page

- Every build writes `/version.json`. Open tabs check it every minute; the top-bar badge shows
  "Updated x min ago" and turns into **New update · Refresh** when a newer version is live.
- `/changelog` lists feature history from `src/changelog.js`. **When you ship something, add an
  entry at the top of that file** (version, date, title, tag, bullet points) before you push.
- On Vercel, the page also shows the latest commit message automatically.

## Later: monetization hooks

Good places to add paid features later: premium templates (flag in `TEMPLATES`),
a resume count limit in `Dashboard.jsx#create`, or a direct-download PDF (server-side
rendering with Puppeteer) as a paid upgrade.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build into `dist/`
- `npm run build:demo` — single self-contained HTML file in `dist-demo/` (demo mode, no backend)

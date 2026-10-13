# CARDIO PPDS MASTER - Study edition

An offline study site for cardiology exam preparation: library topics with figures, tables and decision trees,
practice questions with explanations, flashcards with spaced repetition, a timed mock exam, and a progress page.

- **Works offline.** After the first visit the whole site is stored in your browser and opens without internet.
- **No accounts, no server.** Your answers, flashcard schedule and exam history are stored only in your own browser
  on your own device. Nothing is sent anywhere. Different devices do not sync with each other.
- **Back up your progress.** Open *Settings* in the site, section *Backup and restore*, and choose *Download backup* to get a small JSON file.
  On another device or browser use *Restore from a backup file* to load it again. Clearing your browser data also clears your progress,
  so back up first.
- **My Media (optional).** The *My Media* page lets you add your own images, sounds and video clips and mark them. They are kept
  only in your own browser on your own device, are not part of this repository, and are not in the progress backup (use *Export backup*
  inside My Media for them). Do not add anything that identifies a patient. Keep those backup files (`*.cardiolab`)
  outside this repository; its `.gitignore` excludes them.

## Not medical advice

This is an educational study aid for exam preparation. It is not medical advice and it is not for use in patient care.
Guidelines change and summaries leave things out: always verify against the full, current guideline before relying on
anything here.

## Content

The material is a mix of converted cv-roadmap content and original material written for this study site.
The sources of individual items are named inside the site where they apply.

## Using the files in this repository

The site is plain files (`index.html`, `assets/`, `data/`, `sw.js`, `manifest.webmanifest`, icons). There is nothing
to install or build. It is published with GitHub Pages; see `.github/workflows/pages.yml`.

Before switching on Pages, check that the repository root shows the folders `assets` and `data` (upload the folders
themselves, not their contents; GitHub Desktop or git copy them as they are). `UPLOAD-CHECKLIST.txt` gives the number of
files each must hold. After publishing, open the site, **Settings**, **Check this site's files**: it lists any file of
`upload-manifest.json` that is missing or incomplete. If the page instead shows "The study app did not start", the `assets` and
`data` folders did not reach the repository: upload them again as folders. All the files here are produced by
the export of the app, so changes made here by hand are lost the next time the site is exported and uploaded.

## Licence

All rights reserved by the author unless a licence file says otherwise.

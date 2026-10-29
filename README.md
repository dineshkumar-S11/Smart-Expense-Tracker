# Smart Expense Tracker – Front-end

A front-end prototype. **No backend or database is connected.** All records are saved in your
browser's `localStorage`. The Python / MySQL stage is still to come.

## Run in VS Code (Live Server)
1. Unzip the folder and open it in VS Code (File > Open Folder).
2. Install the **Live Server** extension (Ritwick Dey) if you do not have it.
3. Right-click `index.html` > **Open with Live Server** (it opens at `http://127.0.0.1:5500/index.html`).
4. No internet is needed - charts are drawn with built-in SVG code.

(Double-clicking `index.html` also works; Live Server is recommended.)

## Files
| File | What it does |
|---|---|
| `index.html` | Page shell: sidebar, mountain header, month/bell/profile controls |
| `style.css` | One stylesheet shared by every page |
| `app.js` | Routing (`#/dashboard`, `#/transactions` ...), header, logout |
| `js/store.js` | All data + localStorage + sample data (replace this file's functions with API calls later) |
| `js/ui.js` | Icons, money/date formatting, modals, form validation |
| `js/charts.js` | Bar, donut and area charts |
| `js/pages.js` | The nine pages |
| `mountain-banner.jpg`, `stay-track.svg` | Images (keep beside `index.html`) |

## Notes
- Sample data (June 2026, plus Jan-May for the charts) is included. Settings > Security > *Restore sample data* resets it.
- The mountain banner supplied in the starter ZIP was upside down; it has been flipped upright.
- "Download PDF Report" opens the browser print window - choose *Save as PDF*. "CSV" downloads a file.
- Logout shows a confirmation, then a demo signed-out screen (no real login exists yet).
- Currency changes the symbol only (no conversion). The Email Notifications switch is stored as a preference only.
- Security tab (password etc.) is informational until the backend exists.

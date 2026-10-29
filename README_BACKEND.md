# Smart Expense Tracker — Flask + MySQL

Transactions, budgets, and categories are now connected from the UI through authenticated Flask APIs to MySQL. Profile name/phone/about are stored in MySQL; profile photo, date of birth, and general UI preferences remain browser-local.

## Setup (Windows / VS Code)
1. Install MySQL Server and start the `MySQL80` service.
2. In MySQL Workbench, run `database.sql` against your server. It creates missing tables but does not drop existing tables/data.
3. Copy `.env.example` to `.env`. Set `DB_PASSWORD` to your local MySQL password and set `SECRET_KEY` to a long random secret. Never share `.env` or commit it.
4. Open a terminal in this folder and run:
   ```powershell
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   python app.py
   ```
5. Open `http://127.0.0.1:5000`. Check `http://127.0.0.1:5000/api/health` while signed in or out to verify DB connectivity.

## Data flow
- Transactions (income and expenses): `GET/POST /api/transactions`, `GET/PUT/DELETE /api/transactions/<id>`.
- Budgets: `GET/PUT /api/budget?month=YYYY-MM`, using `budgets` and `category_budgets`.
- Categories: `GET/PUT /api/categories`.
- Dashboard/report data is calculated from the user's MySQL transactions.
- Private endpoints use the server session and scope queries to the authenticated user's ID.

## Existing browser data
This build does not silently import old localStorage sample transactions. Existing browser records remain in the browser but are not shown as authoritative database records. If you need them, export/copy them before switching and import only after verifying which account owns them. New records created in this build are saved in MySQL.

## Verify in MySQL Workbench
```sql
USE smart_expense_tracker;
SELECT id, user_id, txn_date, description, category, amount, type FROM transactions ORDER BY id DESC;
SELECT * FROM budgets ORDER BY id DESC;
SELECT * FROM category_budgets ORDER BY id DESC;
SELECT id, user_id, name, type, icon, color FROM categories ORDER BY user_id, type, name;
```

## Testing notes
Syntax checks can be run with `python -m py_compile app.py` and `node --check app.js`, `node --check js/store.js`, `node --check js/pages.js`, `node --check js/charts.js`, and `node --check js/ui.js`. Runtime CRUD and user-isolation tests must be performed against your own running MySQL instance; they have not been executed from this build environment.

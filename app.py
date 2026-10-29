"""Smart Expense Tracker Flask + MySQL backend.
Run: python app.py
"""
import os
import re
import math
import secrets
import time
import posixpath
from datetime import date, datetime
from decimal import Decimal
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory, render_template, redirect, abort, Response
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.abspath(__file__))
# Load .env from the project folder (works no matter which folder you start Python from).
load_dotenv(os.path.join(ROOT, '.env'))
app = Flask(__name__, static_folder=None)

_PLACEHOLDER_KEYS = {'', 'replace-with-a-long-random-secret', 'change-this-secret-before-deployment'}
_secret = os.getenv('SECRET_KEY', '')
if _secret in _PLACEHOLDER_KEYS:
    # Never fall back to a known, public default. A random key still works, but every
    # restart signs everyone out - set SECRET_KEY in .env to keep sessions across restarts.
    _secret = secrets.token_hex(32)
    print('WARNING: SECRET_KEY is not set in .env - using a temporary random key (logins reset on restart).')
app.secret_key = _secret
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true',  # set true when served over HTTPS
)

pool = None
def db_config():
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', '3306')),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'smart_expense_tracker'),
        'autocommit': False,
    }
def get_conn():
    global pool
    if pool is None:
        pool = pooling.MySQLConnectionPool(pool_name='set_pool', pool_size=5, **db_config())
    return pool.get_connection()
def json_value(v):
    if isinstance(v, (date, datetime)): return v.isoformat()
    if isinstance(v, Decimal): return float(v)
    return v
def rows(cursor):
    return [{k: json_value(v) for k, v in row.items()} for row in cursor.fetchall()]
def error(message, status=400): return jsonify({'error': message}), status
def server_error(exc):
    """Log the real problem in the Flask terminal; show the browser only a generic message."""
    app.logger.error('Server error on %s %s: %s', request.method, request.path, exc, exc_info=True)
    return error('Something went wrong on the server. Please try again.', 500)

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
_failed_logins = {}            # (ip, email) -> [timestamps]; simple in-memory throttle
MAX_FAILS, FAIL_WINDOW = 5, 300
def _throttle_key(email): return (request.remote_addr or '-', email)
def _is_throttled(key):
    now = time.time(); recent = [t for t in _failed_logins.get(key, []) if now - t < FAIL_WINDOW]
    _failed_logins[key] = recent
    return len(recent) >= MAX_FAILS

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'): return error('Please log in first.', 401)
        return fn(*args, **kwargs)
    return wrapper

@app.after_request
def no_store_for_private_responses(resp):
    """Pages and API answers depend on who is logged in, so browsers must not cache them
    (this is what stops the Back button from showing a dashboard after logout)."""
    if request.path.startswith('/api/') or resp.mimetype == 'text/html':
        resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
    resp.headers.setdefault('X-Content-Type-Options', 'nosniff')
    return resp

def run_query(sql, params=(), fetch=False, one=False, count=False):
    conn = get_conn(); cur = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params)
        result = cur.fetchone() if one else (rows(cur) if fetch else None)
        if count: result = cur.rowcount          # number of rows changed (used by DELETE)
        if not fetch and not one: conn.commit()
        return result
    except Exception:
        conn.rollback(); raise
    finally:
        cur.close(); conn.close()

# Only these files may be fetched by the browser. (The old catch-all route served ANY file in the
# project folder, including app.py, .env and database.sql.)
PUBLIC_FILES = {'style.css', 'app.js', 'mountain-banner.jpg', 'stay-track.svg'}
def is_public_file(path):
    p = posixpath.normpath(path)
    return p in PUBLIC_FILES or (p.startswith('js/') and p.endswith('.js') and p.count('/') == 1)

@app.get('/')
def home():
    # Server-side protection: no valid session -> login page, dashboard HTML is never sent.
    if not session.get('user_id'): return redirect('/login')
    return send_from_directory(ROOT, 'index.html')

@app.get('/index.html')
def index_alias(): return redirect('/')

@app.get('/login')
def login_page():
    if session.get('user_id'): return redirect('/')
    return render_template('login.html')

@app.get('/register')
def register_page():
    if session.get('user_id'): return redirect('/')
    return render_template('register.html')

@app.get('/favicon.ico')
def favicon(): return Response(status=204)

@app.get('/<path:path>')
def frontend_files(path):
    if not is_public_file(path): abort(404)
    resp = send_from_directory(ROOT, posixpath.normpath(path))
    resp.headers['Cache-Control'] = 'no-cache'      # always re-check so edited files show up
    return resp

@app.get('/api/health')
def health():
    try:
        run_query('SELECT 1 AS ok', fetch=True)
        return jsonify({'status':'ok','database':'connected'})
    except Exception as e:
        app.logger.error('Health check failed: %s', e)
        return jsonify({'status':'error','database':'disconnected'}), 503

@app.post('/api/auth/register')
def register():
    data = request.get_json(silent=True) or {}
    name = ' '.join((data.get('name') or '').split())
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm = data.get('confirmPassword')
    if len(name) < 2 or len(name) > 100: return error('Please enter your full name (2-100 characters).')
    if not EMAIL_RE.match(email) or len(email) > 190: return error('Please enter a valid email address.')
    if len(password) < 8: return error('Password must contain at least 8 characters.')
    if len(password) > 128: return error('Password must be 128 characters or fewer.')
    if confirm is None or confirm != password: return error('Passwords do not match.')
    try:
        if run_query('SELECT id FROM users WHERE email=%s', (email,), one=True):
            return error('An account with this email already exists.', 409)
        run_query('INSERT INTO users (name,email,password_hash) VALUES (%s,%s,%s)', (name, email, generate_password_hash(password)))
    except mysql.connector.IntegrityError:
        return error('An account with this email already exists.', 409)     # two sign-ups at the same moment
    except Exception as e:
        return server_error(e)
    # Registration deliberately does NOT log the user in: no session is created here.
    return jsonify({'message': 'Registration successful. Please log in.'}), 201

@app.post('/api/auth/login')
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower(); password = data.get('password') or ''
    if not email or not password: return error('Please enter your email and password.')
    key = _throttle_key(email)
    if _is_throttled(key): return error('Too many failed attempts. Please wait a few minutes and try again.', 429)
    try:
        user = run_query('SELECT id,name,email,password_hash FROM users WHERE email=%s', (email,), one=True)
    except Exception as e:
        app.logger.error('Login database error: %s', e)
        return error('The service is temporarily unavailable. Please try again shortly.', 503)
    if not user or not check_password_hash(user['password_hash'], password):
        _failed_logins.setdefault(key, []).append(time.time())
        return error('Invalid email or password.', 401)
    _failed_logins.pop(key, None)
    session.clear(); session['user_id'] = user['id']; session['user_name'] = user['name']
    return jsonify({'message': 'Logged in.', 'user': {'id': user['id'], 'name': user['name'], 'email': user['email']}})

@app.post('/api/auth/logout')
def logout():
    session.clear()
    return jsonify({'message': 'Logged out.'})

@app.get('/api/auth/me')
def me():
    if not session.get('user_id'): return error('Not logged in.', 401)
    try:
        user = run_query('SELECT id,name,email,phone,about,created_at FROM users WHERE id=%s', (session['user_id'],), one=True)
    except Exception as e:
        return server_error(e)
    if not user:                       # account no longer exists -> end the session
        session.clear()
        return error('Not logged in.', 401)
    user = {k: json_value(v) for k, v in user.items()}
    session['user_name'] = user['name']
    return jsonify(user)

@app.route('/api/transactions', methods=['GET','POST'])
@login_required
def transactions():
    uid=session['user_id']
    if request.method=='GET':
        start=request.args.get('from'); end=request.args.get('to'); typ=request.args.get('type')
        for label,val in (('from',start),('to',end)):
            if val:
                try: datetime.strptime(val,'%Y-%m-%d')
                except ValueError: return error(f"'{label}' must use YYYY-MM-DD format.")
        if start and end and start>end: return error("'from' date must not be after 'to' date.")
        sql='SELECT id, txn_date AS date, description AS `desc`, category AS cat, amount, type, payment_method AS method, created_at FROM transactions WHERE user_id=%s'; params=[uid]
        if start: sql+=' AND txn_date >= %s'; params.append(start)
        if end: sql+=' AND txn_date <= %s'; params.append(end)
        if typ in ('Income','Expense'): sql+=' AND type=%s'; params.append(typ)
        sql+=' ORDER BY txn_date DESC, id DESC'
        try: return jsonify(run_query(sql,tuple(params),fetch=True))
        except Exception as e: return server_error(e)
    d=request.get_json(silent=True) or {}; result=validate_transaction(d)
    if isinstance(result,str): return error(result)
    try:
        run_query('INSERT INTO transactions (user_id,txn_date,description,category,amount,type,payment_method) VALUES (%s,%s,%s,%s,%s,%s,%s)',(uid,result['date'],result['desc'],result['cat'],result['amount'],result['type'],result['method']))
        return jsonify({'message':'Transaction saved.'}),201
    except Exception as e: return server_error(e)

def validate_transaction(d):
    try: amount=float(d.get('amount',0))
    except (TypeError,ValueError): return 'Amount must be a positive number.'
    typ=d.get('type'); desc=(d.get('desc') or d.get('description') or '').strip(); cat=(d.get('cat') or d.get('category') or '').strip(); dt=d.get('date'); method=d.get('method') or d.get('payment_method') or 'Other'
    if not math.isfinite(amount) or amount<=0 or amount>9999999999 or not desc or len(desc)>255 or not cat or len(cat)>100 or typ not in ('Income','Expense') or not dt: return 'Date, description, category, valid type, and positive amount are required.'
    try: datetime.strptime(dt,'%Y-%m-%d')
    except ValueError: return 'Date must use YYYY-MM-DD format.'
    return {'amount':amount,'type':typ,'desc':desc,'cat':cat,'date':dt,'method':method}

@app.route('/api/transactions/<int:txid>', methods=['GET','PUT','DELETE'])
@login_required
def transaction_detail(txid):
    uid=session['user_id']
    if request.method=='DELETE':
        try:
            # user_id comes from the session, never from the request, so another user's row can never match.
            deleted=run_query('DELETE FROM transactions WHERE id=%s AND user_id=%s',(txid,uid),count=True)
        except Exception as e: return server_error(e)
        if not deleted: return error('Transaction not found or already deleted.',404)
        return jsonify({'message':'Transaction deleted.','id':txid})
    if request.method=='GET':
        try: item=run_query('SELECT id,txn_date AS date,description AS `desc`,category AS cat,amount,type,payment_method AS method FROM transactions WHERE id=%s AND user_id=%s',(txid,uid),one=True)
        except Exception as e: return server_error(e)
        return (jsonify(item),200) if item else error('Transaction not found.',404)
    result=validate_transaction(request.get_json(silent=True) or {})
    if isinstance(result,str): return error(result)
    try:
        run_query('UPDATE transactions SET txn_date=%s,description=%s,category=%s,amount=%s,type=%s,payment_method=%s WHERE id=%s AND user_id=%s',(result['date'],result['desc'],result['cat'],result['amount'],result['type'],result['method'],txid,uid))
        return jsonify({'message':'Transaction updated.'})
    except Exception as e: return server_error(e)

@app.get('/api/dashboard')
@login_required
def dashboard():
    uid=session['user_id']; month=request.args.get('month',date.today().strftime('%Y-%m'))
    try:
        totals=run_query("SELECT COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE 0 END),0) income, COALESCE(SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END),0) expenses FROM transactions WHERE user_id=%s AND DATE_FORMAT(txn_date,'%%Y-%%m')=%s",(uid,month),one=True)
        budget=run_query('SELECT monthly_limit FROM budgets WHERE user_id=%s AND month_key=%s',(uid,month),one=True)
        recent=run_query('SELECT id,txn_date AS date,description AS `desc`,category AS cat,amount,type,payment_method AS method FROM transactions WHERE user_id=%s AND DATE_FORMAT(txn_date,\'%%Y-%%m\')=%s ORDER BY txn_date DESC,id DESC LIMIT 8',(uid,month),fetch=True)
        inc=float(totals['income']); exp=float(totals['expenses'])
        return jsonify({'month':month,'income':inc,'expenses':exp,'balance':inc-exp,'budget':float(budget['monthly_limit']) if budget else 30000,'recent':recent})
    except Exception as e: return server_error(e)

@app.route('/api/budget', methods=['GET','PUT'])
@login_required
def budget():
    uid=session['user_id']; month=request.args.get('month') or (request.get_json(silent=True) or {}).get('month') or date.today().strftime('%Y-%m')
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', str(month)): return error('Month must use YYYY-MM format.')
    try:
        if request.method=='GET':
            item=run_query('SELECT month_key AS month,monthly_limit AS monthly FROM budgets WHERE user_id=%s AND month_key=%s',(uid,month),one=True)
            cats=run_query('SELECT category,amount_limit AS amount FROM category_budgets WHERE user_id=%s AND month_key=%s',(uid,month),fetch=True)
            return jsonify({'month':month,'monthly':float(item['monthly']) if item else 30000,'cats':{r['category']:float(r['amount']) for r in cats}})
        d=request.get_json(silent=True) or {}; cats=d.get('cats',{})
        try: limit=float(d.get('monthly',0))
        except (TypeError,ValueError): return error('Budget values must be valid non-negative numbers.')
        if not math.isfinite(limit) or limit<0 or limit>9999999999 or not isinstance(cats,dict): return error('Budget values must be valid non-negative numbers.')
        run_query('INSERT INTO budgets(user_id,month_key,monthly_limit) VALUES(%s,%s,%s) ON DUPLICATE KEY UPDATE monthly_limit=VALUES(monthly_limit)',(uid,month,limit))
        run_query('DELETE FROM category_budgets WHERE user_id=%s AND month_key=%s',(uid,month))
        for cat,amt in cats.items():
            value=float(amt)
            if not cat or len(str(cat))>100 or not math.isfinite(value) or value<0 or value>9999999999: return error('Category budget values must be valid non-negative numbers.')
            run_query('INSERT INTO category_budgets(user_id,month_key,category,amount_limit) VALUES(%s,%s,%s,%s)',(uid,month,str(cat),value))
        return jsonify({'message':'Budget saved.'})
    except Exception as e: return server_error(e)

@app.route('/api/categories', methods=['GET','PUT'])
@login_required
def categories():
    uid=session['user_id']
    try:
        if request.method=='GET': return jsonify(run_query('SELECT id,name,type,icon,color FROM categories WHERE user_id=%s ORDER BY type,name',(uid,),fetch=True))
        data=request.get_json(silent=True) or {}; items=data.get('categories',[])
        if not isinstance(items,list): return error('categories must be a list.')
        conn=get_conn(); cur=conn.cursor()
        try:
            cur.execute('DELETE FROM categories WHERE user_id=%s',(uid,))
            for c in items:
                if c.get('name') and c.get('type') in ('Income','Expense'):
                    cur.execute('INSERT INTO categories(user_id,name,type,icon,color) VALUES(%s,%s,%s,%s,%s)',(uid,c['name'],c['type'],c.get('icon','dots'),c.get('color','#8a9aab')))
            conn.commit()
        finally: cur.close(); conn.close()
        return jsonify({'message':'Categories saved.'})
    except Exception as e: return server_error(e)

@app.get('/api/reports')
@login_required
def reports():
    uid=session['user_id']; start=request.args.get('from','2000-01-01'); end=request.args.get('to','2100-12-31')
    try:
        monthly=run_query("SELECT DATE_FORMAT(txn_date,'%%Y-%%m') AS month, SUM(CASE WHEN type='Income' THEN amount ELSE 0 END) AS income, SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END) AS expenses FROM transactions WHERE user_id=%s AND txn_date BETWEEN %s AND %s GROUP BY DATE_FORMAT(txn_date,'%%Y-%%m') ORDER BY month",(uid,start,end),fetch=True)
        bycat=run_query("SELECT category, SUM(amount) AS total FROM transactions WHERE user_id=%s AND type='Expense' AND txn_date BETWEEN %s AND %s GROUP BY category ORDER BY total DESC",(uid,start,end),fetch=True)
        return jsonify({'monthly':monthly,'expensesByCategory':bycat})
    except Exception as e: return server_error(e)

@app.route('/api/profile', methods=['GET','PUT'])
@login_required
def profile():
    uid=session['user_id']
    try:
        if request.method=='GET':
            p=run_query('SELECT id,name,email,phone,about,created_at FROM users WHERE id=%s',(uid,),one=True); return jsonify(p)
        d=request.get_json(silent=True) or {}; name=(d.get('name') or '').strip(); phone=(d.get('phone') or '').strip(); about=(d.get('about') or '').strip()
        if len(name)<2 or len(name)>100: return error('Name must be 2-100 characters.')
        if len(phone)>30: return error('Phone number is too long.')
        if len(about)>500: return error('About must be 500 characters or fewer.')
        run_query('UPDATE users SET name=%s,phone=%s,about=%s WHERE id=%s',(name,phone,about,uid)); session['user_name']=name
        return jsonify({'message':'Profile updated.'})
    except Exception as e: return server_error(e)

@app.get('/api/settings')
@login_required
def settings():
    return jsonify({'currency':'INR','dateFormat':'DD MMM YYYY','language':'English','theme':'Light','emailNotifications':True,'budgetAlerts':True})

if __name__=='__main__':
    app.run(host='127.0.0.1',port=int(os.getenv('PORT','5000')),debug=os.getenv('FLASK_DEBUG','false').lower()=='true')

"""
Gold Loan Management System - Flask API Backend
Primary Keys: NIC Number & Ticket Number
"""

from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import sqlite3
import os
import csv
import io
from datetime import datetime

app = Flask(__name__, static_folder='static')
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'goldloan.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def dict_from_row(row):
    return dict(row) if row else None


# ==================== PAGES ====================
 
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)


# ==================== DASHBOARD STATS ====================

@app.route('/api/dashboard')
def dashboard_stats():
    conn = get_db()
    c = conn.cursor()
    
    stats = {}
    
    # Total counts
    c.execute("SELECT COUNT(*) FROM customers")
    stats['total_customers'] = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM loans")
    stats['total_loans'] = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM loans WHERE status = 'ACTIVE'")
    stats['active_loans'] = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM loans WHERE status = 'REDEEMED'")
    stats['redeemed_loans'] = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM loans WHERE status LIKE '%AUCTION%'")
    stats['auction_loans'] = c.fetchone()[0]
    
    # Financial summary
    c.execute("SELECT COALESCE(SUM(grand_advance), 0) FROM loans WHERE status = 'ACTIVE'")
    stats['total_active_advance'] = round(c.fetchone()[0], 2)
    
    c.execute("SELECT COALESCE(SUM(grand_advance), 0) FROM loans")
    stats['total_advance'] = round(c.fetchone()[0], 2)
    
    c.execute("SELECT COALESCE(SUM(redeemed_amount), 0) FROM loans WHERE status = 'REDEEMED'")
    stats['total_redeemed'] = round(c.fetchone()[0], 2)
    
    # Status distribution
    c.execute("""SELECT COALESCE(status, 'UNKNOWN') as status, COUNT(*) as count 
                 FROM loans GROUP BY status ORDER BY count DESC""")
    stats['status_distribution'] = [dict(row) for row in c.fetchall()]
    
    # Monthly loan trends (last 12 months)
    c.execute("""SELECT strftime('%Y-%m', pawned_date) as month, 
                 COUNT(*) as count, 
                 COALESCE(SUM(grand_advance), 0) as total_advance
                 FROM loans 
                 WHERE pawned_date IS NOT NULL 
                 GROUP BY month 
                 ORDER BY month DESC 
                 LIMIT 12""")
    stats['monthly_trends'] = [dict(row) for row in c.fetchall()]
    stats['monthly_trends'].reverse()
    
    # Top articles
    c.execute("""SELECT article_name, COUNT(*) as count 
                 FROM articles 
                 WHERE article_name IS NOT NULL 
                 GROUP BY article_name 
                 ORDER BY count DESC 
                 LIMIT 10""")
    stats['top_articles'] = [dict(row) for row in c.fetchall()]
    
    # Karat distribution
    c.execute("""SELECT karat, COUNT(*) as count, COALESCE(SUM(weight), 0) as total_weight
                 FROM articles 
                 WHERE karat IS NOT NULL 
                 GROUP BY karat 
                 ORDER BY karat DESC""")
    stats['karat_distribution'] = [dict(row) for row in c.fetchall()]
    
    # Recent loans
    c.execute("""SELECT ticket_no, nic_no, name, grand_advance, status, pawned_date 
                 FROM loans 
                 WHERE pawned_date IS NOT NULL 
                 ORDER BY pawned_date DESC 
                 LIMIT 10""")
    stats['recent_loans'] = [dict(row) for row in c.fetchall()]
    
    conn.close()
    return jsonify(stats)


# ==================== SEARCH ====================

@app.route('/api/search')
def search():
    """Search by NIC or Ticket Number (primary keys)."""
    query = request.args.get('q', '').strip()
    search_type = request.args.get('type', 'all')  # nic, ticket, all
    
    if not query:
        return jsonify({'results': [], 'count': 0})
    
    conn = get_db()
    c = conn.cursor()
    results = []
    
    if search_type in ('nic', 'all'):
        c.execute("""SELECT l.*, GROUP_CONCAT(a.article_name, ', ') as articles_list
                     FROM loans l 
                     LEFT JOIN articles a ON l.ticket_no = a.ticket_no
                     WHERE l.nic_no LIKE ? 
                     GROUP BY l.ticket_no
                     ORDER BY l.pawned_date DESC""",
                  (f'%{query}%',))
        for row in c.fetchall():
            r = dict(row)
            r['match_type'] = 'NIC'
            results.append(r)
    
    if search_type in ('ticket', 'all'):
        c.execute("""SELECT l.*, GROUP_CONCAT(a.article_name, ', ') as articles_list
                     FROM loans l 
                     LEFT JOIN articles a ON l.ticket_no = a.ticket_no
                     WHERE l.ticket_no LIKE ? 
                     GROUP BY l.ticket_no
                     ORDER BY l.pawned_date DESC""",
                  (f'%{query}%',))
        for row in c.fetchall():
            r = dict(row)
            r['match_type'] = 'TICKET'
            # Avoid duplicates
            if not any(x['ticket_no'] == r['ticket_no'] for x in results):
                results.append(r)
    
    # Also search by name
    if search_type == 'all':
        c.execute("""SELECT l.*, GROUP_CONCAT(a.article_name, ', ') as articles_list
                     FROM loans l 
                     LEFT JOIN articles a ON l.ticket_no = a.ticket_no
                     WHERE l.name LIKE ? 
                     GROUP BY l.ticket_no
                     ORDER BY l.pawned_date DESC
                     LIMIT 50""",
                  (f'%{query}%',))
        for row in c.fetchall():
            r = dict(row)
            r['match_type'] = 'NAME'
            if not any(x['ticket_no'] == r['ticket_no'] for x in results):
                results.append(r)
    
    conn.close()
    return jsonify({'results': results, 'count': len(results)})


# ==================== CUSTOMER DETAILS ====================

@app.route('/api/customer/<nic>')
def customer_detail(nic):
    """Get full customer details by NIC number."""
    conn = get_db()
    c = conn.cursor()
    
    # Customer info
    c.execute("SELECT * FROM customers WHERE nic_no = ?", (nic,))
    customer = dict_from_row(c.fetchone())
    
    if not customer:
        # Try to get from loans
        c.execute("SELECT nic_no, name, address1, address2, address3, mobile_no FROM loans WHERE nic_no = ? LIMIT 1", (nic,))
        customer = dict_from_row(c.fetchone())
    
    if not customer:
        conn.close()
        return jsonify({'error': 'Customer not found'}), 404
    
    # All loans for this customer
    c.execute("""SELECT * FROM loans WHERE nic_no = ? ORDER BY pawned_date DESC""", (nic,))
    loans = [dict(row) for row in c.fetchall()]
    
    # All articles for this customer's loans
    for loan in loans:
        c.execute("SELECT * FROM articles WHERE ticket_no = ?", (loan['ticket_no'],))
        loan['articles'] = [dict(row) for row in c.fetchall()]
    
    # Summary
    summary = {
        'total_loans': len(loans),
        'active_loans': sum(1 for l in loans if l.get('status') == 'ACTIVE'),
        'redeemed_loans': sum(1 for l in loans if l.get('status') == 'REDEEMED'),
        'total_advance': sum(l.get('grand_advance') or 0 for l in loans),
        'total_redeemed': sum(l.get('redeemed_amount') or 0 for l in loans if l.get('status') == 'REDEEMED'),
    }
    
    conn.close()
    return jsonify({
        'customer': customer,
        'loans': loans,
        'summary': summary
    })


# ==================== LOAN DETAILS ====================

@app.route('/api/loan')
@app.route('/api/loan/<path:ticket_no>')
def loan_detail(ticket_no=None):
    """Get full loan details by ticket number."""
    if not ticket_no:
        ticket_no = request.args.get('ticket') or request.args.get('ticket_no') or request.args.get('t')
    if not ticket_no:
        return jsonify({'error': 'Ticket number is required'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    ticket_clean = ticket_no.strip()
    c.execute("SELECT * FROM loans WHERE ticket_no = ? OR ticket_no = ?", (ticket_no, ticket_clean))
    loan = dict_from_row(c.fetchone())
    
    if not loan:
        c.execute("SELECT * FROM loans WHERE UPPER(ticket_no) = UPPER(?)", (ticket_clean,))
        loan = dict_from_row(c.fetchone())
        
    if not loan:
        c.execute("SELECT * FROM loans WHERE ticket_no LIKE ?", (f"%{ticket_clean}%",))
        loan = dict_from_row(c.fetchone())
    
    if not loan:
        conn.close()
        return jsonify({'error': 'Loan not found'}), 404
    
    # Use exact ticket_no from database row
    db_ticket = loan['ticket_no']
    
    # Get articles
    c.execute("SELECT * FROM articles WHERE ticket_no = ?", (db_ticket,))
    loan['articles'] = [dict(row) for row in c.fetchall()]
    
    # Get other loans for same customer
    if loan.get('nic_no'):
        c.execute("""SELECT ticket_no, status, grand_advance, pawned_date 
                     FROM loans 
                     WHERE nic_no = ? AND ticket_no != ?
                     ORDER BY pawned_date DESC""",
                  (loan['nic_no'], ticket_no))
        loan['other_loans'] = [dict(row) for row in c.fetchall()]
    
    conn.close()
    return jsonify(loan)


# ==================== LOANS LIST ====================

@app.route('/api/loans')
def loans_list():
    """List all loans with pagination and filtering."""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 25))
    status = request.args.get('status', '')
    sort_by = request.args.get('sort', 'pawned_date')
    sort_order = request.args.get('order', 'desc')
    
    offset = (page - 1) * per_page
    
    conn = get_db()
    c = conn.cursor()
    
    where_clause = ""
    params = []
    
    if status:
        where_clause = "WHERE status = ?"
        params.append(status)
    
    # Validate sort columns
    valid_sorts = ['ticket_no', 'name', 'grand_advance', 'pawned_date', 'status', 'nic_no']
    if sort_by not in valid_sorts:
        sort_by = 'pawned_date'
    if sort_order not in ('asc', 'desc'):
        sort_order = 'desc'
    
    c.execute(f"SELECT COUNT(*) FROM loans {where_clause}", params)
    total = c.fetchone()[0]
    
    c.execute(f"""SELECT ticket_no, nic_no, name, grand_advance, status, 
                  pawned_date, maturity_date, redeemed_date, redeemed_amount,
                  num_articles, period, mobile_no
                  FROM loans {where_clause}
                  ORDER BY {sort_by} {sort_order}
                  LIMIT ? OFFSET ?""",
              params + [per_page, offset])
    loans = [dict(row) for row in c.fetchall()]
    
    conn.close()
    return jsonify({
        'loans': loans,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


# ==================== CUSTOMERS LIST ====================

@app.route('/api/customers')
def customers_list():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 25))
    offset = (page - 1) * per_page
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT COUNT(*) FROM customers")
    total = c.fetchone()[0]
    
    c.execute("""SELECT c.*, 
                 (SELECT COUNT(*) FROM loans WHERE nic_no = c.nic_no) as loan_count,
                 (SELECT COALESCE(SUM(grand_advance), 0) FROM loans WHERE nic_no = c.nic_no) as total_advance,
                 (SELECT COUNT(*) FROM loans WHERE nic_no = c.nic_no AND status = 'ACTIVE') as active_loans
                 FROM customers c
                 ORDER BY c.name
                 LIMIT ? OFFSET ?""",
              (per_page, offset))
    customers = [dict(row) for row in c.fetchall()]
    
    conn.close()
    return jsonify({
        'customers': customers,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


# ==================== GOLD RATES ====================

@app.route('/api/gold-rates')
def gold_rates():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM gold_rates ORDER BY karat DESC")
    rates = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(rates)


# ==================== PRODUCT RATES ====================

@app.route('/api/product-rates')
def product_rates():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM product_rates ORDER BY karat DESC, period_months ASC")
    rates = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(rates)


# ==================== AUCTION ITEMS ====================

@app.route('/api/auctions')
def auctions():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM auction_items ORDER BY auction_date DESC")
    items = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(items)


# ==================== BILLING & INVOICING SYSTEM ====================

def init_billing_tables():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_no TEXT UNIQUE NOT NULL,
            bill_type TEXT DEFAULT 'GOLD_SALE',
            ticket_no TEXT,
            nic_no TEXT,
            customer_name TEXT NOT NULL,
            customer_phone TEXT,
            customer_address TEXT,
            subtotal REAL NOT NULL DEFAULT 0,
            service_charge REAL DEFAULT 0,
            interest_amount REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            grand_total REAL NOT NULL DEFAULT 0,
            paid_amount REAL NOT NULL DEFAULT 0,
            balance_amount REAL DEFAULT 0,
            payment_method TEXT DEFAULT 'Cash',
            notes TEXT,
            cashier TEXT DEFAULT 'Authorized Officer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL,
            ticket_no TEXT,
            article_name TEXT NOT NULL,
            karat TEXT,
            weight REAL NOT NULL,
            rate_per_gram REAL NOT NULL,
            total_price REAL NOT NULL,
            notes TEXT,
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()

init_billing_tables()


@app.route('/api/billing/customer-search')
def billing_customer_search():
    """Find customer and their gold articles for fast billing/redemption."""
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'results': []})
    
    conn = get_db()
    c = conn.cursor()
    
    # Get rates for estimate calculations
    c.execute("SELECT karat, price FROM gold_rates")
    rate_map = {}
    for r in c.fetchall():
        try:
            k = int(r['karat'])
            rate_map[k] = round(float(r['price']) / 8.0, 2)
        except Exception:
            pass
    default_rate = rate_map.get(22, 43000.0)
    
    # Search by NIC or Ticket or Name (Safe column names)
    c.execute("""SELECT l.id, l.ticket_no, l.nic_no, l.name, l.address1, l.address2, l.address3,
                        COALESCE(l.mobile_no, c.mobile_no) as mobile_no,
                        l.num_articles, l.period, l.grand_advance, l.status, l.pawned_date,
                        l.interest_amount
                 FROM loans l
                 LEFT JOIN customers c ON l.nic_no = c.nic_no
                 WHERE l.nic_no LIKE ? OR l.ticket_no LIKE ? OR l.name LIKE ?
                 ORDER BY l.pawned_date DESC
                 LIMIT 25""",
              (f'%{query}%', f'%{query}%', f'%{query}%'))
    
    rows = c.fetchall()
    results = []
    
    for row in rows:
        loan = dict(row)
        # Fetch articles for this ticket
        c.execute("SELECT * FROM articles WHERE ticket_no = ?", (loan['ticket_no'],))
        articles = [dict(a) for a in c.fetchall()]
        
        # Calculate estimated market value for each article
        for art in articles:
            k_val = None
            try:
                k_val = int(art.get('karat') or 22)
            except Exception:
                k_val = 22
            rate = rate_map.get(k_val, default_rate)
            wt = float(art.get('weight') or 0)
            art['estimated_rate_per_gram'] = rate
            art['estimated_value'] = round(wt * rate, 2)
            
        loan['articles'] = articles
        results.append(loan)
        
    conn.close()
    return jsonify({'results': results})


@app.route('/api/bills', methods=['GET'])
def list_bills():
    """List generated bills."""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    q = request.args.get('q', '').strip()
    offset = (page - 1) * per_page
    
    conn = get_db()
    c = conn.cursor()
    
    where = ""
    params = []
    if q:
        where = "WHERE bill_no LIKE ? OR customer_name LIKE ? OR nic_no LIKE ? OR ticket_no LIKE ?"
        params = [f'%{q}%', f'%{q}%', f'%{q}%', f'%{q}%']
        
    c.execute(f"SELECT COUNT(*) FROM bills {where}", params)
    total = c.fetchone()[0]
    
    c.execute(f"""SELECT b.*, 
                  (SELECT COUNT(*) FROM bill_items WHERE bill_id = b.id) as item_count 
                  FROM bills b {where}
                  ORDER BY b.created_at DESC
                  LIMIT ? OFFSET ?""",
              params + [per_page, offset])
              
    bills = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return jsonify({
        'bills': bills,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


@app.route('/api/bills', methods=['POST'])
def create_bill():
    """Create a new bill / invoice."""
    data = request.get_json() or {}
    
    customer_name = data.get('customer_name', '').strip()
    if not customer_name:
        return jsonify({'error': 'Customer Name is required'}), 400
        
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'At least one gold article item is required'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    date_prefix = datetime.now().strftime('%Y%m%d')
    c.execute("SELECT COUNT(*) FROM bills WHERE bill_no LIKE ?", (f'INV-{date_prefix}-%',))
    count = c.fetchone()[0] + 1
    bill_no = f"INV-{date_prefix}-{count:04d}"
    
    subtotal = float(data.get('subtotal', 0) or 0)
    service_charge = float(data.get('service_charge', 0) or 0)
    interest_amount = float(data.get('interest_amount', 0) or 0)
    discount = float(data.get('discount', 0) or 0)
    tax_amount = float(data.get('tax_amount', 0) or 0)
    grand_total = float(data.get('grand_total', 0) or (subtotal + service_charge + interest_amount + tax_amount - discount))
    paid_amount = float(data.get('paid_amount', 0) or grand_total)
    balance_amount = round(paid_amount - grand_total, 2)
    
    nic_no = data.get('nic_no', '').strip()
    ticket_no = data.get('ticket_no', '').strip()
    phone = data.get('customer_phone', '').strip()
    address = data.get('customer_address', '').strip()
    payment_method = data.get('payment_method', 'Cash')
    bill_type = data.get('bill_type', 'GOLD_SALE')
    notes = data.get('notes', '').strip()
    cashier = data.get('cashier', 'Authorized Officer')
    
    c.execute("""
        INSERT INTO bills (
            bill_no, bill_type, ticket_no, nic_no, customer_name, 
            customer_phone, customer_address, subtotal, service_charge, 
            interest_amount, discount, tax_amount, grand_total, 
            paid_amount, balance_amount, payment_method, notes, cashier, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    """, (
        bill_no, bill_type, ticket_no, nic_no, customer_name,
        phone, address, subtotal, service_charge,
        interest_amount, discount, tax_amount, grand_total,
        paid_amount, balance_amount, payment_method, notes, cashier
    ))
    
    bill_id = c.lastrowid
    
    for item in items:
        art_name = item.get('article_name', 'Gold Item')
        karat = str(item.get('karat', '22'))
        weight = float(item.get('weight', 0))
        rate_per_gram = float(item.get('rate_per_gram', 0))
        total_price = float(item.get('total_price', weight * rate_per_gram))
        item_ticket = item.get('ticket_no', ticket_no)
        item_notes = item.get('notes', '')
        
        c.execute("""
            INSERT INTO bill_items (
                bill_id, ticket_no, article_name, karat, 
                weight, rate_per_gram, total_price, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (bill_id, item_ticket, art_name, karat, weight, rate_per_gram, total_price, item_notes))
        
    if ticket_no and data.get('mark_loan_redeemed'):
        c.execute("""UPDATE loans 
                     SET status = 'REDEEMED', 
                         redeemed_date = date('now', 'localtime'), 
                         redeemed_amount = ? 
                     WHERE ticket_no = ?""",
                  (grand_total, ticket_no))

    # Auto-register customer in customers table if not existing
    if nic_no:
        c.execute("SELECT id FROM customers WHERE nic_no = ?", (nic_no,))
        if not c.fetchone():
            c.execute("""INSERT INTO customers (nic_no, name, address1, mobile_no)
                         VALUES (?, ?, ?, ?)""",
                      (nic_no, customer_name, address, phone))
                  
    conn.commit()
    
    c.execute("SELECT * FROM bills WHERE id = ?", (bill_id,))
    bill_record = dict(c.fetchone())
    c.execute("SELECT * FROM bill_items WHERE bill_id = ?", (bill_id,))
    bill_record['items'] = [dict(r) for r in c.fetchall()]
    
    conn.close()
    return jsonify({'success': True, 'bill': bill_record})


@app.route('/api/bill/<bill_no>', methods=['GET'])
def get_bill(bill_no):
    """Retrieve full bill details with items."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM bills WHERE bill_no = ?", (bill_no,))
    bill_row = c.fetchone()
    if not bill_row:
        conn.close()
        return jsonify({'error': 'Bill not found'}), 404
        
    bill = dict(bill_row)
    c.execute("SELECT * FROM bill_items WHERE bill_id = ?", (bill['id'],))
    bill['items'] = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify(bill)


@app.route('/api/bill/<bill_no>', methods=['DELETE'])
def delete_bill(bill_no):
    """Delete a bill."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM bills WHERE bill_no = ?", (bill_no,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Bill not found'}), 404
        
    c.execute("DELETE FROM bill_items WHERE bill_id = ?", (row['id'],))
    c.execute("DELETE FROM bills WHERE id = ?", (row['id'],))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'Bill {bill_no} deleted successfully'})


@app.route('/api/bills/export')
def export_bills_csv():
    """Export all registered bills to CSV / Excel spreadsheet."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""SELECT b.bill_no, b.created_at, b.customer_name, b.nic_no, b.customer_phone,
                        b.customer_address, b.ticket_no, b.subtotal, b.service_charge,
                        b.interest_amount, b.discount, b.grand_total, b.paid_amount,
                        b.balance_amount, b.payment_method, b.cashier,
                        GROUP_CONCAT(bi.article_name || ' (' || bi.karat || 'KT, ' || bi.weight || 'g)', ' | ') as articles
                 FROM bills b
                 LEFT JOIN bill_items bi ON b.id = bi.bill_id
                 GROUP BY b.id
                 ORDER BY b.created_at DESC""")
    rows = c.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Invoice No', 'Date & Time', 'Customer Name', 'NIC Number', 'Phone',
        'Address', 'Ticket No', 'Subtotal (LKR)', 'Service Charge', 'Interest Amount',
        'Discount', 'Grand Total (LKR)', 'Paid Amount', 'Balance', 'Payment Method', 'Cashier', 'Gold Articles'
    ])
    for r in rows:
        writer.writerow(list(r))
        
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=GoldLoan_Invoices_Export.csv"}
    )


# ==================== DATABASE EXPLORER ====================

@app.route('/api/database/tables')
def db_tables():
    """List all database tables with row counts and columns."""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    tables = []
    for r in c.fetchall():
        tname = r[0]
        c.execute(f"SELECT COUNT(*) FROM [{tname}]")
        cnt = c.fetchone()[0]
        c.execute(f"PRAGMA table_info([{tname}])")
        cols = [col[1] for col in c.fetchall()]
        tables.append({'name': tname, 'count': cnt, 'columns': cols})
    conn.close()
    return jsonify(tables)


@app.route('/api/database/table/<tname>')
def db_table_data(tname):
    """Get table records with pagination and search."""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 25))
    search = request.args.get('q', '').strip()
    offset = (page - 1) * per_page
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", (tname,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Invalid table'}), 400
        
    c.execute(f"PRAGMA table_info([{tname}])")
    columns = [col[1] for col in c.fetchall()]
    
    where = ""
    params = []
    if search:
        clauses = [f"CAST([{col}] AS TEXT) LIKE ?" for col in columns[:8]]
        where = f"WHERE {' OR '.join(clauses)}"
        params = [f"%{search}%"] * len(clauses)
        
    c.execute(f"SELECT COUNT(*) FROM [{tname}] {where}", params)
    total = c.fetchone()[0]
    
    c.execute(f"SELECT * FROM [{tname}] {where} LIMIT ? OFFSET ?", params + [per_page, offset])
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    
    return jsonify({
        'table': tname,
        'columns': columns,
        'rows': rows,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n{'='*60}")
    print(f"  GOLD LOAN MANAGEMENT & BILLING SYSTEM")
    print(f"  Database: {DB_PATH}")
    print(f"  Server: http://localhost:{port}")
    print(f"{'='*60}\n")
    app.run(host='0.0.0.0', port=port, debug=False)



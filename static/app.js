/**
 * Gold Loan Management System - Frontend JavaScript
 * Primary Keys: NIC Number & Ticket Number
 */

const API_BASE = '';
let currentPage = 'dashboard';
let searchType = 'all';
let searchDebounce = null;

// Loans state
let loansState = {
    page: 1,
    perPage: 25,
    status: '',
    sort: 'pawned_date',
    order: 'desc'
};

let customersState = {
    page: 1,
    perPage: 25
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    startLiveClock();
    loadDashboard();

    // Close search on click outside
    document.addEventListener('click', (e) => {
        const searchContainer = document.querySelector('.search-container');
        if (!searchContainer.contains(e.target)) {
            document.getElementById('searchResults').classList.remove('visible');
        }
    });

    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput').focus();
        }
        if (e.key === 'Escape') {
            document.getElementById('searchResults').classList.remove('visible');
            closeDetail();
        }
    });
});

// ==================== NAVIGATION ====================

function navigate(page) {
    currentPage = page;

    // Update nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Load page data
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'loans': loadLoans(); break;
        case 'customers': loadCustomers(); break;
        case 'auctions': loadAuctions(); break;
        case 'gold-rates': loadGoldRates(); break;
        case 'product-rates': loadProductRates(); break;
        case 'billing': initBillingPage(); break;
        case 'redeemed': loadRedeemedPage(); break;
        case 'database': loadDatabaseExplorer(); break;
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ==================== API HELPERS ====================

async function apiGet(url) {
    try {
        const response = await fetch(`${API_BASE}${url}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function apiPost(url, data) {
    try {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const resData = await response.json();
        if (!response.ok) {
            return { error: resData.error || `HTTP ${response.status}`, ...resData };
        }
        return resData;
    } catch (error) {
        console.error('API POST Error:', error);
        return { error: error.message };
    }
}

// ==================== LIVE REAL-TIME CLOCK & TODAY DATE ====================

function formatTodayDateLong(d) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTodayDateShort(d) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatLiveTime(d) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hStr = String(hours).padStart(2, '0');
    return `${hStr}:${minutes}:${seconds} ${ampm}`;
}

function updateLiveClock() {
    const now = new Date();
    const longDate = formatTodayDateLong(now);
    const shortDate = formatTodayDateShort(now);
    const timeStr = formatLiveTime(now);

    // Top Bar widget
    const topBarDate = document.getElementById('topBarDateText');
    const topBarTime = document.getElementById('topBarTimeText');
    if (topBarDate) topBarDate.textContent = shortDate;
    if (topBarTime) topBarTime.textContent = timeStr;

    // Gold Rates page badge
    const goldRatesDate = document.getElementById('goldRatesTodayDate');
    const goldRatesTime = document.getElementById('goldRatesTodayTime');
    if (goldRatesDate) goldRatesDate.textContent = longDate;
    if (goldRatesTime) goldRatesTime.textContent = timeStr;

    // Gold Rates status bar
    const ratesValidDate = document.getElementById('ratesValidDateText');
    if (ratesValidDate) ratesValidDate.textContent = longDate;

    // Modal date
    const modalDate = document.getElementById('modalTodayDateText');
    if (modalDate) modalDate.textContent = `Today: ${longDate}`;
}

let liveClockInterval = null;
function startLiveClock() {
    updateLiveClock();
    if (!liveClockInterval) {
        liveClockInterval = setInterval(updateLiveClock, 1000);
    }
}


function formatMoney(amount) {
    if (amount == null || isNaN(amount)) return '-';
    return new Intl.NumberFormat('en-LK', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function getStatusClass(status) {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'ACTIVE') return 'active';
    if (s === 'REDEEMED') return 'redeemed';
    if (s.includes('AUCTION')) return 'auction';
    if (s === 'SETTLED') return 'settled';
    return '';
}

function getStatusColor(status) {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') return '#22c55e';
    if (s === 'REDEEMED') return '#3b82f6';
    if (s.includes('AUCTION')) return '#ef4444';
    if (s === 'SETTLED') return '#8b5cf6';
    return '#6b6b80';
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    const data = await apiGet('/api/dashboard');
    if (!data) return;

    // Update stats
    document.getElementById('stat-active-advance').textContent = `Rs. ${formatMoney(data.total_active_advance)}`;
    document.getElementById('stat-active-loans').textContent = formatMoney(data.active_loans);
    document.getElementById('stat-redeemed-loans').textContent = formatMoney(data.redeemed_loans);
    document.getElementById('stat-customers').textContent = formatMoney(data.total_customers);
    document.getElementById('stat-auction-loans').textContent = formatMoney(data.auction_loans);

    // Nav badges
    document.getElementById('nav-loan-count').textContent = formatMoney(data.total_loans);
    document.getElementById('nav-customer-count').textContent = formatMoney(data.total_customers);

    // Monthly chart
    renderMonthlyChart(data.monthly_trends || []);

    // Status donut
    renderStatusChart(data.status_distribution || [], data.total_loans);

    // Top articles
    renderArticlesChart(data.top_articles || []);

    // Karat distribution
    renderKaratChart(data.karat_distribution || []);

    // Recent loans table
    renderRecentLoans(data.recent_loans || []);

    // Check redeemed customer alerts
    checkRedeemedAlerts();
}

function renderMonthlyChart(trends) {
    const container = document.getElementById('monthlyChart');
    if (!trends.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data</div></div>';
        return;
    }

    const maxCount = Math.max(...trends.map(t => t.count), 1);

    container.innerHTML = trends.map(t => {
        const height = Math.max((t.count / maxCount) * 130, 4);
        const monthLabel = t.month ? t.month.substring(5) : '-';
        return `
            <div class="bar-col">
                <div class="bar-value">${t.count}</div>
                <div class="bar" style="height: ${height}px" title="${t.month}: ${t.count} loans, Rs. ${formatMoney(t.total_advance)}"></div>
                <div class="bar-label">${monthLabel}</div>
            </div>
        `;
    }).join('');
}

function renderStatusChart(distribution, total) {
    const container = document.getElementById('statusChart');
    if (!distribution.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data</div></div>';
        return;
    }

    const colors = {
        'ACTIVE': '#22c55e',
        'REDEEMED': '#3b82f6',
        'AUCTION': '#ef4444',
        'AUCTION 2': '#f97316',
        'SETTLED': '#8b5cf6',
        'UNKNOWN': '#6b6b80'
    };

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const circles = distribution.map(item => {
        const color = colors[item.status] || '#6b6b80';
        const percentage = item.count / total;
        const dashLength = percentage * circumference;
        const circle = `<circle cx="70" cy="70" r="${radius}" 
            stroke="${color}" 
            stroke-dasharray="${dashLength} ${circumference - dashLength}" 
            stroke-dashoffset="${-offset}"
            style="transition: stroke-dasharray 0.8s ease"/>`;
        offset += dashLength;
        return circle;
    });

    const legend = distribution.slice(0, 6).map(item => {
        const color = colors[item.status] || '#6b6b80';
        const pct = ((item.count / total) * 100).toFixed(1);
        return `
            <div class="legend-item">
                <div class="legend-dot" style="background: ${color}"></div>
                <span>${item.status || 'Unknown'}</span>
                <span class="legend-value">${item.count} (${pct}%)</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="donut-chart">
            <svg viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="${radius}" stroke="rgba(255,255,255,0.04)" stroke-width="20" fill="none"/>
                ${circles.join('')}
            </svg>
            <div class="donut-center">
                <div class="donut-center-value">${formatMoney(total)}</div>
                <div class="donut-center-label">Total</div>
            </div>
        </div>
        <div class="donut-legend">${legend}</div>
    `;
}

function renderArticlesChart(articles) {
    const container = document.getElementById('articlesChart');
    if (!articles.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data</div></div>';
        return;
    }

    const maxCount = Math.max(...articles.map(a => a.count), 1);

    container.innerHTML = articles.slice(0, 8).map(a => `
        <div class="h-bar-item">
            <div class="h-bar-name" title="${a.article_name}">${a.article_name}</div>
            <div class="h-bar-track">
                <div class="h-bar-fill" style="width: ${(a.count / maxCount) * 100}%"></div>
            </div>
            <div class="h-bar-count">${a.count}</div>
        </div>
    `).join('');
}

function renderKaratChart(karats) {
    const container = document.getElementById('karatChart');
    if (!karats.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data</div></div>';
        return;
    }

    const maxCount = Math.max(...karats.map(k => k.count), 1);

    container.innerHTML = karats.map(k => `
        <div class="h-bar-item">
            <div class="h-bar-name">${k.karat} KT</div>
            <div class="h-bar-track">
                <div class="h-bar-fill" style="width: ${(k.count / maxCount) * 100}%"></div>
            </div>
            <div class="h-bar-count">${k.count} (${k.total_weight ? k.total_weight.toFixed(1) : 0}g)</div>
        </div>
    `).join('');
}

function renderRecentLoans(loans) {
    const tbody = document.getElementById('recentLoansBody');
    if (!loans.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-text">No recent loans</div></td></tr>';
        return;
    }

    tbody.innerHTML = loans.map(l => `
        <tr onclick="openLoanDetail('${l.ticket_no}')">
            <td><span class="ticket-num">${l.ticket_no || '-'}</span></td>
            <td><span class="nic-num">${l.nic_no || '-'}</span></td>
            <td>${l.name || '-'}</td>
            <td class="money">${formatMoney(l.grand_advance)}</td>
            <td><span class="status-badge ${getStatusClass(l.status)}"><span class="status-dot"></span>${l.status || '-'}</span></td>
            <td>${formatDate(l.pawned_date)}</td>
        </tr>
    `).join('');
}

// ==================== SEARCH ====================

function setSearchType(type) {
    searchType = type;
    document.querySelectorAll('.search-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    handleSearch();
}

function focusSearch(type) {
    setSearchType(type);
    const input = document.getElementById('searchInput');
    input.focus();
    input.placeholder = type === 'nic' ? 'Enter NIC Number...' : type === 'ticket' ? 'Enter Ticket Number...' : 'Search by NIC, Ticket No, or Name...';
}

function handleSearch() {
    clearTimeout(searchDebounce);
    const query = document.getElementById('searchInput').value.trim();

    if (!query || query.length < 2) {
        document.getElementById('searchResults').classList.remove('visible');
        return;
    }

    searchDebounce = setTimeout(async () => {
        const data = await apiGet(`/api/search?q=${encodeURIComponent(query)}&type=${searchType}`);
        if (!data) return;

        const container = document.getElementById('searchResults');

        if (!data.results.length) {
            container.innerHTML = `
                <div style="padding: 24px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 8px; opacity: 0.3;">🔍</div>
                    <div style="font-size: 13px; color: var(--text-muted);">No results found for "${query}"</div>
                </div>
            `;
            container.classList.add('visible');
            return;
        }

        container.innerHTML = data.results.slice(0, 15).map(r => {
            const iconClass = r.match_type === 'NIC' ? 'nic' : r.match_type === 'TICKET' ? 'ticket' : 'name';
            const icon = r.match_type === 'NIC' ? '🪪' : r.match_type === 'TICKET' ? '🎫' : '👤';
            return `
                <div class="search-result-item" onclick="openSearchResult('${r.ticket_no}', '${r.nic_no || ''}')">
                    <div class="search-result-icon ${iconClass}">${icon}</div>
                    <div class="search-result-info">
                        <div class="search-result-title">${r.name || 'Unknown'}</div>
                        <div class="search-result-meta">
                            🎫 ${r.ticket_no || '-'} · 🪪 ${r.nic_no || '-'} · Rs. ${formatMoney(r.grand_advance)}
                        </div>
                    </div>
                    <span class="status-badge ${getStatusClass(r.status)}" style="font-size: 10px;">
                        <span class="status-dot"></span>${r.status || '-'}
                    </span>
                </div>
            `;
        }).join('');

        if (data.count > 15) {
            container.innerHTML += `
                <div style="padding: 10px 16px; text-align: center; font-size: 12px; color: var(--text-muted);">
                    Showing 15 of ${data.count} results
                </div>
            `;
        }

        container.classList.add('visible');
    }, 300);
}

function openSearchResult(ticketNo, nicNo) {
    document.getElementById('searchResults').classList.remove('visible');
    document.getElementById('searchInput').value = '';

    if (ticketNo) {
        openLoanDetail(ticketNo);
    }
}

// ==================== LOAN DETAIL ====================

async function openLoanDetail(ticketNo) {
    const overlay = document.getElementById('detailOverlay');
    const panel = document.getElementById('detailPanel');
    const body = document.getElementById('detailBody');

    overlay.classList.add('visible');
    panel.classList.add('visible');
    body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    document.getElementById('detail-title').textContent = 'Loan Details';
    document.getElementById('detail-subtitle').textContent = ticketNo;

    let data = await apiGet(`/api/loan?ticket=${encodeURIComponent(ticketNo)}`);
    if (!data || data.error) {
        data = await apiGet(`/api/loan/${encodeURIComponent(ticketNo)}`);
    }
    if (!data || data.error) {
        body.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">Loan not found</div></div>';
        return;
    }

    body.innerHTML = `
        <!-- Customer Info -->
        <div class="detail-section">
            <div class="detail-section-title">👤 Customer Information</div>
            <div class="detail-grid">
                <div class="detail-field">
                    <div class="detail-field-label">NIC Number</div>
                    <div class="detail-field-value gold" style="cursor:pointer" onclick="viewCustomer('${data.nic_no}')">${data.nic_no || '-'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Name</div>
                    <div class="detail-field-value">${data.name || '-'}</div>
                </div>
                <div class="detail-field full">
                    <div class="detail-field-label">Address</div>
                    <div class="detail-field-value">${[data.address1, data.address2, data.address3].filter(Boolean).join(', ') || '-'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Mobile</div>
                    <div class="detail-field-value">${data.mobile_no || '-'}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Status</div>
                    <div class="detail-field-value"><span class="status-badge ${getStatusClass(data.status)}"><span class="status-dot"></span>${data.status || '-'}</span></div>
                </div>
            </div>
        </div>

        <!-- Loan Info -->
        <div class="detail-section">
            <div style="margin-bottom: 14px;">
                <button type="button" class="btn btn-primary-gold" onclick="loadLoanIntoBilling('${data.ticket_no}')" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px 14px; font-size:14px; font-weight:700; cursor:pointer;">
                    <span>🧾</span> Sell Gold / Generate Bill for this Loan
                </button>
            </div>
            <div class="detail-section-title">💰 Loan Details</div>
            <div class="detail-grid">
                <div class="detail-field">
                    <div class="detail-field-label">Ticket Number</div>
                    <div class="detail-field-value gold large">${data.ticket_no}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Grand Advance</div>
                    <div class="detail-field-value large">Rs. ${formatMoney(data.grand_advance)}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Period</div>
                    <div class="detail-field-value">${data.period || '-'} Months</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Articles</div>
                    <div class="detail-field-value">${data.num_articles || '-'} Items</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Pawned Date</div>
                    <div class="detail-field-value">${formatDate(data.pawned_date)}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Maturity Date</div>
                    <div class="detail-field-value">${formatDate(data.maturity_date)}</div>
                </div>
                ${data.redeemed_date ? `
                <div class="detail-field">
                    <div class="detail-field-label">Redeemed Date</div>
                    <div class="detail-field-value">${formatDate(data.redeemed_date)}</div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Redeemed Amount</div>
                    <div class="detail-field-value">Rs. ${formatMoney(data.redeemed_amount)}</div>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Charges -->
        <div class="detail-section">
            <div class="detail-section-title">📊 Charges & Fees</div>
            <div class="detail-grid">
                <div class="detail-field">
                    <div class="detail-field-label">Service Charge</div>
                    <div class="detail-field-value">Rs. ${formatMoney(data.service_charge_amount)} <span style="font-size:11px;color:var(--text-muted)">(${data.service_charge_days || 0} days)</span></div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Interest Charge</div>
                    <div class="detail-field-value">Rs. ${formatMoney(data.interest_amount)} <span style="font-size:11px;color:var(--text-muted)">(${data.interest_rate || '-'})</span></div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Late Charge</div>
                    <div class="detail-field-value">Rs. ${formatMoney(data.late_charge_amount)} <span style="font-size:11px;color:var(--text-muted)">(${data.late_charge_days || 0} days)</span></div>
                </div>
                <div class="detail-field">
                    <div class="detail-field-label">Settlement Paid</div>
                    <div class="detail-field-value">Rs. ${formatMoney(data.settlement_charge_paid)}</div>
                </div>
                ${data.to_be_redeemed_amount ? `
                <div class="detail-field full">
                    <div class="detail-field-label">To Be Redeemed Amount</div>
                    <div class="detail-field-value large gold">Rs. ${formatMoney(data.to_be_redeemed_amount)}</div>
                </div>` : ''}
            </div>
        </div>

        <!-- Articles -->
        ${data.articles && data.articles.length ? `
        <div class="detail-section">
            <div class="detail-section-title">💎 Gold Articles</div>
            <div class="article-list">
                ${data.articles.map(a => `
                    <div class="article-item">
                        <div class="article-icon">💍</div>
                        <div>
                            <div class="article-name">${a.article_name || 'Unknown'}</div>
                            <div class="article-meta">${a.karat ? a.karat + ' KT' : ''} ${a.weight ? '· ' + a.weight + 'g' : ''}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <!-- Other loans by same customer -->
        ${data.other_loans && data.other_loans.length ? `
        <div class="detail-section">
            <div class="detail-section-title">📋 Other Loans (Same Customer)</div>
            <div class="article-list">
                ${data.other_loans.map(l => `
                    <div class="other-loan-item" onclick="openLoanDetail('${l.ticket_no}')">
                        <div class="article-icon">🎫</div>
                        <div>
                            <div class="article-name">${l.ticket_no}</div>
                            <div class="article-meta">Rs. ${formatMoney(l.grand_advance)} · ${formatDate(l.pawned_date)}</div>
                        </div>
                        <span class="status-badge ${getStatusClass(l.status)}" style="font-size:10px"><span class="status-dot"></span>${l.status || '-'}</span>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
    `;
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('visible');
    document.getElementById('detailPanel').classList.remove('visible');
}

// ==================== LOANS PAGE ====================

async function loadLoans() {
    const data = await apiGet(`/api/loans?page=${loansState.page}&per_page=${loansState.perPage}&status=${loansState.status}&sort=${loansState.sort}&order=${loansState.order}`);
    if (!data) return;

    const tbody = document.getElementById('loansTableBody');
    document.getElementById('loans-table-title').textContent = `Loans (${formatMoney(data.total)})`;
    document.getElementById('loans-table-info').textContent = `Showing ${(data.page - 1) * data.per_page + 1}-${Math.min(data.page * data.per_page, data.total)} of ${data.total}`;

    if (!data.loans.length) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No loans found</div></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.loans.map(l => `
        <tr onclick="openLoanDetail('${l.ticket_no}')">
            <td><span class="ticket-num">${l.ticket_no || '-'}</span></td>
            <td><span class="nic-num">${l.nic_no || '-'}</span></td>
            <td>${l.name || '-'}</td>
            <td class="money">${formatMoney(l.grand_advance)}</td>
            <td>${l.period || '-'}M</td>
            <td><span class="status-badge ${getStatusClass(l.status)}"><span class="status-dot"></span>${l.status || '-'}</span></td>
            <td>${formatDate(l.pawned_date)}</td>
            <td>${formatDate(l.maturity_date)}</td>
            <td>${l.mobile_no || '-'}</td>
        </tr>
    `).join('');

    // Pagination
    renderPagination('loans-pagination', data.page, data.total_pages, (p) => {
        loansState.page = p;
        loadLoans();
    });
}

function filterLoans(status) {
    loansState.status = status;
    loansState.page = 1;

    // Update filter buttons
    document.querySelectorAll('.table-filter-btn').forEach(btn => {
        btn.classList.toggle('active', (status === '' && btn.textContent === 'All') || btn.textContent.toUpperCase() === status);
    });

    loadLoans();
}

function sortLoans(field) {
    if (loansState.sort === field) {
        loansState.order = loansState.order === 'asc' ? 'desc' : 'asc';
    } else {
        loansState.sort = field;
        loansState.order = 'desc';
    }
    loansState.page = 1;
    loadLoans();
}

// ==================== CUSTOMERS PAGE ====================

async function loadCustomers() {
    const data = await apiGet(`/api/customers?page=${customersState.page}&per_page=${customersState.perPage}`);
    if (!data) return;

    const tbody = document.getElementById('customersTableBody');
    document.getElementById('customers-table-info').textContent = `Showing ${(data.page - 1) * data.per_page + 1}-${Math.min(data.page * data.per_page, data.total)} of ${data.total}`;

    if (!data.customers.length) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No customers found</div></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.customers.map(c => `
        <tr onclick="viewCustomer('${c.nic_no}')" style="cursor:pointer">
            <td><span class="nic-num">${c.nic_no || '-'}</span></td>
            <td>${c.name || '-'}</td>
            <td>${[c.address1, c.address2].filter(Boolean).join(', ') || '-'}</td>
            <td>${c.mobile_no || '-'}</td>
            <td>${c.loan_count || 0}</td>
            <td>${c.active_loans || 0}</td>
            <td class="money">${formatMoney(c.total_advance)}</td>
        </tr>
    `).join('');

    renderPagination('customers-pagination', data.page, data.total_pages, (p) => {
        customersState.page = p;
        loadCustomers();
    });
}

// ==================== CUSTOMER DETAIL ====================

async function viewCustomer(nic) {
    if (!nic) return;
    closeDetail();

    navigate('customer-detail');

    const container = document.getElementById('customerDetailContent');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    const data = await apiGet(`/api/customer/${encodeURIComponent(nic)}`);
    if (!data || data.error) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">Customer not found</div></div>';
        return;
    }

    const c = data.customer;
    const s = data.summary;
    const initials = (c.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    container.innerHTML = `
        <div class="customer-hero animate-slide-up">
            <div class="customer-hero-top">
                <div class="customer-avatar">${initials}</div>
                <div class="customer-info">
                    <h2>${c.name || 'Unknown'}</h2>
                    <div class="nic-display">🪪 ${c.nic_no}</div>
                    <div class="address-display">📍 ${[c.address1, c.address2, c.address3].filter(Boolean).join(', ') || '-'}</div>
                    ${c.mobile_no ? `<div class="address-display">📱 ${c.mobile_no}</div>` : ''}
                </div>
            </div>
            <div class="customer-summary-grid">
                <div class="customer-summary-item">
                    <div class="customer-summary-value">${s.total_loans}</div>
                    <div class="customer-summary-label">Total Loans</div>
                </div>
                <div class="customer-summary-item">
                    <div class="customer-summary-value" style="color: var(--status-active)">${s.active_loans}</div>
                    <div class="customer-summary-label">Active Loans</div>
                </div>
                <div class="customer-summary-item">
                    <div class="customer-summary-value" style="color: var(--status-redeemed)">${s.redeemed_loans}</div>
                    <div class="customer-summary-label">Redeemed</div>
                </div>
                <div class="customer-summary-item">
                    <div class="customer-summary-value" style="color: var(--text-gold)">Rs. ${formatMoney(s.total_advance)}</div>
                    <div class="customer-summary-label">Total Advance</div>
                </div>
            </div>
        </div>

        <div class="table-card animate-slide-up" style="animation-delay: 0.1s">
            <div class="table-header">
                <div class="table-title">Loan History (${data.loans.length})</div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Ticket No</th>
                            <th>Advance</th>
                            <th>Status</th>
                            <th>Pawned</th>
                            <th>Maturity</th>
                            <th>Articles</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.loans.map(l => `
                            <tr onclick="openLoanDetail('${l.ticket_no}')" style="cursor:pointer">
                                <td><span class="ticket-num">${l.ticket_no}</span></td>
                                <td class="money">${formatMoney(l.grand_advance)}</td>
                                <td><span class="status-badge ${getStatusClass(l.status)}"><span class="status-dot"></span>${l.status || '-'}</span></td>
                                <td>${formatDate(l.pawned_date)}</td>
                                <td>${formatDate(l.maturity_date)}</td>
                                <td>${l.articles ? l.articles.map(a => a.article_name).join(', ') : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ==================== AUCTIONS PAGE ====================

async function loadAuctions() {
    const data = await apiGet('/api/auctions');
    if (!data) return;

    const tbody = document.getElementById('auctionsTableBody');

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">🔨</div><div class="empty-state-text">No auction items</div></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(a => `
        <tr onclick="openLoanDetail('${a.ticket_no}')">
            <td><span class="ticket-num">${a.ticket_no || '-'}</span></td>
            <td>${a.article_name || '-'}</td>
            <td>${a.karat || '-'} KT</td>
            <td>${a.weight || '-'}</td>
            <td class="money">${formatMoney(a.advance_amount)}</td>
            <td><span class="status-badge auction"><span class="status-dot"></span>${a.auction_status || 'AUCTION'}</span></td>
            <td>${formatDate(a.auction_date)}</td>
            <td class="money">${formatMoney(a.redeemed_amount)}</td>
        </tr>
    `).join('');
}

// ==================== GOLD RATES PAGE ====================

let currentGoldRatesData = [];

async function loadGoldRates() {
    const data = await apiGet('/api/gold-rates');
    if (!data) return;

    currentGoldRatesData = data;
    const grid = document.getElementById('goldRatesGrid');
    if (!grid) return;

    if (!data.length) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📈</div><div class="empty-state-text">No gold rate data</div></div>';
        return;
    }

    const now = new Date();
    const todayShort = `${now.getDate()} ${now.toLocaleDateString('en-GB', { month: 'short' })} ${now.getFullYear()}`;
    const timeShort = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    grid.innerHTML = data.map(r => `
        <div class="rate-card">
            <div class="rate-karat">${r.karat}</div>
            <div class="rate-karat-label">Karat</div>
            <div class="rate-price">Rs. ${formatMoney(r.price)}</div>
            <div class="rate-detail">CIB: Rs. ${formatMoney(r.cib_advance)} (${r.cib_rate ? (r.cib_rate * 100).toFixed(0) : '-'}%)</div>
            <div class="rate-detail">CG: Rs. ${formatMoney(r.cg_advance)} (${r.cg_rate ? (r.cg_rate * 100).toFixed(0) : '-'}%)</div>
            <div class="rate-card-today-tag">
                <span class="live-pulse-dot" style="width:6px;height:6px;"></span>
                <span>Today's Rate (${todayShort})</span>
            </div>
        </div>
    `).join('');

    const lastSyncEl = document.getElementById('ratesLastUpdatedText');
    if (lastSyncEl) {
        lastSyncEl.innerHTML = `<span style="color:#10b981;">● Synced live at ${timeShort}</span>`;
    }
}

// Modal functions for updating Today's Gold Rates
function openUpdateRatesModal() {
    const modal = document.getElementById('updateRatesModal');
    if (!modal) return;
    
    // Find current 22k price
    let p22 = 344000;
    if (currentGoldRatesData && currentGoldRatesData.length) {
        const r22 = currentGoldRatesData.find(x => parseInt(x.karat) === 22);
        if (r22 && r22.price) p22 = Math.round(r22.price);
    }
    
    const input22 = document.getElementById('modalPrice22k');
    if (input22) {
        input22.value = p22;
    }
    
    const msgEl = document.getElementById('modalRatesMsg');
    if (msgEl) {
        msgEl.style.display = 'none';
        msgEl.textContent = '';
    }
    
    previewCalculatedRates();
    modal.style.display = 'flex';
}

function closeUpdateRatesModal() {
    const modal = document.getElementById('updateRatesModal');
    if (modal) modal.style.display = 'none';
}

function previewCalculatedRates() {
    const input = document.getElementById('modalPrice22k');
    const grid = document.getElementById('modalRatesPreviewGrid');
    if (!input || !grid) return;

    const p22 = parseFloat(input.value) || 0;
    if (p22 <= 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#888; font-size:12px; padding:10px;">Enter a valid 22KT price to preview breakdown</div>';
        return;
    }

    const karats = [24, 22, 21, 20, 19, 18, 17, 16];
    grid.innerHTML = karats.map(kt => {
        const price = Math.round((p22 / 22.0) * kt);
        const cib = Math.round(price * 0.70);
        const is22 = kt === 22;
        return `
            <div style="background:${is22 ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${is22 ? 'var(--gold-500)' : 'rgba(255,255,255,0.08)'}; border-radius:6px; padding:8px; text-align:center;">
                <div style="font-size:12px; font-weight:800; color:${is22 ? 'var(--gold-400)' : '#fff'};">${kt} KT</div>
                <div style="font-size:13px; font-weight:700; color:#fff; margin:2px 0;">Rs. ${formatMoney(price)}</div>
                <div style="font-size:10px; color:var(--text-muted);">CIB: Rs. ${formatMoney(cib)}</div>
            </div>
        `;
    }).join('');
}

async function saveTodayGoldRates() {
    const input = document.getElementById('modalPrice22k');
    const msgEl = document.getElementById('modalRatesMsg');
    const btn = document.getElementById('btnSaveTodayRates');
    
    const p22 = parseFloat(input.value) || 0;
    if (p22 <= 0) {
        if (msgEl) {
            msgEl.style.display = 'block';
            msgEl.style.background = 'rgba(239,68,68,0.15)';
            msgEl.style.color = '#f87171';
            msgEl.textContent = 'Please enter a valid positive 22K base rate.';
        }
        return;
    }

    if (btn) btn.disabled = true;
    if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(212,175,55,0.15)';
        msgEl.style.color = 'var(--gold-400)';
        msgEl.textContent = 'Saving today\'s rates...';
    }

    const res = await apiPost('/api/gold-rates/update', { price_22k: p22 });
    if (btn) btn.disabled = false;

    if (res && res.success) {
        if (msgEl) {
            msgEl.style.background = 'rgba(16,185,129,0.15)';
            msgEl.style.color = '#10b981';
            msgEl.textContent = '✓ ' + res.message;
        }
        
        // Refresh rates grid and billing state
        await loadGoldRates();
        if (typeof initBillingPage === 'function') {
            await initBillingPage();
        }

        setTimeout(() => {
            closeUpdateRatesModal();
        }, 1200);
    } else {
        if (msgEl) {
            msgEl.style.background = 'rgba(239,68,68,0.15)';
            msgEl.style.color = '#f87171';
            msgEl.textContent = (res && res.error) ? res.error : 'Failed to update rates. Please try again.';
        }
    }
}

// ==================== PRODUCT RATES PAGE ====================

async function loadProductRates() {
    const data = await apiGet('/api/product-rates');
    if (!data) return;

    const tbody = document.getElementById('productRatesBody');

    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-text">No product rate data</div></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td style="font-weight:600; color: var(--text-gold)">${r.karat} KT</td>
            <td>${r.period_months} Months</td>
            <td class="money">${formatMoney(r.advance_amount)}</td>
            <td style="color: var(--text-gold); font-weight: 600">${r.monthly_rate ? (r.monthly_rate * 100).toFixed(2) : '-'}%</td>
        </tr>
    `).join('');
}

// ==================== PAGINATION ====================

function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let buttons = [];

    // Previous
    buttons.push(`<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="event.stopPropagation()">‹</button>`);

    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        buttons.push(`<button class="page-btn" data-page="1">1</button>`);
        if (startPage > 2) buttons.push(`<button class="page-btn" disabled>...</button>`);
    }

    for (let i = startPage; i <= endPage; i++) {
        buttons.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) buttons.push(`<button class="page-btn" disabled>...</button>`);
        buttons.push(`<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`);
    }

    // Next
    buttons.push(`<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="event.stopPropagation()">›</button>`);

    container.innerHTML = buttons.join('');

    // Add click handlers
    container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onPageChange(parseInt(btn.dataset.page));
        });
    });

    // Prev/Next
    const prevBtn = container.querySelector('.page-btn:first-child');
    const nextBtn = container.querySelector('.page-btn:last-child');
    if (prevBtn && !prevBtn.disabled) {
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
    }
    if (nextBtn && !nextBtn.disabled) {
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
    }
}

// ================================================================
// ==================== BILLING & INVOICING SYSTEM =================
// ================================================================

let billingState = {
    currentCustomer: null,
    loanArticles: [],
    items: [],
    liveRates: { 24: 46900, 22: 43000, 21: 41045, 20: 39090, 18: 35180 },
    activeTab: 'new',
    historyPage: 1,
    historyPerPage: 15,
    historySearchDebounce: null,
    activeInvoiceForPrint: null
};

async function initBillingPage() {
    // Fetch live gold rates
    const rates = await apiGet('/api/gold-rates');
    if (rates && rates.length) {
        rates.forEach(r => {
            const k = parseInt(r.karat);
            if (k && r.price) {
                billingState.liveRates[k] = Math.round(parseFloat(r.price) / 8.0);
            }
        });
        // Estimate 24K if not present
        if (!billingState.liveRates[24] && billingState.liveRates[22]) {
            billingState.liveRates[24] = Math.round((billingState.liveRates[22] / 22) * 24);
        }
    }
    
    updateCustomRateByKarat();
    calculateCustomItemPrice();
    loadBillingHistoryCount();

    // Close customer search dropdown on outside click
    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('billingSearchDropdown');
        const box = document.getElementById('billCustomerSearchBox');
        if (wrap && box && !box.contains(e.target)) {
            wrap.classList.remove('visible');
        }
    });
}

function switchBillingTab(tab) {
    billingState.activeTab = tab;
    document.getElementById('tabNewBill').classList.toggle('active', tab === 'new');
    document.getElementById('tabHistory').classList.toggle('active', tab === 'history');
    const tabDaily = document.getElementById('tabDailyReport');
    if (tabDaily) tabDaily.classList.toggle('active', tab === 'daily');
    
    document.getElementById('billingNewSection').style.display = tab === 'new' ? 'block' : 'none';
    document.getElementById('billingHistorySection').style.display = tab === 'history' ? 'block' : 'none';
    const dailySec = document.getElementById('billingDailySection');
    if (dailySec) dailySec.style.display = tab === 'daily' ? 'block' : 'none';

    if (tab === 'history') {
        loadBillingHistory();
    } else if (tab === 'daily') {
        loadDailySalesReport();
    }
}

// ----------------- Daily Sales Report -----------------

function getTodayIsoString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function setDailyReportToday() {
    const picker = document.getElementById('dailyReportDatePicker');
    if (picker) {
        picker.value = getTodayIsoString();
        loadDailySalesReport();
    }
}

function setDailyReportYesterday() {
    const picker = document.getElementById('dailyReportDatePicker');
    if (picker) {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        picker.value = `${y}-${m}-${day}`;
        loadDailySalesReport();
    }
}

async function loadDailySalesReport() {
    const picker = document.getElementById('dailyReportDatePicker');
    if (picker && !picker.value) {
        picker.value = getTodayIsoString();
    }
    const dateVal = picker && picker.value ? picker.value : getTodayIsoString();
    const subTitle = document.getElementById('dailySalesTableSubtitle');
    if (subTitle) subTitle.textContent = `Showing all bills created on ${dateVal}`;

    const tbody = document.getElementById('dailySalesTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:30px;">Loading daily sales data...</td></tr>';

    try {
        const data = await apiGet(`/api/reports/daily-sales?date=${encodeURIComponent(dateVal)}`);
        if (!data || !data.summary) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:30px; color:var(--text-muted);">Failed to load daily report.</td></tr>';
            return;
        }

        const sum = data.summary;
        const setTxt = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        setTxt('dailyTotalInvoices', sum.total_bills || 0);
        setTxt('dailyTotalWeight', `${(sum.total_weight || 0).toFixed(2)} g gold sold`);
        setTxt('dailyTotalSales', `Rs. ${formatMoney(sum.total_sales || 0)}`);
        setTxt('dailySubtotal', `Subtotal: Rs. ${formatMoney(sum.total_subtotal || 0)}`);
        setTxt('dailyCallCharges', `Rs. ${formatMoney(sum.total_call_charges || 0)}`);
        setTxt('dailyDiscount', `Rs. ${formatMoney(sum.total_discount || 0)}`);
        setTxt('dailyCashCollected', `Rs. ${formatMoney(sum.total_paid || 0)}`);

        const bills = data.bills || [];
        if (!bills.length) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:35px; color:var(--text-secondary);">
                No invoices recorded on <strong>${dateVal}</strong>.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = bills.map(b => {
            const timeStr = b.created_at ? (b.created_at.includes(' ') ? b.created_at.split(' ')[1] : b.created_at) : '-';
            return `
                <tr>
                    <td style="font-family:monospace; font-weight:700; color:var(--text-gold);">${b.bill_no}</td>
                    <td>${timeStr}</td>
                    <td style="font-weight:600; color:var(--text-primary);">${b.customer_name || '-'}</td>
                    <td style="font-family:monospace; font-size:12px;">${b.nic_no || '-'}</td>
                    <td style="font-family:monospace; font-size:12px; color:var(--text-secondary);">${b.ticket_no || '-'}</td>
                    <td style="font-size:12px; max-width:180px; white-space:normal;">${b.articles_summary || '-'}</td>
                    <td class="money">Rs. ${formatMoney(b.subtotal)}</td>
                    <td class="money" style="color:var(--text-gold);">${b.call_charges ? 'Rs. ' + formatMoney(b.call_charges) : '-'}</td>
                    <td class="money" style="color:#ef4444;">${b.discount ? '- Rs. ' + formatMoney(b.discount) : '-'}</td>
                    <td class="money" style="font-weight:700; color:#10b981;">Rs. ${formatMoney(b.grand_total)}</td>
                    <td><span class="status-badge status-active" style="font-size:11px;">${b.payment_method || 'Cash'}</span></td>
                    <td>
                        <button type="button" class="btn btn-secondary" onclick="viewBillDetails('${b.bill_no}')" style="padding:4px 8px; font-size:11px;">
                            👁️ View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:#ef4444; padding:30px;">Error: ${e.message}</td></tr>`;
    }
}

function downloadDailySalesExcel() {
    const picker = document.getElementById('dailyReportDatePicker');
    const dateVal = picker && picker.value ? picker.value : getTodayIsoString();
    window.location.href = `/api/reports/daily-sales/export?date=${encodeURIComponent(dateVal)}`;
}

async function loadBillingHistoryCount() {
    const data = await apiGet('/api/bills?per_page=1');
    if (data && data.total != null) {
        const badge = document.getElementById('billingHistoryCount');
        if (badge) badge.textContent = data.total;
    }
}

// ----------------- Customer Search for Billing -----------------

let billingSearchDebounceTimer = null;
function handleBillingSearch(immediate = false) {
    const sInput = document.getElementById('billCustomerSearchInput');
    const rawVal = sInput ? sInput.value : '';
    const query = rawVal.trim();
    const dropdown = document.getElementById('billingSearchDropdown');

    // If query is empty or just the prefix, don't popup "No matching found"
    if (!query || query === 'L/PW/UH/' || query === 'L/PW/UH' || query.length < 2) {
        if (dropdown) {
            dropdown.classList.remove('visible');
            dropdown.innerHTML = '';
        }
        return;
    }

    if (billingSearchDebounceTimer) clearTimeout(billingSearchDebounceTimer);

    const performSearch = async () => {
        dropdown.innerHTML = '<div style="padding:12px; color:var(--text-muted); text-align:center;">Searching loans & customers...</div>';
        dropdown.classList.add('visible');

        const data = await apiGet(`/api/billing/customer-search?q=${encodeURIComponent(query)}`);
        if (!data || !data.results || !data.results.length) {
            dropdown.innerHTML = '<div style="padding:12px; color:var(--text-muted); text-align:center;">No matching customer or ticket found. You can enter details manually below.</div>';
            return;
        }

        // If user pressed Enter and there is only 1 match, auto-fill immediately!
        if (immediate && data.results.length === 1) {
            window._lastBillingSearchResults = data.results;
            selectLoanForBillingByIndex(0);
            return;
        }

        dropdown.innerHTML = data.results.map((loan, idx) => {
            const articlesSummary = (loan.articles || []).map(a => `${a.article_name} (${a.karat || 22}K, ${a.weight}g)`).join(', ');
            return `
                <div class="search-dropdown-item" onclick="selectLoanForBillingByIndex(${idx})">
                    <div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:13.5px;">
                            ${loan.name || 'Unknown'} 
                            <span class="nic-num" style="font-size:12px; margin-left:6px;">🪪 ${loan.nic_no || '-'}</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                            Ticket: <strong style="color:var(--text-gold); font-family:monospace;">${loan.ticket_no}</strong> · Advance: <strong>Rs. ${formatMoney(loan.grand_advance)}</strong> · Status: <span class="status-badge ${getStatusClass(loan.status)}" style="font-size:10px;">${loan.status}</span>
                        </div>
                        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                            Articles (${(loan.articles || []).length}): ${articlesSummary || 'None listed'}
                        </div>
                    </div>
                    <button type="button" class="btn btn-gold" style="font-size:11px; padding:4px 10px;">Select ➔</button>
                </div>
            `;
        }).join('');

        window._lastBillingSearchResults = data.results;
    };

    if (immediate) {
        performSearch();
    } else {
        billingSearchDebounceTimer = setTimeout(performSearch, 300);
    }
}

let nicAutoFillDebounce = null;
async function handleNicAutoFill(nic) {
    if (!nic) return;
    nic = nic.trim();
    if (nic.length < 9) return;
    
    if (nicAutoFillDebounce) clearTimeout(nicAutoFillDebounce);
    nicAutoFillDebounce = setTimeout(async () => {
        try {
            const data = await apiGet(`/api/billing/customer-search?q=${encodeURIComponent(nic)}`);
            if (data && data.results && data.results.length > 0) {
                const match = data.results.find(r => r.nic_no && r.nic_no.toLowerCase() === nic.toLowerCase()) || data.results[0];
                if (match) {
                    const nameEl = document.getElementById('billCustomerName');
                    const phoneEl = document.getElementById('billCustomerPhone');
                    const addrEl = document.getElementById('billCustomerAddress');
                    const ticketEl = document.getElementById('billTicketNo');
                    if (nameEl && !nameEl.value) nameEl.value = match.name || '';
                    if (phoneEl && !phoneEl.value) phoneEl.value = match.mobile_no || '';
                    if (addrEl && !addrEl.value) addrEl.value = [match.address1, match.address2, match.address3].filter(Boolean).join(', ') || '';
                    if (ticketEl && !ticketEl.value && match.ticket_no) ticketEl.value = match.ticket_no;
                }
            }
        } catch(e) {}
    }, 350);
}

function selectLoanForBillingByIndex(idx) {
    if (window._lastBillingSearchResults && window._lastBillingSearchResults[idx]) {
        populateCustomerLoanBilling(window._lastBillingSearchResults[idx]);
    }
    const dropdown = document.getElementById('billingSearchDropdown');
    if (dropdown) dropdown.classList.remove('visible');
}

function populateCustomerLoanBilling(loan) {
    billingState.currentCustomer = loan;
    billingState.loanArticles = loan.articles || [];

    // Fill form fields
    document.getElementById('billCustomerName').value = loan.name || '';
    document.getElementById('billCustomerNic').value = loan.nic_no || '';
    document.getElementById('billCustomerPhone').value = loan.mobile_no || loan.cust_mobile || loan.phone_no || '';
    document.getElementById('billCustomerAddress').value = [loan.address1, loan.address2, loan.address3].filter(Boolean).join(', ') || '';
    document.getElementById('billTicketNo').value = loan.ticket_no || '';

    // Show loan articles card
    const articlesCard = document.getElementById('loanArticlesCard');
    const badge = document.getElementById('loanArticlesBadge');
    const tbody = document.getElementById('loanArticlesTableBody');

    if (billingState.loanArticles.length > 0) {
        articlesCard.style.display = 'block';
        badge.textContent = `${billingState.loanArticles.length} items available`;

        tbody.innerHTML = billingState.loanArticles.map((art, idx) => `
            <tr>
                <td style="font-weight:600; color:var(--text-primary);">${art.article_name || 'Gold Item'}</td>
                <td><span style="color:var(--text-gold); font-weight:700;">${art.karat || 22} KT</span></td>
                <td>${art.weight || 0} g</td>
                <td class="money">${formatMoney(art.estimated_rate_per_gram)}</td>
                <td class="money" style="font-weight:700; color:var(--text-gold);">${formatMoney(art.estimated_value)}</td>
                <td>
                    <button type="button" class="btn btn-gold" onclick="addLoanArticleToBill(${idx})" style="padding:4px 8px; font-size:11.5px;">
                        ➕ Add
                    </button>
                </td>
            </tr>
        `).join('');

        // If interest or settlement amount available in loan, suggest it
        if (loan.interest_amount) {
            document.getElementById('billInterestAmount').value = Math.round(loan.interest_amount);
        }
        document.getElementById('loanRedeemToggleRow').style.display = 'flex';
    } else {
        articlesCard.style.display = 'none';
        document.getElementById('loanRedeemToggleRow').style.display = 'none';
    }
}

async function loadLoanIntoBilling(ticketNo) {
    closeDetail();
    navigate('billing');
    switchBillingTab('new');

    const searchInput = document.getElementById('billCustomerSearchInput');
    if (searchInput) searchInput.value = ticketNo;

    const data = await apiGet(`/api/billing/customer-search?q=${encodeURIComponent(ticketNo)}`);
    if (data && data.results && data.results.length) {
        populateCustomerLoanBilling(data.results[0]);
        // Automatically add all its articles to the current bill!
        if (data.results[0].articles && data.results[0].articles.length) {
            data.results[0].articles.forEach(art => {
                const k = parseInt(art.karat || 22);
                const rate = art.estimated_rate_per_gram || billingState.liveRates[k] || 43000;
                const wt = parseFloat(art.weight || 0);
                billingState.items.push({
                    article_name: art.article_name || 'Pledged Gold Article',
                    karat: k,
                    weight: wt,
                    rate_per_gram: rate,
                    total_price: Math.round(wt * rate),
                    ticket_no: data.results[0].ticket_no
                });
            });
            renderBillItems();
        }
    }
}

function resetCustomerSelection() {
    billingState.currentCustomer = null;
    billingState.loanArticles = [];
    document.getElementById('billCustomerSearchInput').value = 'L/PW/UH/';
    document.getElementById('billCustomerName').value = '';
    document.getElementById('billCustomerNic').value = '';
    document.getElementById('billCustomerPhone').value = '';
    document.getElementById('billCustomerAddress').value = '';
    document.getElementById('billTicketNo').value = '';
    document.getElementById('loanArticlesCard').style.display = 'none';
    document.getElementById('loanRedeemToggleRow').style.display = 'none';
    const dd = document.getElementById('billingSearchDropdown');
    if (dd) {
        dd.classList.remove('visible');
        dd.innerHTML = '';
    }
}

// ----------------- Article Add / Remove / Calculate -----------------

function addLoanArticleToBill(index) {
    const art = billingState.loanArticles[index];
    if (!art) return;

    const k = parseInt(art.karat || 22);
    const rate = art.estimated_rate_per_gram || billingState.liveRates[k] || 43000;
    const wt = parseFloat(art.weight || 0);

    billingState.items.push({
        article_name: art.article_name || 'Pledged Gold Article',
        karat: k,
        weight: wt,
        rate_per_gram: rate,
        total_price: Math.round(wt * rate),
        ticket_no: document.getElementById('billTicketNo').value || ''
    });

    renderBillItems();
}

// ----------------- Standard Article Names Autocomplete & Dropdown -----------------

const STANDARD_ARTICLE_NAMES = [
    "BANGLE",
    "BOX CHAIN",
    "BRACELAT",
    "BRACELET",
    "BRACELET With Pendant",
    "CHAIN",
    "CHAIN (BOX)",
    "CHAIN (DIAMOND)",
    "CHAIN (DIAMOND) WITH A PENDANT",
    "CHAIN (LINK)",
    "CHAIN (MACHINE CUT)",
    "CHAIN (MACHINE CUT) WITH A PENDANT",
    "CHAIN (SP)",
    "Chain with pendant",
    "Chain with S/Pendant",
    "Chain with Stone pendant",
    "Chain-Machine Cut",
    "Coin Pendant",
    "D/CHAIN",
    "Diamond Chain",
    "EARING",
    "EARRING",
    "EARRINGS",
    "GYPSYS",
    "GYPSYS With Tussel",
    "GYPSYS WITH TUSSELS",
    "MULTY",
    "NECKLAS With Tussels",
    "PANCHAYUDA",
    "PENDANT",
    "PENDANT (SURA)",
    "PENDENT",
    "RING",
    "RING (STONE)",
    "S/EARRINGS/pendant",
    "S/Ring",
    "SP CHAIN"
];

function showArticleDropdown() {
    renderArticleDropdown(document.getElementById('customArticleName').value || '');
}

function toggleArticleDropdown(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const dd = document.getElementById('articleCustomDropdown');
    if (!dd) return;
    if (dd.style.display === 'block') {
        dd.style.display = 'none';
    } else {
        renderArticleDropdown('');
        dd.style.display = 'block';
    }
}

function filterArticleDropdown(query) {
    renderArticleDropdown(query);
}

function renderArticleDropdown(query) {
    const dd = document.getElementById('articleCustomDropdown');
    if (!dd) return;
    const q = (query || '').toLowerCase().trim();
    const filtered = STANDARD_ARTICLE_NAMES.filter(item => !q || item.toLowerCase().includes(q));

    if (!filtered.length) {
        dd.innerHTML = '<div style="padding:10px 14px; font-size:12px; color:var(--text-muted); text-align:center;">No match found (type manual name)</div>';
    } else {
        dd.innerHTML = filtered.map(name => {
            const escaped = name.replace(/'/g, "\\'");
            return `
                <div class="search-dropdown-item" onclick="selectStandardArticle('${escaped}')" style="padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center; transition:background 0.15s;">
                    <span style="color:var(--text-primary);">💍 ${name}</span>
                    <span style="font-size:10px; color:var(--text-gold); background:rgba(234,179,8,0.12); padding:2px 8px; border-radius:4px; font-weight:700;">Select</span>
                </div>
            `;
        }).join('');
    }
    dd.style.display = 'block';
}

function selectStandardArticle(name) {
    const input = document.getElementById('customArticleName');
    if (input) {
        input.value = name;
        input.focus();
    }
    const dd = document.getElementById('articleCustomDropdown');
    if (dd) dd.style.display = 'none';
}

// Global click listener to close article dropdown
document.addEventListener('click', (e) => {
    const dd = document.getElementById('articleCustomDropdown');
    const input = document.getElementById('customArticleName');
    if (dd && dd.style.display === 'block') {
        if (!dd.contains(e.target) && e.target !== input) {
            dd.style.display = 'none';
        }
    }
});

function updateCustomRateByKarat() {
    const kInput = document.getElementById('customArticleKarat');
    const karat = parseFloat(kInput ? kInput.value : 22) || 22;
    const rounded = Math.round(karat);
    let rate = billingState.liveRates[rounded];
    if (!rate) {
        const base22 = billingState.liveRates[22] || 43000;
        rate = Math.round((base22 / 22) * karat);
    }
    const rateEl = document.getElementById('customArticleRate');
    if (rateEl) rateEl.value = rate || 43000;
    calculateCustomItemPrice();
}

function calculateCustomItemPrice() {
    const weight = parseFloat(document.getElementById('customArticleWeight').value || 0);
    const rate = parseFloat(document.getElementById('customArticleRate').value || 0);
    const total = Math.round(weight * rate);
    const disp = document.getElementById('customItemTotalDisplay');
    if (disp) disp.textContent = `Rs. ${formatMoney(total)}`;
}

function addCustomItemToBill() {
    const name = (document.getElementById('customArticleName').value || '').trim() || 'Custom Gold Article';
    const karat = parseFloat(document.getElementById('customArticleKarat').value || 22);
    const weight = parseFloat(document.getElementById('customArticleWeight').value || 0);
    const rate = parseFloat(document.getElementById('customArticleRate').value || 0);

    if (weight <= 0) {
        alert('Please enter a valid weight in grams greater than 0.');
        return;
    }
    if (rate <= 0) {
        alert('Please enter a valid price rate per gram.');
        return;
    }

    const total = Math.round(weight * rate);

    billingState.items.push({
        article_name: name,
        karat: karat,
        weight: weight,
        rate_per_gram: rate,
        total_price: total,
        ticket_no: document.getElementById('billTicketNo').value || ''
    });

    renderBillItems();

    // Reset name to default
    document.getElementById('customArticleName').value = 'Gold Article';
}

function removeBillItem(index) {
    billingState.items.splice(index, 1);
    renderBillItems();
}

function renderBillItems() {
    const container = document.getElementById('billItemsList');
    const badge = document.getElementById('billItemCountBadge');

    badge.textContent = `${billingState.items.length} Items`;

    if (!billingState.items.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding:24px 10px;">
                <div class="empty-state-icon" style="font-size:2rem;">💍</div>
                <div class="empty-state-text" style="font-size:13px;">No articles in bill yet. Select from customer loan or add a custom article above.</div>
            </div>
        `;
        recalculateBill();
        return;
    }

    container.innerHTML = billingState.items.map((item, idx) => `
        <div class="bill-cart-item">
            <div style="flex:1;">
                <div class="bill-cart-item-title">${item.article_name}</div>
                <div class="bill-cart-item-meta">
                    <span style="color:var(--text-gold); font-weight:600;">${item.karat} KT</span> · 
                    Weight: <strong>${item.weight}g</strong> @ Rs. ${formatMoney(item.rate_per_gram)}/g
                    ${item.ticket_no ? `· Ref: ${item.ticket_no}` : ''}
                </div>
            </div>
            <div class="bill-cart-item-price">Rs. ${formatMoney(item.total_price)}</div>
            <button type="button" class="btn-remove-item" onclick="removeBillItem(${idx})" title="Remove">✕</button>
        </div>
    `).join('');

    recalculateBill();
}

function recalculateBill() {
    const subtotal = billingState.items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const serviceCharge = parseFloat(document.getElementById('billServiceCharge').value || 0);
    const interest = parseFloat(document.getElementById('billInterestAmount').value || 0);
    const discount = parseFloat(document.getElementById('billDiscount').value || 0);
    const callCharges = parseFloat(document.getElementById('billCallCharges') ? document.getElementById('billCallCharges').value || 0 : 0);

    const grandTotal = Math.max(0, subtotal + serviceCharge + interest + callCharges - discount);

    document.getElementById('billSubtotalDisplay').textContent = `Rs. ${formatMoney(subtotal)}`;
    document.getElementById('billGrandTotalDisplay').textContent = `Rs. ${formatMoney(grandTotal)}`;

    const paidInput = document.getElementById('billPaidAmount');
    if (!paidInput.value || parseFloat(paidInput.value) === 0) {
        paidInput.placeholder = Math.round(grandTotal).toString();
    }

    recalculateChange();
}

function recalculateChange() {
    const grandTotalStr = document.getElementById('billGrandTotalDisplay').textContent.replace(/[^\d.]/g, '');
    const grandTotal = parseFloat(grandTotalStr) || 0;
    const paidInput = document.getElementById('billPaidAmount');
    const paidAmount = paidInput.value !== '' ? parseFloat(paidInput.value) : grandTotal;

    const change = paidAmount - grandTotal;
    const changeDisplay = document.getElementById('billChangeDisplay');

    if (change >= 0) {
        changeDisplay.textContent = `Rs. ${formatMoney(change)}`;
        changeDisplay.style.color = 'var(--status-active)';
    } else {
        changeDisplay.textContent = `- Rs. ${formatMoney(Math.abs(change))} (Underpaid)`;
        changeDisplay.style.color = 'var(--status-auction)';
    }
}

function resetEntireBill() {
    if (billingState.items.length > 0 && !confirm('Are you sure you want to clear this bill?')) {
        return;
    }
    billingState.items = [];
    document.getElementById('billServiceCharge').value = '0';
    document.getElementById('billInterestAmount').value = '0';
    document.getElementById('billDiscount').value = '0';
    if (document.getElementById('billCallCharges')) document.getElementById('billCallCharges').value = '0';
    document.getElementById('billPaidAmount').value = '';
    document.getElementById('billNotes').value = '';
    renderBillItems();
}

// ----------------- Submit & Print Invoices -----------------

async function submitAndPrintBill() {
    await processBillSubmission(true);
}

async function submitBillOnly() {
    await processBillSubmission(false);
}

async function processBillSubmission(printAfter) {
    const custName = (document.getElementById('billCustomerName').value || '').trim();
    if (!custName) {
        alert('Please enter or select a Customer Name before generating the bill.');
        document.getElementById('billCustomerName').focus();
        return;
    }

    if (!billingState.items.length) {
        alert('Please add at least one gold article item to the bill.');
        return;
    }

    const subtotal = billingState.items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const serviceCharge = parseFloat(document.getElementById('billServiceCharge').value || 0);
    const interest = parseFloat(document.getElementById('billInterestAmount').value || 0);
    const discount = parseFloat(document.getElementById('billDiscount').value || 0);
    const callCharges = parseFloat(document.getElementById('billCallCharges') ? document.getElementById('billCallCharges').value || 0 : 0);
    const grandTotal = Math.max(0, subtotal + serviceCharge + interest + callCharges - discount);

    const paidInputVal = document.getElementById('billPaidAmount').value;
    const paidAmount = paidInputVal !== '' ? parseFloat(paidInputVal) : grandTotal;

    const payload = {
        customer_name: custName,
        nic_no: (document.getElementById('billCustomerNic').value || '').trim(),
        customer_phone: (document.getElementById('billCustomerPhone').value || '').trim(),
        customer_address: (document.getElementById('billCustomerAddress').value || '').trim(),
        ticket_no: (document.getElementById('billTicketNo').value || '').trim(),
        bill_type: document.getElementById('billTicketNo').value ? 'LOAN_SETTLEMENT_AND_SALE' : 'DIRECT_GOLD_SALE',
        subtotal: subtotal,
        service_charge: serviceCharge,
        interest_amount: interest,
        discount: discount,
        call_charges: callCharges,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        payment_method: document.getElementById('billPaymentMethod').value || 'Cash',
        cashier: (document.getElementById('billCashier').value || '').trim() || 'Authorized Cashier',
        notes: (document.getElementById('billNotes').value || '').trim(),
        mark_loan_redeemed: document.getElementById('billMarkLoanRedeemed') ? document.getElementById('billMarkLoanRedeemed').checked : false,
        items: billingState.items
    };

    try {
        const response = await fetch('/api/bills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to save bill.');
        }

        const savedBill = result.bill;
        loadBillingHistoryCount();

        if (printAfter) {
            showInvoiceModal(savedBill, true);
        } else {
            alert(`✅ Bill ${savedBill.bill_no} successfully generated and saved!`);
        }

        // Reset the form
        resetCustomerSelection();
        billingState.items = [];
        document.getElementById('billServiceCharge').value = '0';
        document.getElementById('billInterestAmount').value = '0';
        document.getElementById('billDiscount').value = '0';
        if (document.getElementById('billCallCharges')) document.getElementById('billCallCharges').value = '0';
        document.getElementById('billPaidAmount').value = '';
        document.getElementById('billNotes').value = '';
        renderBillItems();

    } catch (err) {
        console.error('Bill submission error:', err);
        alert(`❌ Error creating bill: ${err.message}`);
    }
}

// ----------------- Printable Invoice Modal & Print -----------------

function showInvoiceModal(bill, autoPrint = false) {
    billingState.activeInvoiceForPrint = bill;

    document.getElementById('invDisplayNumber').textContent = bill.bill_no || '-';
    document.getElementById('invDisplayDateTime').textContent = formatDate(bill.created_at) + ' ' + (bill.created_at ? bill.created_at.substring(11, 16) : '');
    
    document.getElementById('invCustomerName').textContent = bill.customer_name || 'Walk-in Customer';
    document.getElementById('invCustomerNic').textContent = bill.nic_no || 'N/A';
    document.getElementById('invCustomerPhone').textContent = bill.customer_phone || '-';
    document.getElementById('invCustomerAddress').textContent = bill.customer_address || '-';
    
    document.getElementById('invBillType').textContent = (bill.bill_type || 'Gold Sale').replace(/_/g, ' ');
    document.getElementById('invTicketNo').textContent = bill.ticket_no || 'Direct Transaction';
    document.getElementById('invPaymentMode').textContent = bill.payment_method || 'Cash';
    document.getElementById('invCashier').textContent = bill.cashier || 'Authorized Officer';

    // Items
    const itemsTbody = document.getElementById('invItemsTableBody');
    const items = bill.items || [];
    itemsTbody.innerHTML = items.map((it, idx) => `
        <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${it.article_name}</strong> ${it.notes ? `<br><small style="color:#666;">${it.notes}</small>` : ''}</td>
            <td style="text-align:center;">${it.karat || '22'} KT</td>
            <td style="text-align:right;">${parseFloat(it.weight || 0).toFixed(2)} g</td>
            <td style="text-align:right;">Rs. ${formatMoney(it.rate_per_gram)}</td>
            <td style="text-align:right; font-weight:700;">Rs. ${formatMoney(it.total_price)}</td>
        </tr>
    `).join('');

    // Summary
    document.getElementById('invSubtotal').textContent = `Rs. ${formatMoney(bill.subtotal)}`;

    const scRow = document.getElementById('invServiceChargeRow');
    if (bill.service_charge > 0) {
        scRow.style.display = 'flex';
        document.getElementById('invServiceCharge').textContent = `Rs. ${formatMoney(bill.service_charge)}`;
    } else {
        scRow.style.display = 'none';
    }

    const intRow = document.getElementById('invInterestRow');
    if (bill.interest_amount > 0) {
        intRow.style.display = 'flex';
        document.getElementById('invInterest').textContent = `Rs. ${formatMoney(bill.interest_amount)}`;
    } else {
        intRow.style.display = 'none';
    }

    const discRow = document.getElementById('invDiscountRow');
    if (bill.discount > 0) {
        discRow.style.display = 'flex';
        document.getElementById('invDiscount').textContent = `- Rs. ${formatMoney(bill.discount)}`;
    } else {
        discRow.style.display = 'none';
    }

    const callRow = document.getElementById('invCallChargesRow');
    if (bill.call_charges > 0) {
        if (callRow) {
            callRow.style.display = 'flex';
            document.getElementById('invCallCharges').textContent = `Rs. ${formatMoney(bill.call_charges)}`;
        }
    } else {
        if (callRow) callRow.style.display = 'none';
    }

    document.getElementById('invGrandTotal').textContent = `Rs. ${formatMoney(bill.grand_total)}`;
    document.getElementById('invPaidAmount').textContent = `Rs. ${formatMoney(bill.paid_amount)}`;
    document.getElementById('invBalanceAmount').textContent = `Rs. ${formatMoney(bill.balance_amount)}`;

    // Amount in words
    document.getElementById('invAmountInWords').textContent = numberToWords(Math.round(bill.grand_total));

    const notesEl = document.getElementById('invNotesText');
    if (bill.notes) {
        notesEl.textContent = `Remarks: ${bill.notes}`;
        notesEl.style.display = 'block';
    } else {
        notesEl.style.display = 'none';
    }

    document.getElementById('invoiceModalOverlay').classList.add('visible');
}

function closeInvoiceModal() {
    document.getElementById('invoiceModalOverlay').classList.remove('visible');
}

function printCurrentInvoice() {
    window.print();
}

// ----------------- Billing History Page -----------------

async function loadBillingHistory(page = 1) {
    billingState.historyPage = page;
    const q = (document.getElementById('billHistorySearch').value || '').trim();
    const data = await apiGet(`/api/bills?page=${page}&per_page=${billingState.historyPerPage}&q=${encodeURIComponent(q)}`);
    const tbody = document.getElementById('billingHistoryTableBody');

    if (!data || !data.bills || !data.bills.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px;"><div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">No invoices found. Create a new bill to get started.</div></div></td></tr>';
        return;
    }

    tbody.innerHTML = data.bills.map(b => `
        <tr>
            <td><strong style="color:var(--text-gold); font-family:monospace;">${b.bill_no}</strong></td>
            <td>${formatDate(b.created_at)} ${b.created_at ? b.created_at.substring(11, 16) : ''}</td>
            <td style="font-weight:600; color:var(--text-primary);">${b.customer_name}</td>
            <td><span class="nic-num">${b.nic_no || '-'}</span></td>
            <td>${b.ticket_no ? `<span class="ticket-num">${b.ticket_no}</span>` : '-'}</td>
            <td><span class="badge">${b.item_count || 1} items</span></td>
            <td class="money" style="font-weight:700; color:var(--text-gold);">${formatMoney(b.grand_total)}</td>
            <td>${b.payment_method || 'Cash'}</td>
            <td>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="btn btn-gold" onclick="viewPastInvoice('${b.bill_no}')" style="padding:4px 8px; font-size:11.5px;" title="View & Print Invoice">
                        🖨️ Print
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="deletePastInvoice('${b.bill_no}')" style="padding:4px 8px; font-size:11.5px; color:var(--status-auction);" title="Delete Bill">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    renderPagination('billing-pagination', data.page, data.total_pages, (p) => {
        loadBillingHistory(p);
    });
}

async function viewPastInvoice(billNo) {
    const bill = await apiGet(`/api/bill/${encodeURIComponent(billNo)}`);
    if (bill && !bill.error) {
        showInvoiceModal(bill, false);
    } else {
        alert('Could not load bill details.');
    }
}

async function deletePastInvoice(billNo) {
    if (!confirm(`Are you sure you want to delete invoice ${billNo}?`)) return;

    try {
        const res = await fetch(`/api/bill/${encodeURIComponent(billNo)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadBillingHistory(billingState.historyPage);
            loadBillingHistoryCount();
        } else {
            alert(data.error || 'Failed to delete bill.');
        }
    } catch (e) {
        alert('Network error deleting bill.');
    }
}

// ----------------- Number to Words Converter (LKR Currency) -----------------

function numberToWords(num) {
    if (!num || isNaN(num) || num === 0) return 'Zero Rupees Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertChunk(n) {
        let str = '';
        if (n >= 100) {
            str += ones[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            str += tens[Math.floor(n / 10)] + ' ';
            n %= 10;
        }
        if (n > 0) {
            str += ones[n] + ' ';
        }
        return str;
    }

    let result = '';
    const millions = Math.floor(num / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const remainder = Math.floor(num % 1000);

    if (millions > 0) {
        result += convertChunk(millions) + 'Million ';
    }
    if (thousands > 0) {
        result += convertChunk(thousands) + 'Thousand ';
    }
    if (remainder > 0) {
        result += convertChunk(remainder);
    }

    return 'Sri Lankan Rupees ' + result.trim() + ' Only';
}

// ================================================================
// ==================== DATABASE EXPLORER =========================
// ================================================================

let dbExplorerState = {
    activeTable: 'loans',
    page: 1,
    perPage: 25,
    search: '',
    searchDebounce: null,
    tables: []
};

async function loadDatabaseExplorer() {
    const tables = await apiGet('/api/database/tables');
    if (!tables) return;
    dbExplorerState.tables = tables;

    // Render table summary cards
    const grid = document.getElementById('dbTablesGrid');
    if (grid) {
        grid.innerHTML = tables.map(t => {
            const isActive = t.name === dbExplorerState.activeTable;
            return `
                <div class="stat-card ${isActive ? 'gold' : ''}" onclick="selectDbTable('${t.name}')" style="cursor:pointer; border:${isActive ? '2px solid var(--gold-400)' : '1px solid var(--border-subtle)'};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:20px;">🗃️</span>
                        <span class="badge ${isActive ? 'badge-gold' : ''}">${t.columns.length} cols</span>
                    </div>
                    <div class="stat-label" style="margin-top:8px; font-weight:700; color:${isActive ? 'var(--text-gold)' : 'var(--text-primary)'}; font-family:monospace; font-size:14px;">${t.name}</div>
                    <div class="stat-value" style="font-size:18px;">${formatMoney(t.count)} rows</div>
                </div>
            `;
        }).join('');
    }

    selectDbTable(dbExplorerState.activeTable);
}

async function selectDbTable(tname, page = 1) {
    dbExplorerState.activeTable = tname;
    dbExplorerState.page = page;

    // Highlight card
    const grid = document.getElementById('dbTablesGrid');
    if (grid && dbExplorerState.tables.length) {
        grid.querySelectorAll('.stat-card').forEach((card, idx) => {
            const t = dbExplorerState.tables[idx];
            const isAct = t && t.name === tname;
            card.classList.toggle('gold', isAct);
            card.style.border = isAct ? '2px solid var(--gold-400)' : '1px solid var(--border-subtle)';
        });
    }

    const titleEl = document.getElementById('dbActiveTableTitle');
    const subEl = document.getElementById('dbActiveTableSubtitle');
    if (titleEl) titleEl.textContent = `Table: ${tname}`;

    const thead = document.getElementById('dbTableHeader');
    const tbody = document.getElementById('dbTableBody');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';

    const url = `/api/database/table/${tname}?page=${page}&per_page=${dbExplorerState.perPage}&q=${encodeURIComponent(dbExplorerState.search)}`;
    const data = await apiGet(url);
    if (!data || data.error) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px;">Error loading table records.</td></tr>';
        return;
    }

    if (subEl) subEl.textContent = `Showing ${(data.page - 1) * data.per_page + 1}-${Math.min(data.page * data.per_page, data.total)} of ${data.total} records`;

    // Render header
    const cols = data.columns || [];
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

    if (!data.rows.length) {
        tbody.innerHTML = `<tr><td colspan="${Math.max(cols.length, 1)}" style="text-align:center; padding:30px;"><div class="empty-state"><div class="empty-state-icon">🗄️</div><div class="empty-state-text">No records found in ${tname}</div></div></td></tr>`;
        return;
    }

    tbody.innerHTML = data.rows.map(row => `
        <tr>
            ${cols.map(c => {
                const val = row[c];
                const str = val == null ? '-' : String(val);
                const isNum = typeof val === 'number' && (c.includes('advance') || c.includes('amount') || c.includes('total') || c.includes('price'));
                return `<td class="${isNum ? 'money' : ''}" style="${c.includes('ticket') ? 'font-family:monospace; color:var(--text-gold); font-weight:600;' : ''}">${isNum ? formatMoney(val) : (str.length > 50 ? str.substring(0, 50) + '...' : str)}</td>`;
            }).join('')}
        </tr>
    `).join('');

    renderPagination('db-pagination', data.page, data.total_pages, (p) => {
        selectDbTable(tname, p);
    });
}

function handleDbTableSearch() {
    if (dbExplorerState.searchDebounce) clearTimeout(dbExplorerState.searchDebounce);
    dbExplorerState.searchDebounce = setTimeout(() => {
        const inp = document.getElementById('dbTableSearchInput');
        dbExplorerState.search = inp ? inp.value.trim() : '';
        selectDbTable(dbExplorerState.activeTable, 1);
    }, 300);
}


// ==================== REDEEMED FOLLOW-UP SYSTEM & EXCEL EXPORT ====================

let redeemedState = {
    page: 1,
    perPage: 25,
    stage: 'all',
    search: '',
    searchDebounce: null
};

async function checkRedeemedAlerts() {
    try {
        const summary = await apiGet('/api/redeemed/summary');
        if (!summary) return;

        // Update Nav Badge
        const navBadge = document.getElementById('nav-redeemed-count');
        if (navBadge) {
            navBadge.textContent = summary.total_due > 0 ? summary.total_due : formatMoney(summary.total_redeemed);
            if (summary.total_due > 0) {
                navBadge.style.background = '#ef4444';
            }
        }

        // Update Popup Badges
        const el14 = document.getElementById('popup-14d-count');
        const el1m = document.getElementById('popup-1m-count');
        const el45 = document.getElementById('popup-45d-count');
        const elFloat = document.getElementById('floating-badge-count');

        if (el14) el14.textContent = summary.count_14_days || 0;
        if (el1m) el1m.textContent = summary.count_1_month || 0;
        if (el45) el45.textContent = summary.count_45_days || 0;
        if (elFloat) elFloat.textContent = summary.total_due || 0;

        // Auto-show popup if there are due follow-ups and user hasn't explicitly dismissed it this session
        const popup = document.getElementById('redeemedNotificationPopup');
        const trigger = document.getElementById('redeemedFloatingTrigger');
        if (summary.total_due > 0) {
            if (!sessionStorage.getItem('redeemed_popup_dismissed')) {
                if (popup) popup.classList.remove('hidden');
                if (trigger) trigger.classList.remove('visible');
            } else {
                if (popup) popup.classList.add('hidden');
                if (trigger) trigger.classList.add('visible');
            }
        } else {
            if (popup) popup.classList.add('hidden');
            if (trigger) trigger.classList.remove('visible');
        }
    } catch (e) {
        console.error('Error checking redeemed alerts:', e);
    }
}

function closeRedeemedPopup() {
    const popup = document.getElementById('redeemedNotificationPopup');
    const trigger = document.getElementById('redeemedFloatingTrigger');
    if (popup) popup.classList.add('hidden');
    if (trigger) trigger.classList.add('visible');
    sessionStorage.setItem('redeemed_popup_dismissed', 'true');
}

function openRedeemedPopup() {
    const popup = document.getElementById('redeemedNotificationPopup');
    const trigger = document.getElementById('redeemedFloatingTrigger');
    if (popup) popup.classList.remove('hidden');
    if (trigger) trigger.classList.remove('visible');
}

function navigateAndFilterRedeemed(stage) {
    closeRedeemedPopup();
    navigate('redeemed');
    filterRedeemedStage(stage);
}

async function loadRedeemedPage() {
    await Promise.all([
        loadRedeemedSummaryCards(),
        loadRedeemedTable()
    ]);
}

async function loadRedeemedSummaryCards() {
    const data = await apiGet('/api/redeemed/summary');
    if (!data) return;

    const el14 = document.getElementById('stat-redeemed-14d');
    const el1m = document.getElementById('stat-redeemed-1m');
    const el45 = document.getElementById('stat-redeemed-45d');
    const elTot = document.getElementById('stat-redeemed-total');

    if (el14) el14.textContent = formatMoney(data.count_14_days);
    if (el1m) el1m.textContent = formatMoney(data.count_1_month);
    if (el45) el45.textContent = formatMoney(data.count_45_days);
    if (elTot) elTot.textContent = formatMoney(data.total_redeemed);
}

async function loadRedeemedTable() {
    const tbody = document.getElementById('redeemedTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px;"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
    }

    const q = encodeURIComponent(redeemedState.search);
    const stage = redeemedState.stage;
    const page = redeemedState.page;
    const perPage = redeemedState.perPage;

    const data = await apiGet(`/api/redeemed/list?stage=${stage}&page=${page}&per_page=${perPage}&q=${q}`);
    if (!data) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px; color:#ef4444;">Failed to load redeemed records</td></tr>';
        return;
    }

    // Update count badge & title
    const countBadge = document.getElementById('redeemed-badge-count');
    if (countBadge) countBadge.textContent = `${data.total} records`;

    const tableInfo = document.getElementById('redeemed-table-info');
    if (tableInfo) {
        tableInfo.textContent = `Showing ${(data.page - 1) * data.per_page + 1}-${Math.min(data.page * data.per_page, data.total)} of ${data.total} redeemed loans`;
    }

    if (!data.loans.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px;"><div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No redeemed records matching criteria</div></div></td></tr>';
        renderPagination('redeemed-pagination', 1, 1, () => {});
        return;
    }

    tbody.innerHTML = data.loans.map(l => {
        let badgeClass = 'stage-other';
        if (l.followup_stage.includes('14 Days')) badgeClass = 'stage-14d';
        else if (l.followup_stage.includes('1 Month 2')) badgeClass = 'stage-45d';
        else if (l.followup_stage.includes('1 Month')) badgeClass = 'stage-1m';

        const addr = [l.address1, l.address2, l.address3].filter(Boolean).join(', ');

        return `
            <tr onclick="openLoanDetail('${l.ticket_no}')" style="cursor:pointer;">
                <td><span class="ticket-num">${l.ticket_no || '-'}</span></td>
                <td><strong>${l.name || '-'}</strong></td>
                <td>
                    ${l.mobile_no ? `<a href="tel:${l.mobile_no}" onclick="event.stopPropagation();" style="color:var(--text-gold); text-decoration:none; font-weight:600;">📞 ${l.mobile_no}</a>` : '-'}
                </td>
                <td style="font-family:monospace;">${l.nic_no || '-'}</td>
                <td style="font-size:12px; color:var(--text-secondary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${addr}">${addr || '-'}</td>
                <td>${formatDate(l.redeemed_date)}</td>
                <td style="text-align:center;"><strong style="color:var(--text-primary); font-size:13px;">${l.days_since != null ? l.days_since + ' d' : '-'}</strong></td>
                <td><span class="stage-badge ${badgeClass}">${l.followup_stage}</span></td>
                <td class="money">Rs. ${formatMoney(l.grand_advance)}</td>
                <td class="money" style="color:#10b981;">Rs. ${formatMoney(l.redeemed_amount)}</td>
                <td style="font-size:12px; color:var(--text-secondary); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${l.articles_detail || ''}">${l.articles_detail || '-'}</td>
            </tr>
        `;
    }).join('');

    renderPagination('redeemed-pagination', data.page, data.total_pages, (p) => {
        redeemedState.page = p;
        loadRedeemedTable();
    });
}

function filterRedeemedStage(stage) {
    redeemedState.stage = stage;
    redeemedState.page = 1;

    // Update active filter buttons
    ['all', '14d', '1m', '45d'].forEach(k => {
        const btn = document.getElementById(`btn-stage-${k}`);
        if (btn) btn.classList.remove('active');
    });

    const activeMap = { 'all': 'btn-stage-all', '14_days': 'btn-stage-14d', '1_month': 'btn-stage-1m', '45_days': 'btn-stage-45d' };
    const activeBtn = document.getElementById(activeMap[stage]);
    if (activeBtn) activeBtn.classList.add('active');

    loadRedeemedTable();
}

function debounceRedeemedSearch() {
    if (redeemedState.searchDebounce) clearTimeout(redeemedState.searchDebounce);
    redeemedState.searchDebounce = setTimeout(() => {
        const inp = document.getElementById('redeemedSearchInput');
        redeemedState.search = inp ? inp.value.trim() : '';
        redeemedState.page = 1;
        loadRedeemedTable();
    }, 300);
}

function exportCurrentRedeemedExcel() {
    exportRedeemedExcel(redeemedState.stage);
}

function exportRedeemedExcel(stage) {
    const q = encodeURIComponent(redeemedState.search || '');
    const stg = stage || redeemedState.stage || 'all';
    const url = `/api/redeemed/export?stage=${stg}&q=${q}`;
    window.location.href = url;
}



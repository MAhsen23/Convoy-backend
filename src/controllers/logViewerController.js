import { getApiLogByRequestId, getApiLogs, getApiStatistics } from '../models/apiLogModel.js';

const toInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
};

const parseSuccessFilter = (value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
};

export const getLogsViewerPage = (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Convoy API Logs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f131a;
      --panel: #151b24;
      --line: #273042;
      --text: #e5e9f0;
      --muted: #98a2b3;
      --accent: #7aa2ff;
      --ok: #39d98a;
      --bad: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Nunito", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 20px;
    }
    .title {
      margin: 0 0 14px;
      font-size: 26px;
      font-weight: 700;
    }
    .muted { color: var(--muted); }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 14px;
    }
    .filters {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 1024px) {
      .filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 680px) {
      .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    input, select, button {
      width: 100%;
      background: #111826;
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 9px 10px;
      font-family: inherit;
      font-size: 14px;
    }
    button {
      cursor: pointer;
      font-weight: 700;
    }
    .btn-primary { background: #1b2638; border-color: #33415c; color: #dce7ff; }
    .btn-ghost { background: #131925; color: var(--muted); }
    .stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 1024px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #111826;
    }
    .stat .k { font-size: 12px; color: var(--muted); }
    .stat .v { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .ok { color: var(--ok); }
    .bad { color: var(--bad); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      text-align: left;
      padding: 9px 8px;
      vertical-align: top;
    }
    th { color: var(--muted); font-weight: 700; font-size: 12px; }
    .status-pill {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      font-size: 12px;
    }
    .status-ok { color: var(--ok); border-color: #226d4a; }
    .status-bad { color: var(--bad); border-color: #7a2d2d; }
    .footer {
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .pager {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .details {
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #111826;
    }
    pre {
      margin: 8px 0 0;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0f1623;
      color: #d4dbeb;
      font-size: 12px;
      overflow: auto;
      max-height: 280px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">Convoy API Logs</h1>
    <p class="muted">Filter and inspect request/response logs stored in <code>api_logs</code>.</p>

    <section class="panel">
      <div class="filters">
        <input id="path" placeholder="Path contains (e.g. /api/chat)" />
        <select id="method">
          <option value="">All Methods</option>
          <option>GET</option><option>POST</option><option>PATCH</option><option>PUT</option><option>DELETE</option>
        </select>
        <input id="status_code" type="number" placeholder="Status code" />
        <select id="success">
          <option value="">Success: All</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
        <input id="user_id" type="number" placeholder="User ID" />
        <input id="request_id" placeholder="Request ID exact" />

        <input id="start_date" type="datetime-local" />
        <input id="end_date" type="datetime-local" />
        <select id="limit">
          <option value="25" selected>25 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
        <button class="btn-primary" id="apply">Apply Filters</button>
        <button class="btn-ghost" id="reset">Reset</button>
      </div>
    </section>

    <section class="panel">
      <div class="stats" id="stats"></div>
    </section>

    <section class="panel">
      <div style="overflow:auto;">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Duration</th>
              <th>User</th>
              <th>Request ID</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="footer">
        <div id="meta" class="muted"></div>
        <div class="pager">
          <button id="prev">Prev</button>
          <span id="pageInfo" class="muted"></span>
          <button id="next">Next</button>
        </div>
      </div>
      <div id="details" class="details" style="display:none;"></div>
    </section>
  </div>

  <script>
    let page = 1;
    let totalPages = 1;

    const els = {
      path: document.getElementById('path'),
      method: document.getElementById('method'),
      status_code: document.getElementById('status_code'),
      success: document.getElementById('success'),
      user_id: document.getElementById('user_id'),
      request_id: document.getElementById('request_id'),
      start_date: document.getElementById('start_date'),
      end_date: document.getElementById('end_date'),
      limit: document.getElementById('limit'),
      rows: document.getElementById('rows'),
      stats: document.getElementById('stats'),
      meta: document.getElementById('meta'),
      pageInfo: document.getElementById('pageInfo'),
      details: document.getElementById('details')
    };

    const readFilters = () => ({
      path: els.path.value.trim(),
      method: els.method.value,
      status_code: els.status_code.value,
      success: els.success.value,
      user_id: els.user_id.value,
      request_id: els.request_id.value.trim(),
      start_date: els.start_date.value,
      end_date: els.end_date.value,
      limit: els.limit.value,
      page: String(page)
    });

    const toQuery = (obj) => {
      const params = new URLSearchParams();
      Object.entries(obj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') params.set(k, v);
      });
      return params.toString();
    };

    const fmtDate = (iso) => {
      if (!iso) return '-';
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleString();
    };

    const short = (value, max = 54) => {
      const s = String(value ?? '');
      return s.length > max ? s.slice(0, max) + '...' : s;
    };

    const renderStats = (stats) => {
      const safe = stats || {};
      const cards = [
        ['Total Logs', safe.total ?? 0, ''],
        ['Success', safe.successful ?? 0, 'ok'],
        ['Failed', safe.failed ?? 0, 'bad'],
        ['Success Rate', (safe.success_rate ?? 0) + '%', ''],
        ['Avg Duration', (safe.avg_duration_ms ?? 0) + ' ms', '']
      ];
      els.stats.innerHTML = cards.map(([k, v, cls]) =>
        '<div class="stat"><div class="k">' + k + '</div><div class="v ' + cls + '">' + v + '</div></div>'
      ).join('');
    };

    const renderDetails = (log) => {
      const requestBody = log.request_body ? JSON.stringify(log.request_body, null, 2) : '-';
      const responseBody = log.response_body ? JSON.stringify(log.response_body, null, 2) : '-';
      els.details.style.display = 'block';
      els.details.innerHTML =
        '<strong>Request: ' + log.request_id + '</strong>' +
        '<div class="muted" style="margin-top:4px;">' + short(log.method) + ' ' + short(log.url, 120) + '</div>' +
        '<pre>request_body\\n' + requestBody + '</pre>' +
        '<pre>response_body\\n' + responseBody + '</pre>';
    };

    const renderRows = (logs) => {
      if (!logs.length) {
        els.rows.innerHTML = '<tr><td colspan="8" class="muted">No logs found for selected filters.</td></tr>';
        return;
      }
      els.rows.innerHTML = logs.map((log, idx) => {
        const statusClass = log.success ? 'status-ok' : 'status-bad';
        return '<tr>' +
          '<td>' + fmtDate(log.created_at) + '</td>' +
          '<td>' + short(log.method, 8) + '</td>' +
          '<td title="' + (log.path || '') + '">' + short(log.path || '-', 40) + '</td>' +
          '<td><span class="status-pill ' + statusClass + '">' + (log.status_code ?? '-') + '</span></td>' +
          '<td>' + (log.duration_ms ?? '-') + ' ms</td>' +
          '<td>' + (log.user_id ?? '-') + '</td>' +
          '<td title="' + log.request_id + '">' + short(log.request_id, 24) + '</td>' +
          '<td><button data-row="' + idx + '">View</button></td>' +
        '</tr>';
      }).join('');

      [...els.rows.querySelectorAll('button[data-row]')].forEach((btn) => {
        btn.addEventListener('click', () => {
          const index = Number(btn.getAttribute('data-row'));
          if (Number.isInteger(index)) renderDetails(logs[index]);
        });
      });
    };

    const load = async () => {
      const query = toQuery(readFilters());
      const res = await fetch('/logs/data?' + query);
      const payload = await res.json();
      if (!payload.success) {
        els.rows.innerHTML = '<tr><td colspan="8" class="bad">Failed to load logs.</td></tr>';
        return;
      }
      const data = payload.data || {};
      const logs = data.logs || [];
      totalPages = data.pagination?.total_pages || 1;
      renderStats(data.stats);
      renderRows(logs);
      els.meta.textContent = 'Total: ' + (data.pagination?.total || 0) + ' logs';
      els.pageInfo.textContent = 'Page ' + (data.pagination?.page || 1) + ' / ' + totalPages;
      els.details.style.display = 'none';
      els.details.innerHTML = '';
    };

    document.getElementById('apply').addEventListener('click', () => { page = 1; load(); });
    document.getElementById('reset').addEventListener('click', () => {
      ['path', 'method', 'status_code', 'success', 'user_id', 'request_id', 'start_date', 'end_date'].forEach((key) => {
        els[key].value = '';
      });
      els.limit.value = '25';
      page = 1;
      load();
    });
    document.getElementById('prev').addEventListener('click', () => { if (page > 1) { page -= 1; load(); } });
    document.getElementById('next').addEventListener('click', () => { if (page < totalPages) { page += 1; load(); } });

    load();
  </script>
</body>
</html>`);
};

export const getLogsData = async (req, res) => {
    try {
        const page = Math.max(toInt(req.query.page, 1), 1);
        const limit = Math.min(Math.max(toInt(req.query.limit, 25), 1), 200);
        const offset = (page - 1) * limit;
        const requestId = req.query.request_id ? String(req.query.request_id).trim() : '';

        if (requestId) {
            const log = await getApiLogByRequestId(requestId);
            return res.status(200).json({
                success: true,
                status: 'OK',
                data: {
                    logs: log ? [log] : [],
                    pagination: {
                        total: log ? 1 : 0,
                        page: 1,
                        limit,
                        total_pages: 1
                    }
                }
            });
        }

        const filters = {
            user_id: req.query.user_id ? toInt(req.query.user_id, null) : undefined,
            method: req.query.method ? String(req.query.method).toUpperCase() : undefined,
            path: req.query.path ? String(req.query.path).trim() : undefined,
            status_code: req.query.status_code ? toInt(req.query.status_code, null) : undefined,
            success: parseSuccessFilter(req.query.success),
            start_date: req.query.start_date ? String(req.query.start_date) : undefined,
            end_date: req.query.end_date ? String(req.query.end_date) : undefined,
            limit,
            offset
        };

        const [{ logs, total }, stats] = await Promise.all([
            getApiLogs(filters),
            getApiStatistics({
                start_date: filters.start_date,
                end_date: filters.end_date
            })
        ]);

        return res.status(200).json({
            success: true,
            status: 'OK',
            data: {
                logs,
                stats,
                pagination: {
                    total,
                    page,
                    limit,
                    total_pages: Math.max(Math.ceil(total / limit), 1)
                }
            }
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 'ERROR',
            message: err.message || 'Failed to fetch logs',
            data: null
        });
    }
};


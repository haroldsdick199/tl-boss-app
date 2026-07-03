const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path  = require('path');
const https = require('https');
const fs    = require('fs');

// ── Config storage ────────────────────────────────────────────────────────
function configPath() {
  return path.join(app.getPath('userData'), 'tl-config.json');
}
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); }
  catch(e) { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
}

// ── Auto-update config ────────────────────────────────────────────────────
// Set GITHUB_USER to your GitHub username, then push the repo.
const GITHUB_USER   = 'haroldsdick199';
const GITHUB_REPO   = 'tl-boss-app';
const GITHUB_BRANCH = 'main';

function rawUrl(file) {
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${file}`;
}

// ── HTTPS GET helper (follows redirects) ──────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'tl-boss-app' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── Version comparison ────────────────────────────────────────────────────
function semverGt(a, b) {
  const pa = (a || '0').split('.').map(Number);
  const pb = (b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

// ── Auto-update ───────────────────────────────────────────────────────────
// Updates are stored in userData (always writable, even in a packaged app).
async function checkForUpdate() {
  if (!GITHUB_USER || GITHUB_USER === 'YOUR_GITHUB_USERNAME') return;
  try {
    const remoteJson = await httpsGet(rawUrl('version.json'));
    const remoteVer  = JSON.parse(remoteJson).version || '0.0.0';

    const versionPath = path.join(app.getPath('userData'), 'version.json');
    let localVer = '0.0.0';
    try { localVer = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version || '0.0.0'; } catch(e) {}

    console.log(`[updater] local=${localVer}  remote=${remoteVer}`);
    if (!semverGt(remoteVer, localVer)) return;

    console.log(`[updater] Updating ${localVer} → ${remoteVer}...`);
    const newHtml = await httpsGet(rawUrl('src/index.html'));

    const updateDir = path.join(app.getPath('userData'), 'update');
    fs.mkdirSync(updateDir, { recursive: true });
    fs.writeFileSync(path.join(updateDir, 'index.html'), newHtml, 'utf8');
    fs.writeFileSync(versionPath, JSON.stringify({ version: remoteVer }, null, 2));
    console.log(`[updater] Updated to ${remoteVer} ✓`);
  } catch(e) {
    console.warn('[updater] Update check failed (offline?):', e.message);
  }
}

// ── Resolve which index.html to load ─────────────────────────────────────
// Updated file in userData takes precedence over the bundled one.
function resolveIndexHtml() {
  const updated = path.join(app.getPath('userData'), 'update', 'index.html');
  if (fs.existsSync(updated)) return updated;
  return path.join(__dirname, 'src', 'index.html');
}

// ── Notion REST API ───────────────────────────────────────────────────────
function notionRequest(token, endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com',
      path:     `/v1/${endpoint}`,
      method:   'GET',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type':   'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON from Notion')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Normalise ID → dashed UUID ────────────────────────────────────────────
function toDashedId(raw) {
  if (!raw) return null;
  const hex = raw.replace(/-/g, '').replace(/^.*[/p/]([a-f0-9]{32}).*$/, '$1');
  if (!/^[a-f0-9]{32}$/i.test(hex)) return null;
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ── Parse Notion page → { title, props } ─────────────────────────────────
function parseNotionPage(page) {
  if (!page || page.object === 'error') throw new Error(page?.message || 'Notion API error');
  const rawProps = page.properties || {};
  const props    = {};
  props['Last edited time'] = page.last_edited_time || '';
  props['Created time']     = page.created_time     || '';
  let title = '';
  for (const [, val] of Object.entries(rawProps)) {
    if (val.type === 'title') {
      title = (val.title || []).map(t => t.plain_text || '').join('');
      props['Name'] = title;
      break;
    }
  }
  for (const [key, val] of Object.entries(rawProps)) {
    if (!val) continue;
    switch (val.type) {
      case 'title': break;
      case 'status':        props[key] = val.status?.name || ''; break;
      case 'select':        props[key] = val.select?.name || ''; break;
      case 'multi_select':  props[key] = (val.multi_select || []).map(s => s.name).join(', '); break;
      case 'date':
        if (val.date) {
          props[`date:${key}:start`]       = val.date.start || '';
          props[`date:${key}:end`]         = val.date.end   || null;
          props[`date:${key}:is_datetime`] = (val.date.start || '').length > 10 ? 1 : 0;
        }
        break;
      case 'relation':
        props[key] = (val.relation || []).map(r => `https://app.notion.com/p/${(r.id||'').replace(/-/g,'')}`);
        break;
      case 'rich_text':        props[key] = (val.rich_text || []).map(t => t.plain_text || '').join(''); break;
      case 'number':           props[key] = val.number; break;
      case 'checkbox':         props[key] = val.checkbox ? '__YES__' : '__NO__'; break;
      case 'created_time':     props[key] = val.created_time || ''; break;
      case 'last_edited_time': props[key] = val.last_edited_time || ''; break;
      case 'formula':
      case 'rollup':           props[key] = null; break;
      default: break;
    }
  }
  return { title, props };
}

// ── Notion database query (POST) ─────────────────────────────────────────
function notionQueryDatabase(token, databaseId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ page_size: 100 });
    const req = https.request({
      hostname: 'api.notion.com',
      path:     `/v1/databases/${databaseId}/query`,
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid JSON from Notion')); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────
ipcMain.handle('notion-query-db', async (_e, rawId) => {
  const cfg = loadConfig();
  if (!cfg.token) throw new Error('No Notion token configured');
  const id = toDashedId(rawId);
  if (!id) throw new Error(`Invalid database ID: ${rawId}`);
  const result = await notionQueryDatabase(cfg.token, id);
  if (!result || result.object === 'error') throw new Error(result?.message || 'Notion query error');
  return (result.results || []).map(page => ({ id: page.id, ...parseNotionPage(page) }));
});

ipcMain.handle('notion-fetch', async (_e, rawId) => {
  const cfg = loadConfig();
  if (!cfg.token) throw new Error('No Notion token configured');
  const id = toDashedId(rawId);
  if (!id) throw new Error(`Invalid page ID: ${rawId}`);
  return parseNotionPage(await notionRequest(cfg.token, `pages/${id}`));
});
ipcMain.handle('get-token',     ()          => loadConfig().token || null);
ipcMain.handle('set-token',     (_e, token) => { const c = loadConfig(); c.token = token; saveConfig(c); return true; });
ipcMain.handle('open-external', (_e, url)   => { shell.openExternal(url); });

// ── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 940, height: 780, minWidth: 620, minHeight: 520,
    backgroundColor: '#0a0a0a',
    title: 'TL Design Team',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(resolveIndexHtml());
  return win;
}

// ── Boot ──────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  await checkForUpdate();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

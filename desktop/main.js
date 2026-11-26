'use strict';
/* MySimpleDesk for Windows and Mac: a plain window around https://mysimpledesk.co.uk.
   The app itself is the website, so every update to the website reaches this program too. */
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const HOME = 'https://mysimpledesk.co.uk';
const START = HOME + '/?p=login&source=desktop';
const APP_HOST = 'mysimpledesk.co.uk';
/* Microsoft sign-in has to open inside the window so it can hand back to the app */
const SIGN_IN_HOSTS = ['login.microsoftonline.com', 'login.live.com', 'account.live.com', 'login.microsoft.com'];

app.setAppUserModelId('uk.co.mysimpledesk.app');
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (s && s.width > 400 && s.height > 400) return s;
  } catch (e) {}
  return { width: 1280, height: 860 };
}
function saveState() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, max: win.isMaximized() }));
  } catch (e) {}
}
function host(u) {
  try {
    return new URL(u).hostname;
  } catch (e) {
    return '';
  }
}
function isApp(u) {
  const h = host(u);
  return h === APP_HOST || h === 'www.' + APP_HOST;
}
function isSignIn(u) {
  return SIGN_IN_HOSTS.indexOf(host(u)) > -1;
}
/* anything that is not the app or Microsoft sign-in goes to the person's own browser or mail/phone app */
function external(u) {
  try {
    const p = new URL(u).protocol;
    if (['https:', 'http:', 'mailto:', 'tel:', 'sms:', 'whatsapp:'].indexOf(p) > -1) shell.openExternal(u);
  } catch (e) {}
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width,
    height: st.height,
    x: st.x,
    y: st.y,
    minWidth: 380,
    minHeight: 560,
    title: 'MySimpleDesk',
    backgroundColor: '#EDF0F1',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  if (st.max) win.maximize();
  win.on('close', saveState);
  win.on('closed', () => {
    win = null;
  });

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('blob:') || isApp(url) || isSignIn(url)) return { action: 'allow' };
    external(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (isApp(url) || isSignIn(url) || url.startsWith('blob:') || url.startsWith('file:')) return;
    e.preventDefault();
    external(url);
  });
  wc.on('context-menu', (e, params) => {
    const items = contextMenu(params, wc);
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  wc.on('did-create-window', (child) => {
    child.setMenuBarVisibility(false);
  });
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && !url.startsWith('file:')) win.loadFile(path.join(__dirname, 'offline.html'));
  });
  win.loadURL(START);
}

function menu() {
  const mac = process.platform === 'darwin';
  const t = [
    ...(mac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => win && win.loadURL(START) },
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Support', click: () => shell.openExternal(HOME + '/support') },
        { label: 'Privacy policy', click: () => shell.openExternal(HOME + '/privacy') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
/* right-click menu: spelling suggestions, add to dictionary, cut, copy, paste, and links */
function contextMenu(params, wc) {
  const items = [];
  if (params.misspelledWord) {
    (params.dictionarySuggestions || []).slice(0, 5).forEach((s) =>
      items.push({ label: s, click: () => wc.replaceMisspelling(s) })
    );
    if (!items.length) items.push({ label: 'No suggestions', enabled: false });
    items.push({
      label: 'Add "' + params.misspelledWord + '" to dictionary',
      click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
    });
    items.push({ type: 'separator' });
  }
  if (params.linkURL) {
    items.push({ label: 'Open link in browser', click: () => external(params.linkURL) });
    items.push({ type: 'separator' });
  }
  if (params.isEditable) {
    items.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'selectAll' }
    );
  } else if (params.selectionText) {
    items.push({ role: 'copy' });
  }
  return items;
}

app.whenReady().then(() => {
  const ses = session.defaultSession;
  /* British English spelling (Windows and Linux fetch the dictionary on first use; Macs use their own) */
  try {
    ses.setSpellCheckerLanguages(['en-GB']);
  } catch (e) {}
  /* a normal browser name, so sign-in pages do not treat it as an unknown program */
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|mysimpledesk-desktop)\/\S+/g, ''));
  ses.setPermissionRequestHandler((wcs, permission, cb) => {
    cb(['notifications', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen'].indexOf(permission) > -1 && isApp(wcs.getURL()));
  });
  menu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

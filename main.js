'use strict';

const { app, BrowserWindow, Menu, nativeTheme, net, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_URL = 'brickbybrick://app/';
const rendererFiles = new Set([
  'index.html', 'icon.png', 'styles.css', 'play.css', 'logic.js', 'data.js',
  'ui.js', 'library.js', 'classes.js', 'assistant.js', 'script.js'
]);
const rendererRoot = path.resolve(__dirname);

protocol.registerSchemesAsPrivileged([
  { scheme: 'brickbybrick', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function loadResource(request) {
  const url = new URL(request.url);
  if (url.host !== 'app' || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 404 });
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(rendererRoot, name);
  const inAssets = file.startsWith(path.join(rendererRoot, 'assets') + path.sep);
  if (!rendererFiles.has(name) && !inAssets) return new Response(null, { status: 404 });
  return net.fetch(pathToFileURL(file).href, { method: request.method })
    .catch(() => new Response(null, { status: 404 }));
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Brick by Brick', submenu: [
      { role: 'about', label: 'À propos de Brick by Brick' },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter Brick by Brick' }
    ] },
    { label: 'Édition', submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { role: 'copy', label: 'Copier' },
      { role: 'paste', label: 'Coller' },
      { role: 'selectAll', label: 'Tout sélectionner' }
    ] },
    { label: 'Affichage', submenu: [
      { role: 'resetZoom', label: 'Taille réelle' },
      { role: 'zoomIn', label: 'Agrandir' },
      { role: 'zoomOut', label: 'Réduire' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' }
    ] },
    { label: 'Fenêtre', submenu: [
      { role: 'minimize', label: 'Réduire la fenêtre' },
      { role: 'close', label: 'Fermer la fenêtre' }
    ] }
  ]);
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Brick by Brick',
    width: 1360,
    height: 880,
    minWidth: 580,
    minHeight: 440,
    backgroundColor: '#0a111c',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadURL(APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) createWindow();
    else {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    protocol.handle('brickbybrick', loadResource);
    const allow = (permission, origin) => (permission === 'fullscreen' || permission === 'clipboard-sanitized-write')
      && typeof origin === 'string' && (origin === APP_URL.slice(0, -1) || origin.startsWith(APP_URL));
    session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => allow(permission, origin));
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
      callback(allow(permission, contents.getURL()));
    });
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

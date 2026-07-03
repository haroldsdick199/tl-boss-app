const { contextBridge, ipcRenderer } = require('electron');

// Expose a clean window.tl API to the renderer.
// The renderer calls these exactly like the Cowork bridge — no other changes needed.
contextBridge.exposeInMainWorld('tl', {
  // Fetch a Notion page and return { title, props }
  fetchPage:       (id)  => ipcRenderer.invoke('notion-fetch', id),

  // Query a Notion database — returns array of { id, title, props }
  queryDatabase:   (id)  => ipcRenderer.invoke('notion-query-db', id),

  // Token management
  getToken:     ()      => ipcRenderer.invoke('get-token'),
  setToken:     (token) => ipcRenderer.invoke('set-token', token),

  // Open URLs in the system browser
  openExternal: (url)   => ipcRenderer.invoke('open-external', url),
});

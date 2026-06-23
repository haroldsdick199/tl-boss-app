const { contextBridge, ipcRenderer } = require('electron');

// Expose a clean window.tl API to the renderer.
// The renderer calls these exactly like the Cowork bridge — no other changes needed.
contextBridge.exposeInMainWorld('tl', {
  // Fetch a Notion page and return { title, props } — same shape as parseFetch()
  fetchPage:    (id)    => ipcRenderer.invoke('notion-fetch', id),

  // Token management
  getToken:     ()      => ipcRenderer.invoke('get-token'),
  setToken:     (token) => ipcRenderer.invoke('set-token', token),

  // Open URLs in the system browser (links to Notion pages, etc.)
  openExternal: (url)   => ipcRenderer.invoke('open-external', url),
});

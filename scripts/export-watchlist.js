// 浏览器控制台/前端脚本：直接在 /watchlist 页面控制台粘贴并回车
(async function exportWatchlist() {
  function readIdb(dbName, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(dbName);
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) return resolve([]);
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const allReq = store.getAll();
          allReq.onsuccess = () => resolve(allReq.result || []);
          allReq.onerror = () => resolve([]);
        };
      } catch (e) {
        resolve([]);
      }
    });
  }

  const lsKeys = Object.keys(localStorage).filter(k => /watchlist|watchlist\./i.test(k));
  const localStorageData = {};
  lsKeys.forEach(k => (localStorageData[k] = localStorage.getItem(k)));

  const idbData = {};
  try {
    idbData.watchlist_groups = await readIdb('stock_dashboard_db', 'watchlist_groups');
  } catch (e) {
    idbData.__error = String(e);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    localStorage: localStorageData,
    indexedDB: idbData,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `watchlist-export-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return payload;
})();

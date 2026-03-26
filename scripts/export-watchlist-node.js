#!/usr/bin/env node
// Node CLI: 通过 Puppeteer 打开页面并导出 localStorage + IndexedDB
// 用法: node scripts/export-watchlist-node.js --url http://localhost:5173/watchlist --out watchlist-export.json

const fs = require('fs');
const path = require('path');

async function main() {
  const args = require('minimist')(process.argv.slice(2));
  const url = args.url || args.u || 'http://localhost:5173/watchlist';
  const out = args.out || args.o || `watchlist-export-${Date.now()}.json`;
  const puppeteer = require('puppeteer');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const result = await page.evaluate(async () => {
      function readIdb(dbName, storeName) {
        return new Promise((resolve) => {
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

      return {
        exportedAt: new Date().toISOString(),
        url: location.href,
        localStorage: localStorageData,
        indexedDB: idbData,
      };
    });

    fs.writeFileSync(path.resolve(out), JSON.stringify(result, null, 2), 'utf-8');
    console.log('Exported to', out);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

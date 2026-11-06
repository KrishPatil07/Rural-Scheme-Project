// db.js — IndexedDB wrapper for low-end devices
const DB = (function() {
  const DB_NAME = 'rural-schemes-db';
  const DB_VERSION = 4;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('schemes')) {
          database.createObjectStore('schemes', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('syncQueue')) {
          database.createObjectStore('syncQueue', { autoIncrement: true });
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
          if (!database.objectStoreNames.contains('tools')) {
  database.createObjectStore('tools', { keyPath: 'id' });
}
if (!database.objectStoreNames.contains('profile')) {
  database.createObjectStore('profile', { keyPath: 'key' });
}
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Batch insert schemes. Chunks of 300 to avoid event loop stalls.
   */
  async function saveSchemes(schemes) {
    const CHUNK_SIZE = 300;
    for (let i = 0; i < schemes.length; i += CHUNK_SIZE) {
      const chunk = schemes.slice(i, i + CHUNK_SIZE);
      await new Promise((resolve, reject) => {
        const tx = db.transaction('schemes', 'readwrite');
        const store = tx.objectStore('schemes');
        chunk.forEach(s => store.put(s));
        tx.oncomplete = resolve;
        tx.onerror = (e) => reject(e.target.error);
      });
    }
  }

  function getAllSchemes() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('schemes', 'readonly');
      const store = tx.objectStore('schemes');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function queueAction(action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const req = store.add({ ...action, timestamp: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function setMeta(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getMeta(key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function saveTools(tools) {
  const CHUNK_SIZE = 300;
  for (let i = 0; i < tools.length; i += CHUNK_SIZE) {
    const chunk = tools.slice(i, i + CHUNK_SIZE);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('tools', 'readwrite');
      const store = tx.objectStore('tools');
      chunk.forEach(t => store.put(t));
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

function getAllTools() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tools', 'readonly');
    const store = tx.objectStore('tools');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
function saveProfile(profile) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profile', 'readwrite');
    const store = tx.objectStore('profile');
    store.put({ key: 'user_profile', ...profile });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

function getProfile() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profile', 'readonly');
    const store = tx.objectStore('profile');
    const req = store.get('user_profile');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

function clearProfile() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profile', 'readwrite');
    const store = tx.objectStore('profile');
    store.delete('user_profile');
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}
return { open, saveSchemes, getAllSchemes, saveTools, getAllTools, saveProfile, getProfile, clearProfile, queueAction, setMeta, getMeta };
})();
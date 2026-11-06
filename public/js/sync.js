// sync.js — Background sync for offline actions
const Sync = (function() {
  async function processQueue() {
    if (!navigator.onLine) return;

    const db = await DB.open();
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const req = store.getAll();

    req.onsuccess = async () => {
      const actions = req.result;
      for (const action of actions) {
        try {
          await fetch('/api/user-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action)
          });
          // Remove from queue on success
          const deleteTx = db.transaction('syncQueue', 'readwrite');
          deleteTx.objectStore('syncQueue').delete(action.id);
        } catch (e) {
          console.warn('Sync failed for action:', action, e);
        }
      }
    };
  }

  // Process queue when coming back online
  window.addEventListener('online', processQueue);

  // Also process on app boot
  function init() {
    if (navigator.onLine) {
      processQueue();
    }
  }

  return { init, processQueue };
})();
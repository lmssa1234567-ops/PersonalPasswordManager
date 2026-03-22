// db.js

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PM_DB", 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      const adminStore = db.createObjectStore("admin", { keyPath: "id" });
      adminStore.createIndex("passphrase", "passphrase");
      adminStore.createIndex("salt", "salt");

      const userStore = db.createObjectStore("users", { keyPath: "id" });
      userStore.createIndex("name", "name", { unique: true });

      const categoryStore = db.createObjectStore("categories", {
        keyPath: "id",
      });
      categoryStore.createIndex("name", "name", { unique: true });

      const accountStore = db.createObjectStore("accounts", { keyPath: "id" });
      accountStore.createIndex("category_id", "category_id");
      accountStore.createIndex("name", "name", { unique: true });

      const credentialStore = db.createObjectStore("credentials", {
        keyPath: "id",
      });
      credentialStore.createIndex("user_id", "user_id");
      credentialStore.createIndex("account_id", "account_id");
      credentialStore.createIndex("username", "username");
      credentialStore.createIndex("password", "password");
      credentialStore.createIndex("note", "note");
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e);
  });
}

export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

import { deriveKey, hashKey, encryptData, decryptData } from "./crypto.js";
import { openDB, promisifyRequest } from "./db.js";

export let db;
let cryptoKey;

export function lockVault() {
  cryptoKey = null;
}

export function isVaultUnlocked() {
  return Boolean(cryptoKey);
}

export async function ensureDb() {
  if (!db) {
    db = await openDB();
  }
  return db;
}

async function setLoginBtn() {
  const createUserBtn = document.getElementById("createUserBtn");
  if (!createUserBtn) {
    return;
  }

  await ensureDb();

  const tx = db.transaction("admin", "readonly");
  const store = tx.objectStore("admin");
  const admin = await promisifyRequest(store.get(1));

  createUserBtn.innerText = admin ? "Login" : "Create User";
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", setLoginBtn);
} else {
  setLoginBtn();
}

// ==========================
// LOGIN & SETUP
// ==========================
export async function doLogin(passphrase) {
  if (!passphrase) {
    alert("Enter passphrase");
    return false;
  }

  await ensureDb();

  const tx = db.transaction("admin", "readonly");
  const store = tx.objectStore("admin");
  let admin = await promisifyRequest(store.get(1));

  if (!admin) {
    // No master password set yet (fresh app). Create and then switch button state.
    await setupMaster(passphrase);
    await setLoginBtn();
    return true;
  }

  const salt = new Uint8Array(admin.salt);
  const passwordHash = await hashKey(passphrase, salt);

  if (passwordHash !== admin.passphrase) {
    alert("Invalid master passphrase");
    return false;
  }

  cryptoKey = await deriveKey(passphrase, salt);

  setLoginBtn();
  return true;
}

export async function setupMaster(passphrase) {
  await ensureDb();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashKey(passphrase, salt);

  const tx = db.transaction("admin", "readwrite");
  const store = tx.objectStore("admin");

  debugger;
  await promisifyRequest(
    store.put({
      id: 1,
      passphrase: passwordHash,
      salt: Array.from(salt),
    }),
  );

  cryptoKey = await deriveKey(passphrase, salt);
  alert("Master password set!");
}

export async function getAdminRecord() {
  await ensureDb();
  const tx = db.transaction("admin", "readonly");
  const store = tx.objectStore("admin");
  return await promisifyRequest(store.get(1));
}

export async function deriveKeyFromMasterPassphrase(passphrase) {
  if (!passphrase) {
    throw new Error("Passphrase is required.");
  }

  const admin = await getAdminRecord();
  if (!admin) {
    throw new Error("Master passphrase is not configured.");
  }

  const salt = new Uint8Array(admin.salt);
  const hashedPassphrase = await hashKey(passphrase, salt);

  if (hashedPassphrase !== admin.passphrase) {
    throw new Error("Invalid master passphrase.");
  }

  return deriveKey(passphrase, salt);
}

// ==========================
// CATEGORIES & ACCOUNTS
// ==========================
export async function getCategories() {
  await ensureDb();
  const tx = db.transaction("categories", "readonly");
  const store = tx.objectStore("categories");
  return await promisifyRequest(store.getAll());
}

export async function addCategory(name) {
  await ensureDb();
  const tx = db.transaction("categories", "readwrite");
  const store = tx.objectStore("categories");
  //set id to max existing id + 1
  const maxId = await promisifyRequest(store.getAll()).then((categories) => {
    if (categories.length === 0) {
      return 1;
    } else {
      return Math.max(...categories.map((c) => c.id)) + 1;
    }
  });

  await promisifyRequest(
    store.put({
      id: maxId,
      name,
    }),
  );
}

export async function updateCategory(id, name) {
  await ensureDb();
  const tx = db.transaction("categories", "readwrite");
  const store = tx.objectStore("categories");
  await promisifyRequest(
    store.put({
      id,
      name,
    }),
  );
}

export async function deleteCategory(id) {
  await ensureDb();
  const promptResult = prompt(
    "Delete category? This will also delete all accounts under this category. Type 'yes' to confirm.",
  );
  if (promptResult !== "yes") {
    return;
  }
  const tx = db.transaction("categories", "readwrite");
  const store = tx.objectStore("categories");
  await promisifyRequest(store.delete(id));
}

export async function getAccounts() {
  await ensureDb();
  const tx = db.transaction("accounts", "readonly");
  const store = tx.objectStore("accounts");
  return await promisifyRequest(store.getAll());
}

export async function addAccount(name, categoryId) {
  await ensureDb();
  const tx = db.transaction("accounts", "readwrite");
  const store = tx.objectStore("accounts");

  const maxId = await promisifyRequest(store.getAll()).then((accounts) => {
    if (accounts.length === 0) {
      return 1;
    }
    return Math.max(...accounts.map((account) => account.id)) + 1;
  });

  const normalizedCategoryId = Number(categoryId);

  await promisifyRequest(
    store.put({
      id: maxId,
      name,
      category_id: normalizedCategoryId,
    }),
  );
}

export async function updateAccount(id, name, categoryId) {
  await ensureDb();
  const tx = db.transaction("accounts", "readwrite");
  const store = tx.objectStore("accounts");
  const normalizedCategoryId = Number(categoryId);
  await promisifyRequest(
    store.put({
      id,
      name,
      category_id: normalizedCategoryId,
    }),
  );
}

export async function deleteAccount(id) {
  await ensureDb();
  const tx = db.transaction("accounts", "readwrite");
  const store = tx.objectStore("accounts");
  await promisifyRequest(store.delete(id));
}

export async function getUsers() {
  await ensureDb();
  const tx = db.transaction("users", "readonly");
  const store = tx.objectStore("users");
  return await promisifyRequest(store.getAll());
}

export async function addUser(name) {
  await ensureDb();
  const tx = db.transaction("users", "readwrite");
  const store = tx.objectStore("users");
  const maxId = await promisifyRequest(store.getAll()).then((users) => {
    if (users.length === 0) {
      return 1;
    }
    return Math.max(...users.map((u) => u.id)) + 1;
  });

  await promisifyRequest(
    store.put({
      id: maxId,
      name,
    }),
  );
}

export async function updateUser(id, name) {
  await ensureDb();
  const tx = db.transaction("users", "readwrite");
  const store = tx.objectStore("users");
  await promisifyRequest(
    store.put({
      id,
      name,
    }),
  );
}

export async function deleteUser(id) {
  await ensureDb();
  const promptResult = prompt("Delete user? Type 'yes' to confirm.");
  if (promptResult !== "yes") {
    return;
  }
  const tx = db.transaction("users", "readwrite");
  const store = tx.objectStore("users");
  await promisifyRequest(store.delete(id));
}

export async function getAccountsByCategory(categoryId) {
  if (!categoryId) {
    return [];
  }

  const normalizedCategoryId = Number(categoryId);
  if (Number.isNaN(normalizedCategoryId)) {
    return [];
  }

  await ensureDb();
  const tx = db.transaction("accounts", "readonly");
  const store = tx.objectStore("accounts");
  const index = store.index("category_id");
  return await promisifyRequest(index.getAll(normalizedCategoryId));
}

export async function getVaultSnapshot() {
  await ensureDb();
  const [users, categories, accounts, credentials] = await Promise.all([
    getUsers(),
    getCategories(),
    getAccounts(),
    getCredentials(),
  ]);

  return { users, categories, accounts, credentials };
}

export async function clearStore(storeName) {
  await ensureDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const request = store.clear();
  await promisifyRequest(request);
}

export async function encryptExportPayload(payload) {
  if (!cryptoKey) {
    throw new Error("Vault must be unlocked to encrypt exports");
  }

  return encryptData(payload, cryptoKey);
}

export async function decryptExportPayload(encryptedObj) {
  if (!cryptoKey) {
    throw new Error("Vault must be unlocked to decrypt imports");
  }

  return decryptData(encryptedObj, cryptoKey);
}

// ==========================
// CREDENTIALS
// ==========================
export async function saveCredential(data) {
  await ensureDb();
  if (!cryptoKey) {
    alert("Unlock the vault before saving credentials");
    return;
  }

  const encrypted = await encryptData(data, cryptoKey);

  const tx = db.transaction("credentials", "readwrite");
  const store = tx.objectStore("credentials");

  await promisifyRequest(
    store.put({
      id: data?.id || crypto.randomUUID(),
      payload: encrypted,
    }),
  );
}

export async function deleteCredential(id) {
  if (!id) {
    return;
  }

  await ensureDb();
  const tx = db.transaction("credentials", "readwrite");
  const store = tx.objectStore("credentials");
  await promisifyRequest(store.delete(id));
}

if (typeof window !== "undefined") {
  window.appSaveCredential = saveCredential;
}

export async function getCredentials() {
  debugger;
  await ensureDb();
  if (!cryptoKey) {
    return [];
  }

  const tx = db.transaction("credentials", "readonly");
  const store = tx.objectStore("credentials");

  const all = await promisifyRequest(store.getAll());
  const decrypted = [];

  debugger;
  for (let item of all) {
    try {
      const data = await decryptData(item.payload, cryptoKey);
      debugger;
      decrypted.push({ id: item.id, ...data });
    } catch (error) {
      console.error("Failed to decrypt credential", item?.id, error);
    }
  }

  debugger;
  return decrypted;
}

export async function getCredentialsWithDetails() {
  debugger;
  await ensureDb();
  if (!cryptoKey) {
    return [];
  }

  const [credentials, users, accounts, categories] = await Promise.all([
    getCredentials(),
    getUsers(),
    getAccounts(),
    getCategories(),
  ]);

  const userMap = new Map(users.map((user) => [user.id, user.name]));
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const categoryMap = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return credentials.map((credential) => {
    const account = accountMap.get(credential.accountId);
    const categoryName =
      categoryMap.get(credential.categoryId) || "Uncategorized";
    return {
      ...credential,
      userName: userMap.get(credential.userId) || "Unassigned",
      accountName: account?.name || "Unknown account",
      categoryName,
    };
  });
}

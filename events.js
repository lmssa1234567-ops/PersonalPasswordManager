import {
  doLogin,
  saveCredential,
  addCategory,
  addUser,
  getCredentialsWithDetails,
  lockVault,
  deleteCredential,
  getVaultSnapshot,
  clearStore,
  getCategories,
  getAccounts,
  getUsers,
  getCredentials,
  updateCategory,
  updateAccount,
  updateUser,
  deriveKeyFromMasterPassphrase,
  isVaultUnlocked,
} from "./app.js";
import { decryptString, encryptString } from "./crypto.js";
import {
  refreshAccounts,
  refreshCategories,
  refreshCategoryList,
} from "./categories/categories.js";
import { refreshUsers, refreshUserList } from "./users/users.js";

const childWindows = new Set();
const FILTER_USER_SELECT = "credentialsFilterUser";
const FILTER_CATEGORY_SELECT = "credentialsFilterCategory";
const FILTER_ACCOUNT_SELECT = "credentialsFilterAccount";
const FILTER_MESSAGE_ID = "credentialsFilterMessage";
const FILTER_HINT_TEXT = "Select a user or category to view credentials.";

async function requestMasterKey(promptMessage) {
  const passphrase = prompt(promptMessage);
  if (!passphrase) {
    return null;
  }

  try {
    return await deriveKeyFromMasterPassphrase(passphrase);
  } catch (error) {
    console.error("Invalid master passphrase", error);
    alert("Invalid master passphrase.");
    return null;
  }
}

function notifyChildren(message) {
  for (const child of [...childWindows]) {
    if (!child || child.closed) {
      childWindows.delete(child);
      continue;
    }
    child.postMessage(message, "*");
  }
}

function showMenu() {
  const wrapper = document.getElementById("menuWrapper");
  wrapper?.classList.add("visible");
}

function hideMenu() {
  const wrapper = document.getElementById("menuWrapper");
  wrapper?.classList.remove("visible");
}

function updateMenuThemeLabel(theme) {
  const label = document.getElementById("menuThemeLabel");
  if (label) {
    label.textContent = theme === "dark" ? "Dark" : "Light";
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  notifyChildren({ type: "setTheme", theme });
  updateMenuThemeLabel(theme);
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const theme = saved || "dark";
  setTheme(theme);

  window.addEventListener("message", async (event) => {
    if (event?.data?.type === "refreshCategories") {
      await Promise.all([
        refreshCategories(),
        refreshCategories(FILTER_CATEGORY_SELECT, FILTER_ACCOUNT_SELECT),
      ]);
    } else if (event?.data?.type === "refreshUsers") {
      await Promise.all([refreshUsers(), refreshUsers(FILTER_USER_SELECT)]);
    } else if (event?.data?.type === "refreshAccounts") {
      const mainCategory =
        document.getElementById("categorySelect")?.value || "";
      const filterCategory =
        document.getElementById(FILTER_CATEGORY_SELECT)?.value || "";
      await Promise.all([
        refreshAccounts(mainCategory, "accountSelect"),
        refreshAccounts(filterCategory, FILTER_ACCOUNT_SELECT),
      ]);
    } else if (event?.data?.type === "refreshCredentials") {
      renderCredentials();
    }
  });
}

function closeMenuPanel() {
  const panel = document.getElementById("menuPanel");
  if (panel) {
    panel.classList.remove("open");
  }
}

async function handleImport() {
  closeMenuPanel();
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,text/plain";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    let content;
    try {
      content = await file.text();
    } catch (error) {
      console.error("Failed to read import file", error);
      alert("Unable to read the selected file.");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("Import file is not valid JSON", error);
      alert("Import file is not valid JSON.");
      return;
    }

    if (!parsed?.encrypted) {
      alert("Import file is not in the expected format.");
      return;
    }

    const derivedKey = await requestMasterKey(
      "Enter master passphrase to decrypt the import file:",
    );
    if (!derivedKey) {
      return;
    }

    let decryptedText;
    try {
      decryptedText = await decryptString(parsed.encrypted, derivedKey);
    } catch (error) {
      console.error("Failed to decrypt import file", error);
      alert(
        "Unable to decrypt the import file. Make sure you entered the correct master passphrase.",
      );
      return;
    }

    let importData;
    try {
      importData = JSON.parse(decryptedText);
    } catch (error) {
      console.error("Import file does not contain valid data", error);
      alert("Import file does not contain valid data.");
      return;
    }

    if (!importData) {
      alert("Import file does not contain any data.");
      return;
    }

    const existingDataCounts = await Promise.all([
      getUsers().then((items) => items.length),
      getCategories().then((items) => items.length),
      getAccounts().then((items) => items.length),
      getCredentials().then((items) => items.length),
    ]);

    const hasExistingData = existingDataCounts.some((count) => count > 0);
    let wipeData = false;

    if (hasExistingData) {
      wipeData = confirm(
        "Existing data detected. Press OK to wipe all current data before importing (replaces everything). Press Cancel to merge and update records that share an ID.",
      );
    }

    await applyImportedData(importData, wipeData);
    await postImportRefresh();
    alert("Import completed");
  });

  fileInput.click();
}

async function handleExport() {
  closeMenuPanel();
  if (!isVaultUnlocked()) {
    alert("Vault export requires the vault to be unlocked.");
    return;
  }

  const derivedKey = await requestMasterKey(
    "Enter master passphrase to encrypt the export file:",
  );
  if (!derivedKey) {
    return;
  }

  try {
    const snapshot = await getVaultSnapshot();
    const snapshotJson = JSON.stringify(snapshot);
    const encryptedPayload = await encryptString(snapshotJson, derivedKey);

    const exportFileContents = {
      format: "personal-password-manager",
      version: "1",
      encrypted: encryptedPayload,
    };

    downloadTextFile(
      JSON.stringify(exportFileContents, null, 2),
      `vault-export-${Date.now()}.txt`,
    );
    alert("Vault exported successfully.");
  } catch (error) {
    console.error("Export failed", error);
    alert("Vault export requires the vault to be unlocked.");
  }
}

function handleLogout() {
  closeMenuPanel();
  lockVault();
  const detailSection = document.getElementById("detailSection");
  const loginSection = document.getElementById("loginSection");
  if (detailSection) {
    detailSection.style.display = "none";
  }
  if (loginSection) {
    loginSection.style.display = "block";
  }
  renderCredentials();
  hideMenu();
}

function setupMenuInteractions() {
  const toggle = document.getElementById("menuToggle");
  const panel = document.getElementById("menuPanel");
  if (toggle) {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      panel?.classList.toggle("open");
    });
  }

  panel?.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", () => closeMenuPanel());

  document.getElementById("menuThemeToggle")?.addEventListener("click", () => {
    setTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    );
  });

  document
    .getElementById("menuImport")
    ?.addEventListener("click", handleImport);
  document
    .getElementById("menuExport")
    ?.addEventListener("click", handleExport);
  document
    .getElementById("menuLogout")
    ?.addEventListener("click", handleLogout);
}

window.addEventListener("DOMContentLoaded", initTheme);
window.addEventListener("DOMContentLoaded", setupMenuInteractions);

window.addEventListener("DOMContentLoaded", () => {
  const createUserBtn = document.getElementById("createUserBtn");

  if (!createUserBtn) {
    console.error("Create User button not found!");
    return;
  }

  createUserBtn.addEventListener("click", async () => {
    const passInput = document.getElementById("pass");

    if (!passInput) {
      console.error("Pass input not found!");
      return;
    }

    const success = await doLogin(passInput.value);

    if (success) {
      const loginSection = document.getElementById("loginSection");
      const detailSection = document.getElementById("detailSection");

      if (loginSection) {
        loginSection.style.display = "none";
      }
      if (detailSection) {
        detailSection.style.display = "block";
      }

      showMenu();

      await Promise.all([
        refreshCategories(),
        refreshCategories(FILTER_CATEGORY_SELECT, FILTER_ACCOUNT_SELECT),
      ]);
      await Promise.all([refreshUsers(), refreshUsers(FILTER_USER_SELECT)]);
      await renderCredentials();
    }
  });
});

window.addEventListener("DOMContentLoaded", renderCredentials);

window.addEventListener("DOMContentLoaded", () => {
  const manageCategoriesBtn = document.getElementById("manageCategoriesBtn");

  if (manageCategoriesBtn) {
    manageCategoriesBtn.addEventListener("click", () => {
      const child = window.open(
        "categories/category.html",
        "categoryWindow",
        "width=800,height=600",
      );
      if (child) {
        childWindows.add(child);
      }
    });
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const manageUsersBtn = document.getElementById("manageUsersBtn");

  if (manageUsersBtn) {
    manageUsersBtn.addEventListener("click", () => {
      const child = window.open(
        "users/user.html",
        "userWindow",
        "width=800,height=600",
      );
      if (child) {
        childWindows.add(child);
      }
    });
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const manageAccountsBtn = document.getElementById("manageAccountsBtn");

  if (manageAccountsBtn) {
    manageAccountsBtn.addEventListener("click", () => {
      const child = window.open(
        "accounts/account.html",
        "accountWindow",
        "width=800,height=600",
      );
      if (child) {
        childWindows.add(child);
      }
    });
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const manageCredentialsBtn = document.getElementById("manageCredentialsBtn");

  if (manageCredentialsBtn) {
    manageCredentialsBtn.addEventListener("click", () => {
      const child = window.open(
        "credentials/credential.html",
        "credentialWindow",
        "width=900,height=700",
      );
      if (child) {
        childWindows.add(child);
      }
    });
  }
});

window.addEventListener("DOMContentLoaded", setupFilterListeners);

window.addEventListener("DOMContentLoaded", () => {
  const addCategoryBtn = document.getElementById("addCategoryBtn");

  if (addCategoryBtn) {
    addCategoryBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("categoryName");
      if (nameInput && nameInput.value.trim()) {
        await addCategory(nameInput.value.trim());
        nameInput.value = "";
        await refreshCategoryList();
        window.opener?.postMessage({ type: "refreshCategories" }, "*");
      }
    });
  }

  // Load categories on page load
  refreshCategoryList();
});

window.addEventListener("DOMContentLoaded", () => {
  const addUserBtn = document.getElementById("addUserBtn");

  if (addUserBtn) {
    addUserBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("userName");
      if (nameInput && nameInput.value.trim()) {
        await addUser(nameInput.value.trim());
        nameInput.value = "";
        await refreshUserList();
        window.opener?.postMessage({ type: "refreshUsers" }, "*");
      }
    });
  }

  refreshUserList();
});

async function renderCredentials() {
  const table = document.getElementById("credentialsTable");
  if (!table) {
    return;
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    return;
  }

  const filterUserValue =
    document.getElementById(FILTER_USER_SELECT)?.value || "";
  const filterCategoryValue =
    document.getElementById(FILTER_CATEGORY_SELECT)?.value || "";
  const filterAccountValue =
    document.getElementById(FILTER_ACCOUNT_SELECT)?.value || "";
  const filterMessage = document.getElementById(FILTER_MESSAGE_ID);
  const shouldShowRecords =
    Boolean(filterUserValue) || Boolean(filterCategoryValue);

  if (filterMessage) {
    filterMessage.style.display = shouldShowRecords ? "none" : "block";
  }

  if (!shouldShowRecords) {
    tbody.innerHTML = "";
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 6;
    emptyCell.className = "empty-state";
    emptyCell.textContent = FILTER_HINT_TEXT;
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
    return;
  }

  const credentials = await getCredentialsWithDetails();
  const filteredCredentials = credentials.filter((credential) => {
    if (filterUserValue && String(credential.userId) !== filterUserValue) {
      return false;
    }
    if (
      filterCategoryValue &&
      String(credential.categoryId) !== filterCategoryValue
    ) {
      return false;
    }
    if (
      filterAccountValue &&
      String(credential.accountId) !== filterAccountValue
    ) {
      return false;
    }
    return true;
  });

  tbody.innerHTML = "";

  if (!filteredCredentials.length) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 6;
    emptyCell.className = "empty-state";
    emptyCell.textContent = "No credentials match the selected filters.";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
    return;
  }

  for (const credential of filteredCredentials) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td data-label="Username">${credential.username || ""}</td>
      <td data-label="User">${credential.userName || ""}</td>
      <td data-label="Account">${credential.accountName || ""}</td>
      <td data-label="Category">${credential.categoryName || ""}</td>
      <td data-label="Note">${credential.note || ""}</td>
      <td data-label="Actions" class="credential-actions">
        <button type="button" class="edit-credential">Edit</button>
        <button type="button" class="copy-password">Copy</button>
        <button type="button" class="delete-credential">Delete</button>
      </td>
    `;

    const editBtn = row.querySelector(".edit-credential");
    editBtn?.addEventListener("click", () => openCredentialEditor(credential));
    const copyBtn = row.querySelector(".copy-password");
    copyBtn?.addEventListener(
      "click",
      () => void copyCredentialPassword(credential),
    );
    const deleteBtn = row.querySelector(".delete-credential");
    deleteBtn?.addEventListener(
      "click",
      () => void handleDeleteCredential(credential),
    );

    tbody.appendChild(row);
  }
}

window.refreshCredentials = renderCredentials;

function openCredentialEditor(credential) {
  const child = window.open(
    "credentials/credential.html",
    "credentialWindow",
    "width=900,height=700",
  );
  if (!child) {
    return;
  }

  childWindows.add(child);

  const sendEditData = () => {
    child.postMessage({ type: "editCredential", credential }, "*");
  };

  const handleReady = (event) => {
    if (
      event?.data?.type === "credentialWindowReady" &&
      event.source === child
    ) {
      window.removeEventListener("message", handleReady);
      sendEditData();
    }
  };

  window.addEventListener("message", handleReady);

  if (child.document?.readyState === "complete") {
    sendEditData();
  }
}

function setupFilterListeners() {
  const userSelect = document.getElementById(FILTER_USER_SELECT);
  const categorySelect = document.getElementById(FILTER_CATEGORY_SELECT);
  const accountSelect = document.getElementById(FILTER_ACCOUNT_SELECT);

  userSelect?.addEventListener("change", renderCredentials);
  accountSelect?.addEventListener("change", renderCredentials);

  categorySelect?.addEventListener("change", async () => {
    await refreshAccounts(categorySelect.value, FILTER_ACCOUNT_SELECT);
    renderCredentials();
  });

  void refreshAccounts("", FILTER_ACCOUNT_SELECT);
}

async function applyImportedData(importData, wipeData) {
  const categories = Array.isArray(importData?.categories)
    ? importData.categories
    : [];
  const accounts = Array.isArray(importData?.accounts)
    ? importData.accounts
    : [];
  const users = Array.isArray(importData?.users) ? importData.users : [];
  const credentials = Array.isArray(importData?.credentials)
    ? importData.credentials
    : [];

  if (wipeData) {
    await Promise.all([
      clearStore("credentials"),
      clearStore("users"),
      clearStore("accounts"),
      clearStore("categories"),
    ]);
  }

  for (const category of categories) {
    if (category?.id && category?.name) {
      await updateCategory(category.id, category.name);
    }
  }

  for (const account of accounts) {
    if (!account?.id || !account?.name) {
      continue;
    }
    const categoryId =
      account.category_id ?? account.categoryId ?? account.category ?? null;
    if (categoryId == null) {
      continue;
    }
    await updateAccount(account.id, account.name, categoryId);
  }

  for (const user of users) {
    if (!user?.id || !user?.name) {
      continue;
    }
    await updateUser(user.id, user.name);
  }

  for (const credential of credentials) {
    if (!credential?.username || !credential?.password) {
      continue;
    }

    await saveCredential({
      id: credential.id,
      username: credential.username,
      password: credential.password,
      note: credential.note ?? "",
      userId:
        credential.userId ??
        credential.user_id ??
        (credential.user ? credential.user.id : null) ??
        null,
      categoryId:
        credential.categoryId ??
        credential.category_id ??
        (credential.category ? credential.category.id : null) ??
        null,
      accountId:
        credential.accountId ??
        credential.account_id ??
        (credential.account ? credential.account.id : null) ??
        null,
    });
  }
}

async function postImportRefresh() {
  await Promise.all([
    refreshCategories(),
    refreshCategories(FILTER_CATEGORY_SELECT, FILTER_ACCOUNT_SELECT),
  ]);
  await Promise.all([refreshUsers(), refreshUsers(FILTER_USER_SELECT)]);
  await renderCredentials();
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

async function copyCredentialPassword(credential) {
  const password = credential?.password;
  if (!password) {
    alert("Password not available.");
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(password);
      alert("Password copied to clipboard.");
      return;
    } catch (error) {
      console.error("Clipboard write failed", error);
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = password;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const successful = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (successful) {
    alert("Password copied to clipboard.");
  } else {
    alert("Unable to copy password. Please copy it manually.");
  }
}

async function handleDeleteCredential(credential) {
  if (!credential?.id) {
    return;
  }

  const confirmation = confirm(
    "Delete this credential? This action cannot be undone.",
  );
  if (!confirmation) {
    return;
  }

  await deleteCredential(credential.id);
  await renderCredentials();
}

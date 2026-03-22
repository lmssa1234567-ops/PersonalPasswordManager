import {
  refreshAccounts,
  refreshCategories,
} from "../categories/categories.js";

let editingCredentialId = null;
const SAVE_BTN_DEFAULT_TEXT = "Save Credential";
const SAVE_BTN_EDIT_TEXT = "Save Changes";
import { refreshUsers } from "../users/users.js";

function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;

  window.addEventListener("message", async (event) => {
    if (event?.data?.type === "setTheme") {
      document.documentElement.dataset.theme = event.data.theme;
    } else if (event?.data?.type === "refreshUsers") {
      await refreshUsers();
    } else if (event?.data?.type === "refreshCategories") {
      await refreshCategories();
    } else if (event?.data?.type === "editCredential") {
      await populateFormForEdit(event.data.credential);
    }
  });
}

async function handleCredentialSave() {
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const noteInput = document.getElementById("noteInput");
  const userSelect = document.getElementById("userSelect");
  const categorySelect = document.getElementById("categorySelect");
  const accountSelect = document.getElementById("accountSelect");

  if (!usernameInput || !passwordInput || !categorySelect || !accountSelect) {
    return;
  }

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const note = noteInput?.value.trim() || "";
  const categoryId = categorySelect.value;
  const accountId = accountSelect.value;
  const userId = userSelect?.value ? Number(userSelect.value) : null;

  if (!categoryId) {
    alert("Select a category before saving.");
    return;
  }

  if (!accountId) {
    alert("Select an account before saving.");
    return;
  }

  debugger;
  const parentSave = window.opener?.appSaveCredential;
  if (typeof parentSave !== "function") {
    alert("Please open this credential manager from the unlocked vault.");
    return;
  }

  debugger;
  const payload = {
    username,
    password,
    note,
    userId,
    accountId: Number(accountId),
    categoryId: Number(categoryId),
  };

  if (editingCredentialId) {
    payload.id = editingCredentialId;
  }

  await parentSave(payload);

  alert(editingCredentialId ? "Credential updated!" : "Credential saved!");

  resetForm();

  await Promise.all([refreshCategories(), refreshUsers()]);
  window.opener?.refreshCredentials?.();
  window.opener?.postMessage({ type: "refreshCredentials" }, "*");
}

function resetForm() {
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const noteInput = document.getElementById("noteInput");
  const userSelect = document.getElementById("userSelect");
  const categorySelect = document.getElementById("categorySelect");
  const accountSelect = document.getElementById("accountSelect");
  const saveBtn = document.getElementById("saveCredentialBtn");

  if (usernameInput) {
    usernameInput.value = "";
  }
  if (passwordInput) {
    passwordInput.value = "";
  }
  if (noteInput) {
    noteInput.value = "";
  }
  if (userSelect) {
    userSelect.value = "";
  }
  if (categorySelect) {
    categorySelect.value = "";
  }
  if (accountSelect) {
    accountSelect.innerHTML = '<option value="">Select account</option>';
    accountSelect.disabled = true;
  }
  if (saveBtn) {
    saveBtn.textContent = SAVE_BTN_DEFAULT_TEXT;
  }

  editingCredentialId = null;
}

async function populateFormForEdit(credential) {
  if (!credential) {
    return;
  }

  resetForm();
  editingCredentialId = credential.id ?? null;

  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const noteInput = document.getElementById("noteInput");
  const userSelect = document.getElementById("userSelect");
  const categorySelect = document.getElementById("categorySelect");
  const accountSelect = document.getElementById("accountSelect");
  const saveBtn = document.getElementById("saveCredentialBtn");

  if (usernameInput) {
    usernameInput.value = credential.username ?? "";
  }
  if (passwordInput) {
    passwordInput.value = credential.password ?? "";
  }
  if (noteInput) {
    noteInput.value = credential.note ?? "";
  }
  if (userSelect) {
    userSelect.value = credential.userId ? String(credential.userId) : "";
  }
  if (categorySelect) {
    categorySelect.value = credential.categoryId ?? "";
    await refreshAccounts(categorySelect.value, "accountSelect");
  }
  if (accountSelect && credential.accountId != null) {
    accountSelect.value = credential.accountId;
  }
  if (saveBtn) {
    saveBtn.textContent = editingCredentialId
      ? SAVE_BTN_EDIT_TEXT
      : SAVE_BTN_DEFAULT_TEXT;
  }
}

function setupFormListeners() {
  const categorySelect = document.getElementById("categorySelect");
  const saveBtn = document.getElementById("saveCredentialBtn");

  categorySelect?.addEventListener("change", () => {
    refreshAccounts(categorySelect.value);
  });

  saveBtn?.addEventListener("click", handleCredentialSave);
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  setupFormListeners();
  await Promise.all([refreshCategories(), refreshUsers()]);
  window.opener?.postMessage({ type: "credentialWindowReady" }, "*");
});

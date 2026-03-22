import { getAccounts, addAccount, updateAccount, deleteAccount, getCategories } from "../app.js";

const ACCOUNT_CATEGORY_SELECT = 'accountCategorySelect';
const ACCOUNT_LIST_ID = 'accountList';
const ACCOUNT_NAME_INPUT = 'accountName';
const ADD_ACCOUNT_BTN = 'addAccountBtn';

function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;

  window.addEventListener("message", (event) => {
    if (event?.data?.type === "setTheme") {
      document.documentElement.dataset.theme = event.data.theme;
    }
  });
}

async function buildCategoryDropdown() {
  const select = document.getElementById(ACCOUNT_CATEGORY_SELECT);
  const categories = await getCategories();

  if (!select) {
    return categories;
  }

  select.innerHTML = '<option value="">Select category</option>';

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  }

  return categories;
}

async function refreshAccountList() {
  const list = document.getElementById(ACCOUNT_LIST_ID);
  if (!list) {
    return;
  }

  const [accounts, categories] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

  list.innerHTML = '';

  for (const account of accounts) {
    const li = document.createElement('li');

    const text = document.createElement('span');
    const categoryName = categoryMap.get(account.category_id) || 'Uncategorized';
    text.textContent = `${account.name} (${categoryName})`;
    li.appendChild(text);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => enterEditMode(li, account, categories));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Delete account? Type yes to confirm.')) {
        await deleteAccount(account.id);
        await refreshAccountList();
        window.opener?.postMessage({ type: 'refreshAccounts', categoryId: account.category_id }, '*');
      }
    });

    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

function enterEditMode(li, account, categories) {
  li.innerHTML = '';

  const nameInput = document.createElement('input');
  nameInput.value = account.name;

  const categorySelect = document.createElement('select');
  const blankOption = document.createElement('option');
  blankOption.value = '';
  blankOption.textContent = 'Select category';
  categorySelect.appendChild(blankOption);

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    if (category.id === account.category_id) {
      option.selected = true;
    }
    categorySelect.appendChild(option);
  }

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    const newCategory = categorySelect.value;

    if (!newName || !newCategory) {
      alert('Provide both account name and category.');
      return;
    }

    await updateAccount(account.id, newName, newCategory);
    await refreshAccountList();
    window.opener?.postMessage({ type: 'refreshAccounts', categoryId: newCategory }, '*');
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => refreshAccountList());

  li.appendChild(nameInput);
  li.appendChild(categorySelect);
  li.appendChild(saveBtn);
  li.appendChild(cancelBtn);
}

async function initAccountManager() {
  const addBtn = document.getElementById(ADD_ACCOUNT_BTN);
  const categorySelect = document.getElementById(ACCOUNT_CATEGORY_SELECT);
  const nameInput = document.getElementById(ACCOUNT_NAME_INPUT);

  if (categorySelect && addBtn) {
    categorySelect.addEventListener('change', () => {
      addBtn.disabled = !categorySelect.value;
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const name = nameInput?.value.trim();
      const categoryId = categorySelect?.value;

      if (!categoryId) {
        alert('Select a category before adding an account.');
        return;
      }

      if (!name) {
        alert('Enter an account name.');
        return;
      }

      await addAccount(name, categoryId);
      nameInput.value = '';
      await refreshAccountList();
      await buildCategoryDropdown();
      window.opener?.postMessage({ type: 'refreshAccounts', categoryId }, '*');
    });
  }

  await buildCategoryDropdown();
  await refreshAccountList();
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAccountManager();
  window.addEventListener('message', (event) => {
    if (event?.data?.type === 'refreshCategories') {
      buildCategoryDropdown();
    }
  });
});

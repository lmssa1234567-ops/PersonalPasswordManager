import {
  getCategories,
  getAccountsByCategory,
  updateCategory,
  deleteCategory,
} from "../app.js";

export async function refreshAccounts(categoryId, selectId = "accountSelect") {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  select.innerHTML = '<option value="">Select account</option>';
  select.disabled = !categoryId;

  if (!categoryId) {
    return;
  }

  const accounts = await getAccountsByCategory(categoryId);

  if (accounts.length === 0) {
    select.disabled = true;
    return;
  }

  for (let account of accounts) {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.name;
    select.appendChild(option);
  }

  select.disabled = false;
}

export async function refreshCategories(
  selectId = "categorySelect",
  accountSelectId = "accountSelect",
) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  const categories = await getCategories();

  select.innerHTML = '<option value="">Select category</option>';

  for (let category of categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  }

  await refreshAccounts("", accountSelectId);
}

export async function refreshCategoryList() {
  const list = document.getElementById("categoryList");
  if (!list) {
    return;
  }

  const categories = await getCategories();
  list.innerHTML = "";

  for (let category of categories) {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = category.name;
    li.appendChild(nameSpan);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.value = nameSpan.textContent;
      li.replaceChild(input, nameSpan);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", async () => {
        const newName = input.value.trim();
        if (newName) {
          await updateCategory(category.id, newName);
          await refreshCategoryList();
          window.opener?.postMessage({ type: "refreshCategories" }, "*");
        } else {
          li.replaceChild(nameSpan, input);
          li.replaceChild(editBtn, saveBtn);
          li.removeChild(cancelBtn);
        }
      });

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => {
        li.replaceChild(nameSpan, input);
        li.replaceChild(editBtn, saveBtn);
        li.removeChild(cancelBtn);
      });

      li.replaceChild(saveBtn, editBtn);
      li.appendChild(cancelBtn);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Delete category?")) {
        await deleteCategory(category.id);
        await refreshCategoryList();
        window.opener?.postMessage({ type: "refreshCategories" }, "*");
      }
    });

    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

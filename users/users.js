import {
  getUsers,
  updateUser,
  deleteUser,
} from "../app.js";

const USER_SELECT_ID = "userSelect";
const USER_LIST_ID = "userList";

function getSelect(id) {
  return document.getElementById(id);
}

export async function refreshUsers(selectId = USER_SELECT_ID) {
  const select = getSelect(selectId);
  if (!select) {
    return;
  }

  const users = await getUsers();
  select.innerHTML = '<option value="">Select user</option>';

  for (const user of users) {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.name;
    select.appendChild(option);
  }
}

export async function refreshUserList() {
  const list = document.getElementById(USER_LIST_ID);
  if (!list) {
    return;
  }

  const users = await getUsers();
  list.innerHTML = "";

  for (const user of users) {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = user.name;
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
          await updateUser(user.id, newName);
          await refreshUserList();
          window.opener?.postMessage({ type: "refreshUsers" }, "*");
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
      if (confirm("Delete user?")) {
        await deleteUser(user.id);
        await refreshUserList();
        window.opener?.postMessage({ type: "refreshUsers" }, "*");
      }
    });

    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

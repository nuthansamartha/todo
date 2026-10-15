
const API_URL = "/api/tasks";

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const addButton = document.getElementById("addButton");
const message = document.getElementById("message");

let tasks = [];

document.getElementById("currentDate").textContent =
    new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = `message ${type}`;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    if (!response.ok) {
        let errorMessage = `Request failed (${response.status})`;

        try {
            const error = await response.json();
            errorMessage = error.detail || errorMessage;
        } catch {
            // Keep the default error message.
        }

        throw new Error(
            Array.isArray(errorMessage)
                ? errorMessage.map(item => item.msg).join(", ")
                : errorMessage
        );
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function loadTasks() {
    taskList.innerHTML = '<p class="loading">Loading your tasks...</p>';

    try {
        tasks = await apiRequest(API_URL);
        renderTasks();
    } catch (error) {
        taskList.innerHTML = `
            <p class="empty-state">
                Could not load tasks. Please check your backend.
            </p>
        `;
        showMessage(error.message, "error");
    }
}

function renderTasks() {
    const completed = tasks.filter(task => task.completed).length;
    const remaining = tasks.length - completed;
    const progress = tasks.length
        ? Math.round((completed / tasks.length) * 100)
        : 0;

    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("completedCount").textContent = completed;
    document.getElementById("remainingCount").textContent = remaining;
    document.getElementById("taskLabel").textContent =
        `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
    document.getElementById("progressText").textContent = `${progress}%`;
    document.getElementById("progressBar").style.width = `${progress}%`;

    taskList.replaceChildren();

    if (tasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No tasks yet. Add your first task above!";
        taskList.appendChild(empty);
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = `task-item ${task.completed ? "completed" : ""}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute(
            "aria-label",
            `Mark ${task.title} as ${task.completed ? "incomplete" : "completed"}`
        );

        checkbox.addEventListener("change", () => {
            updateTask(task.id, checkbox.checked);
        });

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete ${task.title}`);

        deleteButton.addEventListener("click", () => {
            deleteTask(task.id);
        });

        item.append(checkbox, title, deleteButton);
        taskList.appendChild(item);
    });
}

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (!title) {
        showMessage("Please enter a task title.", "error");
        return;
    }

    addButton.disabled = true;
    showMessage("");

    try {
        const newTask = await apiRequest(API_URL, {
            method: "POST",
            body: JSON.stringify({ title })
        });

        tasks.unshift(newTask);
        renderTasks();

        taskInput.value = "";
        taskInput.focus();

        showMessage("Task added successfully!", "success");
    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        addButton.disabled = false;
    }
});

async function updateTask(id, completed) {
    try {
        const updatedTask = await apiRequest(`${API_URL}/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ completed })
        });

        tasks = tasks.map(task =>
            task.id === id ? updatedTask : task
        );

        renderTasks();
        showMessage("Task updated successfully!", "success");
    } catch (error) {
        showMessage(error.message, "error");
        await loadTasks();
    }
}

async function deleteTask(id) {
    const task = tasks.find(task => task.id === id);

    if (!task) return;

    if (!confirm(`Delete "${task.title}"?`)) return;

    try {
        await apiRequest(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        tasks = tasks.filter(task => task.id !== id);
        renderTasks();

        showMessage("Task deleted successfully!", "success");
    } catch (error) {
        showMessage(error.message, "error");
    }
}

loadTasks();

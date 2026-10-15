
from contextlib import asynccontextmanager
from pathlib import Path
import sqlite3

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.database import get_connection, init_db


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="My To-Do",
    version="1.0.0",
    lifespan=lifespan,
)


app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_DIR)),
    name="static",
)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TaskUpdate(BaseModel):
    completed: bool


def serialize_task(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "completed": bool(row["completed"]),
    }


@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/tasks")
def get_tasks():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, title, completed FROM tasks ORDER BY id DESC"
        ).fetchall()

    return [serialize_task(row) for row in rows]


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate):
    title = task.title.strip()

    if not title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task title cannot be empty",
        )

    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)",
            (title, 0),
        )

        row = connection.execute(
            "SELECT id, title, completed FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return serialize_task(row)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate):
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE tasks SET completed = ? WHERE id = ?",
            (int(task.completed), task_id),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        row = connection.execute(
            "SELECT id, title, completed FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()

    return serialize_task(row)


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM tasks WHERE id = ?",
            (task_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

    return {"message": "Task deleted successfully"}

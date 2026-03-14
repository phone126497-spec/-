import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 데이터베이스 초기화 (서버 파일 시스템에 저장)
  const defaultData = { todos: [] };
  const adapter = new JSONFile<{ todos: any[] }>('db.json');
  const db = new Low(adapter, defaultData);
  await db.read();

  // API Routes
  app.get("/api/todos", async (req, res) => {
    await db.read();
    res.json(db.data.todos);
  });

  app.post("/api/todos", async (req, res) => {
    const newTodo = {
      id: crypto.randomUUID(),
      ...req.body,
      created_at: new Date().toISOString()
    };
    db.data.todos.unshift(newTodo);
    await db.write();
    res.status(201).json(newTodo);
  });

  app.patch("/api/todos/:id", async (req, res) => {
    const { id } = req.params;
    const index = db.data.todos.findIndex(t => t.id === id);
    if (index !== -1) {
      db.data.todos[index] = { ...db.data.todos[index], ...req.body };
      await db.write();
      res.json(db.data.todos[index]);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  app.delete("/api/todos/:id", async (req, res) => {
    const { id } = req.params;
    db.data.todos = db.data.todos.filter(t => t.id !== id);
    await db.write();
    res.status(204).send();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

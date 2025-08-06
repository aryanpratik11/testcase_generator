const express = require("express");
const router = express.Router();

let todos = [];

router.get("/", (req, res) => {
    res.json(todos);
});

router.post("/", (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const newTodo = { id: Date.now(), title, completed: false };
    todos.push(newTodo);
    res.status(201).json(newTodo);
});

router.patch("/:id", (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    if (!todo) return res.status(404).json({ error: "Todo not found" });
    todo.completed = req.body.completed ?? todo.completed;
    res.json(todo);
});

router.delete("/:id", (req, res) => {
    todos = todos.filter(t => t.id !== parseInt(req.params.id));
    res.status(204).end();
});

module.exports = router;

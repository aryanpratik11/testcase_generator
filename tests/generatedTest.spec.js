```javascript
const request = require('supertest');
const express = require('express');
const router = require('../Sample/1');
const app = express();
app.use(express.json());
app.use("/", router);

describe('GET /', () => {
    it('should return an empty array if no todos exist', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should return a list of existing todos', async () => {
        const newTodo1 = { id: 1, title: 'Todo 1', completed: false };
        const newTodo2 = { id: 2, title: 'Todo 2', completed: true };
        router.todos = [newTodo1, newTodo2];

        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([newTodo1, newTodo2]);
    });
});

```
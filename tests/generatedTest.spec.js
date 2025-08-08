```javascript
const request = require('supertest');
const express = require('express');
const router = require('../Sample/1');
const app = express();
app.use(express.json());
app.use("/", router);

describe('POST /', () => {
    it('should return 400 error when creating todo with missing title', async () => {
        const res = await request(app).post('/').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Title is required" });
    });
});
```
// portal/portal_backend.js

import express from 'express';
import bodyParser from 'body-parser';
import { getUserData, updateUserData } from './api/example_api'; // CHange this later

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());

// Routes
app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userData = await getUserData(userId);
        res.status(200).json(userData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const updatedData = req.body;
        const result = await updateUserData(userId, updatedData);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Portal backend running on port ${PORT}`);
});

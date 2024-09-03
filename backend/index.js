const express = require('express');
const app = express();
const transactionRoutes = require('./routes/transactionRoutes');
const nodeRoutes = require('./routes/nodeRoutes');
const config = require('./utils/config');

app.use(express.json());
app.use('/api/transactions', transactionRoutes);
app.use('/api/nodes', nodeRoutes);

app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
});

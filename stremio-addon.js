const express = require('express');
const axios = require('axios');

const app = express();

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Manifest - no catalog, just streams
app.get('/manifest.json', (req, res) => {
    res.json({
        id: 'com.bortmax.streams',
        version: '1.0.0',
        name: 'Bort Max',
        description: 'Direct streams from Bort Knox vault',
        logo: 'https://i.imgur.com/1tDdDUF.png',
        resources: ['stream'],
        types: ['movie', 'series']
    });
});

// Stream endpoint - minimal, just return empty
app.get('/stream/:type/:id.json', (req, res) => {
    res.json({ streams: [] });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Bort Max addon running on port ${PORT}`);
});

module.exports = app;
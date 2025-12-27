const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://a.111477.xyz';

const app = express();

// Manifest - required by Stremio
app.get('/manifest.json', (req, res) => {
    console.log('Manifest requested');
    res.json({
        id: 'com.111477.directory',
        version: '1.0.0',
        name: '111477 Directory Streams',
        description: 'Direct streams from a.111477.xyz',
        resources: ['catalog', 'stream'],
        types: ['movie', 'series'],
        catalogs: [
            {
                type: 'movie',
                id: '111477-movies',
                name: '111477 Movies'
            },
            {
                type: 'series',
                id: '111477-series',
                name: '111477 TV Shows'
            }
        ]
    });
});

// Catalog endpoint
app.get('/catalog/:type/:id.json', async (req, res) => {
    try {
        console.log(`Catalog requested: ${req.params.type} ${req.params.id}`);
        res.json({ metas: [] });
    } catch (error) {
        console.error('Catalog error:', error);
        res.json({ metas: [] });
    }
});

// Stream endpoint
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        console.log(`Stream requested: ${req.params.type} ${req.params.id}`);
        res.json({ streams: [] });
    } catch (error) {
        console.error('Stream error:', error);
        res.json({ streams: [] });
    }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Addon running on port ${PORT}`);
});

module.exports = app;
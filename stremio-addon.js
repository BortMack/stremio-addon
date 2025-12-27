const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://a.111477.xyz';

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

// Stream endpoint - search vault only when requested
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        const streams = [];

        // Extract search term from IMDB ID or title
        let searchTerm = id.replace(/^tt/, '').toLowerCase();
        if (!searchTerm) return res.json({ streams: [] });

        // Determine which directory to search
        const searchPath = type === 'series' ? `${BASE_URL}/tvs/` : `${BASE_URL}/movies/`;

        // Fetch directory listing
        const response = await axios.get(searchPath, { timeout: 10000 });
        const $ = cheerio.load(response.data);

        // Find matching directory
        let targetDir = null;
        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim().toLowerCase();

            if (href && href.endsWith('/') && text.includes(searchTerm.substring(0, 4))) {
                targetDir = href;
                return false;
            }
        });

        if (!targetDir) return res.json({ streams: [] });

        // Fetch files from matching directory
        const contentResponse = await axios.get(searchPath + targetDir, { timeout: 10000 });
        const $content = cheerio.load(contentResponse.data);

        // Find video files
        $content('tr a').each((i, elem) => {
            const href = $content(elem).attr('href');
            const text = $content(elem).text().trim();

            if (href && !href.endsWith('/') && /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v)$/i.test(href)) {
                streams.push({
                    title: text,
                    url: searchPath + targetDir + href,
                    name: 'Bort Max'
                });
            }
        });

        res.json({ streams: streams });
    } catch (error) {
        console.error('Stream error:', error.message);
        res.json({ streams: [] });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Bort Max addon running on port ${PORT}`);
});

module.exports = app;
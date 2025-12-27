const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://a.111477.xyz';

const app = express();

// CORS headers - required for Stremio
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

// Manifest
app.get('/manifest.json', (req, res) => {
    console.log('Manifest requested');
    res.json({
        id: 'com.bortmax.streams',
        version: '1.0.0',
        name: 'Bort Max',
        description: 'Direct streams from Bort Knox vault',
        logo: 'https://i.imgur.com/1tDdDUF.png',
        resources: ['catalog', 'stream'],
        types: ['movie', 'series'],
        catalogs: [
            {
                type: 'movie',
                id: 'bortmax-movies',
                name: 'Bort Max Movies'
            },
            {
                type: 'series',
                id: 'bortmax-series',
                name: 'Bort Max TV Shows'
            }
        ]
    });
});

// Cache for catalog
let catalogCache = {
    movies: { data: [], timestamp: 0 },
    series: { data: [], timestamp: 0 }
};
const CACHE_DURATION = 3600000;

// Helper to fetch directory
async function fetchDirectory(path) {
    try {
        const response = await axios.get(path, { timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error.message);
        return null;
    }
}

// Catalog endpoint
app.get('/catalog/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        console.log(`Catalog requested: ${type} ${id}`);

        let items = [];
        const now = Date.now();

        if (type === 'movie') {
            if (catalogCache.movies.timestamp && (now - catalogCache.movies.timestamp) < CACHE_DURATION) {
                return res.json({ metas: catalogCache.movies.data });
            }

            const html = await fetchDirectory(`${BASE_URL}/movies/`);
            if (html) {
                const $ = cheerio.load(html);
                $('tr').each((i, row) => {
                    const link = $(row).find('a');
                    const href = link.attr('href');
                    const name = link.text().trim();

                    if (href && name && href.endsWith('/') && name !== '../') {
                        items.push({
                            id: `movie:${href.replace(/\//g, '')}`,
                            type: 'movie',
                            name: name.replace(/^[^a-zA-Z0-9]+/, '').trim(),
                            poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(name)}`
                        });
                    }
                });
            }
            catalogCache.movies = { data: items, timestamp: now };

        } else if (type === 'series') {
            if (catalogCache.series.timestamp && (now - catalogCache.series.timestamp) < CACHE_DURATION) {
                return res.json({ metas: catalogCache.series.data });
            }

            const html = await fetchDirectory(`${BASE_URL}/tvs/`);
            if (html) {
                const $ = cheerio.load(html);
                $('tr').each((i, row) => {
                    const link = $(row).find('a');
                    const href = link.attr('href');
                    const name = link.text().trim();

                    if (href && name && href.endsWith('/') && name !== '../') {
                        items.push({
                            id: `series:${href.replace(/\//g, '')}`,
                            type: 'series',
                            name: name.replace(/^[^a-zA-Z0-9]+/, '').trim(),
                            poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(name)}`
                        });
                    }
                });
            }
            catalogCache.series = { data: items, timestamp: now };
        }

        res.json({ metas: items.slice(0, 200) });
    } catch (error) {
        console.error('Catalog error:', error.message);
        res.json({ metas: [] });
    }
});

// Stream endpoint
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        console.log(`Stream requested: ${type} ${id}`);
        
        const streams = [];
        const [category, dirName] = id.split(':');

        if (!dirName) {
            return res.json({ streams: [] });
        }

        let url = '';
        if (category === 'movie') {
            url = `${BASE_URL}/movies/${encodeURIComponent(dirName)}/`;
        } else if (category === 'series') {
            url = `${BASE_URL}/tvs/${encodeURIComponent(dirName)}/`;
        }

        if (!url) {
            return res.json({ streams: [] });
        }

        const html = await fetchDirectory(url);
        if (!html) {
            return res.json({ streams: [] });
        }

        const $ = cheerio.load(html);
        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();

            if (href && !href.endsWith('/') && /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts)$/i.test(href)) {
                streams.push({
                    title: text,
                    url: url + href,
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Bort Max addon running on port ${PORT}`);
});

module.exports = app;
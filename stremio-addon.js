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

// Cache for catalog to avoid repeated scraping
let catalogCache = {
    movies: { data: [], timestamp: 0 },
    series: { data: [], timestamp: 0 }
};
const CACHE_DURATION = 3600000; // 1 hour

// Manifest - required by Stremio
app.get('/manifest.json', (req, res) => {
    console.log('Manifest requested');
    res.json({
        id: 'com.bortmax.directory',
        version: '1.0.0',
        name: 'Bort Max',
        description: 'Direct streams from a.111477.xyz directory',
        logo: 'https://i.imgur.com/qmJshyP.png',
        resources: ['catalog', 'stream'],
        types: ['movie', 'series'],
        catalogs: [
            {
                type: 'movie',
                id: 'bortmax-movies',
                name: 'Bort Max Movies',
                extra: [{ name: 'search', isRequired: false }]
            },
            {
                type: 'series',
                id: 'bortmax-series',
                name: 'Bort Max TV Shows',
                extra: [{ name: 'search', isRequired: false }]
            }
        ]
    });
});

// Helper function to fetch directory listing
async function fetchDirectory(path) {
    try {
        const response = await axios.get(path, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error.message);
        return null;
    }
}

// Helper function to parse directory and extract items
function parseDirectory(html, type) {
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const items = [];

    $('tr').each((i, row) => {
        const link = $(row).find('a');
        const href = link.attr('href');
        const name = link.text().trim();

        // Skip parent directory and invalid entries
        if (!href || !name || name === '../' || !href.endsWith('/')) {
            return;
        }

        const cleanName = name.replace(/^[^a-zA-Z0-9]+/, '').trim();
        if (!cleanName) return;

        items.push({
            id: `${type}:${href.replace(/\//g, '')}`,
            type: type,
            name: cleanName,
            poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(cleanName)}`,
            background: `https://via.placeholder.com/1280x720?text=${encodeURIComponent(cleanName)}`
        });
    });

    return items;
}

// Catalog endpoint
app.get('/catalog/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        console.log(`Catalog requested: ${type} ${id}`);

        let items = [];
        const now = Date.now();

        // Check cache
        if (type === 'movie') {
            if (catalogCache.movies.timestamp && (now - catalogCache.movies.timestamp) < CACHE_DURATION) {
                console.log('Returning cached movies');
                return res.json({ metas: catalogCache.movies.data });
            }

            const html = await fetchDirectory(`${BASE_URL}/movies/`);
            items = parseDirectory(html, 'movie');
            catalogCache.movies = { data: items, timestamp: now };

        } else if (type === 'series') {
            if (catalogCache.series.timestamp && (now - catalogCache.series.timestamp) < CACHE_DURATION) {
                console.log('Returning cached series');
                return res.json({ metas: catalogCache.series.data });
            }

            const html = await fetchDirectory(`${BASE_URL}/tvs/`);
            items = parseDirectory(html, 'series');
            catalogCache.series = { data: items, timestamp: now };
        }

        res.json({ metas: items.slice(0, 200) });
    } catch (error) {
        console.error('Catalog error:', error.message);
        res.json({ metas: [] });
    }
});

// Meta endpoint - get detailed info about a specific item
app.get('/meta/:type/:id.json', (req, res) => {
    try {
        const { type, id } = req.params;
        console.log(`Meta requested: ${type} ${id}`);

        const [category, dirName] = id.split(':');
        const name = dirName.replace(/\d{4}/, '').replace(/_/g, ' ').trim();

        res.json({
            meta: {
                id: id,
                type: type,
                name: name,
                poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(name)}`,
                background: `https://via.placeholder.com/1280x720?text=${encodeURIComponent(name)}`,
                description: `Available on Bort Max Directory`,
                releaseInfo: new Date().getFullYear().toString(),
                runtime: 'N/A',
                imdbRating: 'N/A'
            }
        });
    } catch (error) {
        console.error('Meta error:', error.message);
        res.json({ meta: null });
    }
});

// Stream endpoint - find playable video files
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        const [category, dirName] = id.split(':');
        console.log(`Stream requested: ${type} ${id}`);

        const streams = [];

        // Build URL based on type
        let url = '';
        if (category === 'movie') {
            url = `${BASE_URL}/movies/${encodeURIComponent(dirName)}/`;
        } else if (category === 'series') {
            url = `${BASE_URL}/tvs/${encodeURIComponent(dirName)}/`;
        }

        if (!url) {
            return res.json({ streams: [] });
        }

        // Fetch directory listing
        const html = await fetchDirectory(url);
        if (!html) {
            return res.json({ streams: [] });
        }

        const $ = cheerio.load(html);

        // Find all video files
        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();

            // Filter for video files
            if (href && !href.endsWith('/') && 
                /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m3u8)$/i.test(href)) {
                
                streams.push({
                    title: `${text} (Direct Stream)`,
                    url: url + href,
                    name: 'Bort Max',
                    type: 'http',
                    behaviorHints: {
                        notWebReady: false,
                        bingeGroup: `bortmax-${dirName}`
                    }
                });
            }
        });

        res.json({ streams: streams });
    } catch (error) {
        console.error('Stream error:', error.message);
        res.json({ streams: [] });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Bort Max Addon',
        version: '1.0.0',
        status: 'running'
    });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Bort Max addon running on port ${PORT}`);
    console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
});

module.exports = app;
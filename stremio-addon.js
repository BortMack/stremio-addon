const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://a.111477.xyz';
const app = express();

let moviesCache = [];
let cacheLastUpdated = 0;
const CACHE_TTL = 3600000; // 1 hour

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

// Load movies catalog from a.111477.xyz
async function loadMoviesCatalog() {
    try {
        console.log('Loading movies catalog...');
        const response = await axios.get(`${BASE_URL}/movies/`, { timeout: 15000 });
        const $ = cheerio.load(response.data);
        
        const movies = [];
        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const name = $(elem).text().trim();
            
            if (href && href.endsWith('/') && name !== '../') {
                movies.push({
                    dir: href,
                    name: name.replace(/^[^a-zA-Z0-9]+/, '').trim()
                });
            }
        });
        
        moviesCache = movies;
        cacheLastUpdated = Date.now();
        console.log(`Loaded ${movies.length} movies`);
        return true;
    } catch (error) {
        console.error('Error loading movies catalog:', error.message);
        return false;
    }
}

// Initialize catalog on startup
loadMoviesCatalog();

// Manifest
app.get('/manifest.json', (req, res) => {
    res.json({
        id: 'com.bortmax.movies',
        version: '1.0.0',
        name: 'Bort Max',
        description: 'Direct streams from Bort Knox vault',
        logo: 'https://i.imgur.com/1tDdDUF.png',
        resources: ['catalog', 'stream'],
        types: ['movie'],
        catalogs: [
            {
                type: 'movie',
                id: 'bortmax-movies',
                name: 'Bort Max Movies'
            }
        ]
    });
});

// Catalog endpoint
app.get('/catalog/movie/:id.json', async (req, res) => {
    try {
        // Refresh cache if expired
        if (Date.now() - cacheLastUpdated > CACHE_TTL) {
            await loadMoviesCatalog();
        }
        
        res.json({ metas: moviesCache.map((m, i) => ({
            id: `movie:${i}`,
            type: 'movie',
            name: m.name,
            poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(m.name)}`
        })).slice(0, 200) });
    } catch (error) {
        console.error('Catalog error:', error.message);
        res.json({ metas: [] });
    }
});

// Stream endpoint
app.get('/stream/movie/:id.json', async (req, res) => {
    try {
        const { id } = req.params;
        const movieIndex = parseInt(id.split(':')[1]);
        
        if (isNaN(movieIndex) || movieIndex >= moviesCache.length) {
            return res.json({ streams: [] });
        }
        
        const movie = moviesCache[movieIndex];
        const moviePath = `${BASE_URL}/movies/${movie.dir}`;
        
        const response = await axios.get(moviePath, { timeout: 10000 });
        const $ = cheerio.load(response.data);
        
        const streams = [];
        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();
            
            if (href && !href.endsWith('/') && /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v)$/i.test(href)) {
                streams.push({
                    title: text,
                    url: moviePath + href,
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
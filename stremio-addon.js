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

// Manifest - stream provider only (no catalog)
app.get('/manifest.json', (req, res) => {
    console.log('Manifest requested');
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

// Helper function to fetch directory listing with timeout
async function fetchDirectory(path) {
    try {
        const response = await axios.get(path, { timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error.message);
        return null;
    }
}

// Stream endpoint - searches Bort Knox vault for matching content
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        console.log(`Stream requested: ${type} ${id}`);

        const streams = [];

        // Extract potential directory name from ID
        // Handle formats like: tt123456, movie-name, series-name:season:episode
        let searchTerms = [];
        
        if (id.includes(':')) {
            // Series format: seriesname:season:episode
            const parts = id.split(':');
            searchTerms.push(parts[0]);
        } else if (id.startsWith('tt')) {
            // IMDB ID - we can't search by this, return empty
            return res.json({ streams: [] });
        } else {
            // Direct directory name
            searchTerms.push(id);
        }

        // Determine which directory to search
        const searchPath = type === 'series' ? `${BASE_URL}/tvs/` : `${BASE_URL}/movies/`;

        // Fetch directory listing
        const html = await fetchDirectory(searchPath);
        if (!html) {
            return res.json({ streams: [] });
        }

        const $ = cheerio.load(html);
        let targetDir = null;

        // Find matching directory
        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();

            if (href && href.endsWith('/')) {
                // Check if this directory matches our search terms
                const dirName = href.replace(/\//g, '').toLowerCase();
                if (searchTerms.some(term => dirName.includes(term.toLowerCase()))) {
                    targetDir = href;
                    return false; // Break loop
                }
            }
        });

        // If no matching directory found, return empty
        if (!targetDir) {
            console.log(`No matching directory found for ${id}`);
            return res.json({ streams: [] });
        }

        // Fetch files from the matching directory
        const contentPath = searchPath + targetDir;
        const contentHtml = await fetchDirectory(contentPath);
        if (!contentHtml) {
            return res.json({ streams: [] });
        }

        const $content = cheerio.load(contentHtml);

        // Find all video files in the directory
        $content('tr a').each((i, elem) => {
            const href = $content(elem).attr('href');
            const text = $content(elem).text().trim();

            // Filter for video files
            if (href && !href.endsWith('/') && 
                /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m3u8)$/i.test(href)) {
                
                streams.push({
                    title: text,
                    url: contentPath + href,
                    name: 'Bort Max',
                    type: 'http',
                    behaviorHints: {
                        notWebReady: false
                    }
                });
            }
        });

        console.log(`Found ${streams.length} streams for ${id}`);
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
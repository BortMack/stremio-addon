const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://a.111477.xyz';

const app = express();

// Manifest - required by Stremio
app.get('/manifest.json', (req, res) => {
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
        const { type } = req.params;
        let items = [];

        if (type === 'movie') {
            const html = await axios.get(`${BASE_URL}/movies/`);
            const $ = cheerio.load(html.data);

            items = $('tr').map((i, row) => {
                const link = $(row).find('a');
                const href = link.attr('href');
                const name = link.text().trim();

                if (!href || !name || name === '../' || !href.endsWith('/')) 
                    return null;

                const title = name.replace(/^[^a-zA-Z0-9]+/, '');

                return {
                    id: `movie:${href.replace(/\//g, '')}`,
                    type: 'movie',
                    name: title,
                    poster: 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title)
                };
            }).get().filter(Boolean);

        } else if (type === 'series') {
            const html = await axios.get(`${BASE_URL}/tvs/`);
            const $ = cheerio.load(html.data);

            items = $('tr').map((i, row) => {
                const link = $(row).find('a');
                const href = link.attr('href');
                const name = link.text().trim();

                if (!href || !name || name === '../' || !href.endsWith('/')) 
                    return null;

                const title = name.replace(/^[^a-zA-Z0-9]+/, '');

                return {
                    id: `series:${href.replace(/\//g, '')}`,
                    type: 'series',
                    name: title,
                    poster: 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(title)
                };
            }).get().filter(Boolean);
        }

        res.json({ metas: items.slice(0, 100) });
    } catch (error) {
        console.error('Catalog error:', error);
        res.json({ metas: [] });
    }
});

// Stream endpoint
app.get('/stream/:type/:id.json', async (req, res) => {
    try {
        const { type, id } = req.params;
        const [category, dirName] = id.split(':');
        const streams = [];

        let url = '';
        if (category === 'movie') {
            url = `${BASE_URL}/movies/${encodeURIComponent(dirName)}/`;
        } else if (category === 'series') {
            url = `${BASE_URL}/tvs/${encodeURIComponent(dirName)}/`;
        }

        const html = await axios.get(url);
        const $ = cheerio.load(html.data);

        $('tr a').each((i, elem) => {
            const href = $(elem).attr('href');
            const text = $(elem).text().trim();

            if (href && !href.endsWith('/') && 
                /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v)$/i.test(href)) {

                streams.push({
                    title: text + ' (Direct HTTP)',
                    url: url + href,
                    name: '111477 Direct'
                });
            }
        });

        res.json({ streams: streams });
    } catch (error) {
        console.error('Stream error:', error);
        res.json({ streams: [] });
    }
});

// Start server
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log(`Addon running at: http://localhost:${PORT}/manifest.json`);
    console.log(`Add this URL to Stremio: http://localhost:${PORT}/manifest.json`);
});

module.exports = app;
const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://a.111477.xyz';

const builder = new addonBuilder({
    id: 'com.bortmax.streams',
    version: '1.0.0',
    name: 'Bort Max',
    description: 'Direct streams from Bort Knox vault',
    logo: 'https://i.imgur.com/1tDdDUF.png',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
});

// Helper function to fetch directory listing
async function fetchDirectory(path) {
    try {
        const response = await axios.get(path, { timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error.message);
        return null;
    }
}

// Stream handler
builder.defineStreamHandler(async function(args) {
    try {
        console.log(`Stream requested: ${args.type} ${args.id}`);
        
        // args.id comes as IMDB ID (tt1234567)
        // We can't search by IMDB ID in a.111477.xyz, so return empty
        // Unless the addon is extended to have a catalog, it won't work well
        
        return Promise.resolve({ streams: [] });
    } catch (error) {
        console.error('Stream error:', error.message);
        return Promise.resolve({ streams: [] });
    }
});

// Serve the addon
const addonInterface = builder.getInterface();
serveHTTP(addonInterface, { port: process.env.PORT || 8080 });

console.log('Bort Max addon running');
console.log(`Manifest: http://localhost:${process.env.PORT || 8080}/manifest.json`);
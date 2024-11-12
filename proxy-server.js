const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Simple proxy configuration
const proxyOptions = {
    target: 'https://api.mainnet-beta.solana.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/solana-rpc': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[${new Date().toISOString()}] ${proxyRes.statusCode} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ error: 'Proxy error occurred' });
    }
};

app.use('/api/solana-rpc', createProxyMiddleware(proxyOptions));

app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
});
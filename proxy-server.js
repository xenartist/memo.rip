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

// Rate limiting configuration
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting
app.use('/api/', limiter);

// Solana RPC endpoints
const SOLANA_RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
];

let currentEndpointIndex = 0;

// Round-robin endpoint selection
function getNextEndpoint() {
    const endpoint = SOLANA_RPC_ENDPOINTS[currentEndpointIndex];
    currentEndpointIndex = (currentEndpointIndex + 1) % SOLANA_RPC_ENDPOINTS.length;
    return endpoint;
}

// Proxy middleware configuration
const proxyOptions = {
    target: SOLANA_RPC_ENDPOINTS[0],
    changeOrigin: true,
    pathRewrite: {
        '^/api/solana-rpc': '', // Remove the path prefix when forwarding
    },
    router: {
        '/api/solana-rpc': () => getNextEndpoint(),
    },
    onProxyReq: (proxyReq, req, res) => {
        // Log request
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        // Log response
        console.log(`[${new Date().toISOString()}] ${proxyRes.statusCode} ${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({ error: 'Proxy error occurred' });
    }
};

// Apply proxy middleware
app.use('/api/solana-rpc', createProxyMiddleware(proxyOptions));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
# memo.rip

# Install dependencies
npm install

# Install PM2
npm install -g pm2

# Start server
pm2 start proxy-server.js --name "solana-rpc-proxy"

# View logs
pm2 logs solana-rpc-proxy

# Monitor
pm2 monit
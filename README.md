# memo.rip

for everlasting memories on solana

# Install dependencies
```
npm install
```

# Install PM2
```
npm install -g pm2
```

# Option 1: Start server through npm
* Start server in dev environment (port 3000)
```
npm start (or node server.js)
```

* Start server in prod environment (port 80)
```
npm run start:prod (or node server.js 80)
```

# Option 2: Start server through PM2
* Start service
```
pm2 start ecosystem.config.js
```

* View status
```
pm2 status
```

* View logs
```
pm2 logs
```

# Start proxy server
```
pm2 start proxy-server.js --name "solana-rpc-proxy"
```

* View logs
```
pm2 logs solana-rpc-proxy
```

* Monitor
```
pm2 monit
```

# Sync database

* Config SSH key
```
ssh-keygen -t rsa

ssh-copy-id user@source-server
``` 

* Sync database from source server to backup server
```
bash data/sync_db.sh
```

* Cron job
```
crontab -e
```

* Add cron job
```
# sync every 30 minutes
*/30 * * * * bash /path/to/memo.rip/data/sync_db.sh
```

* View logs
```
tail -f /var/log/db_sync.log
```

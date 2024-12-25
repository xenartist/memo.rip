#!/bin/bash
# sync_rewards-db.sh
rsync -avz --delete \
    --log-file=/var/log/rewards_db_sync.log \
    /local/path/to/memo.rip/data/rewards.db \
    user@source-server:/path/to/memo.rip/data/backup/
    
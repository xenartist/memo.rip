#!/bin/bash
# sync_db.sh
rsync -avz --delete \
    --log-file=/var/log/db_sync.log \
    user@source-server:/path/to/memo.rip/data/burns.db \
    /path/to/backup/
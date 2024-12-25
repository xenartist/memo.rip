#!/bin/bash
# sync_burns-db.sh
rsync -avz --delete \
    --log-file=/var/log/burns_db_sync.log \
    user@source-server:/path/to/memo.rip/data/burns.db \
    /local/path/to/memo.rip/data/backup/
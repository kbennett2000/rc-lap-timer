cp backup_data.sql db-backups/backup_data.$(date +%Y%m%d_%H%M%S).sql
rm backup_data.sql
mysql -u root -p < dbCycle.sql > backup_data.sql
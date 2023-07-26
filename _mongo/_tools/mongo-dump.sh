#!/bin/bash

pathDumpSeira="./dumps"
DATE_DUMP=$(date '+%Y%m%d%H%M%S')
DB="seiradb"
DB_SSO="seirasso"
DB_LM="licencemanagementdb"
DB_LM_SSO="licencemanagementsso"
URI="mongodb://localhost:27017"
​
# db
mongodump --uri $URI -d $DB -o $pathDumpSeira/$DATE_DUMP/$DB/
# sso
mongodump --uri $URI -d $DB_SSO -o $pathDumpSeira/$DATE_DUMP/$DB_SSO/
# licmgr db
mongodump --uri $URI -d $DB_LM -o $pathDumpSeira/$DATE_DUMP/$DB_LM/
# licmgr sso
mongodump --uri $URI -d $DB_LM_SSO -o $pathDumpSeira/$DATE_DUMP/$DB_LM_SSO/
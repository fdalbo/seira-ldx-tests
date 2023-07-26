#!/bin/bash
pathDumpSeira="./"
DB="seiradb"
DB_SSO="seirasso"
DB_LM="licencemanagementdb"
DB_LM_SSO="licencemanagementsso"
URI="mongodb://localhost:27017"

echo "REMOVE EXIT(1)"
exit 1

# db
mongorestore --uri $URI -d $DB $pathDumpSeira/$DB/ --drop
# sso
mongorestore --uri $URI -d $DB_SSO $pathDumpSeira/$DB_SSO/ --drop
# licmgr db
mongorestore --uri $URI -d $DB_LM $pathDumpSeira/$DB_LM/ --drop
# # licmgr sso
mongorestore --uri $URI -d $DB_LM_SSO $pathDumpSeira/$DB_LM_SSO/ --drop
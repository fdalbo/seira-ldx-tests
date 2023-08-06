

## Install
[artillery](https://www.artillery.io/docs/get-started/get-artillery)
[playwright](https://playwright.dev/docs/intro)

## Launch server
```osascript dev_scripts/start_full_project/mac.scpt```
## npm
```!!  "devDependencies": { "@playwright/test": "^1.36.0"} not "devDependencies": { "#playwright/test": "^1.36.0"}```
## esm modules
```
    package.json: use 
        "imports":{ 
            "#commons/*": "./src/_helpers/commons/*",
        }
    import myConsole from '#commons/myConsole'
```

## environment SLDX_ENV
- Alimentée par
  - l'arugment --sldxenv=xxxx
    ``` 
        npm run artillery.script1.debug 
         -> "artillery.script1.debug": "node runner.artillery.js test-script1-debug.yml --sldxenv=debug",
        npm run artillery.script1 -- --sldxenv=debug
         ->  "artillery.script1": "node runner.artillery.js test-script1.yml",
    ```
  - le fichier .env si argument --sldxenv non trouvé
    ````
        SLDX_ENV=debug
    ```
  - la valeur par défaut 'default' (voir src/_helpers/env/defaultEnvVars.js)
- ``SLDX_ENV`` permet de piloter les fichiers de configuration
  - exemple pour ``npm run artillery.script1 -- --sldxenv=toto``
  - ``sldx.toto.dotenv`` surcharge les valeurs par défaut
    ```
        SLDX_PROTOCOL: obligatoire
        SLDX_PROXY_HOST: obligatoire
        SLDX_ADMIN_NAME: obligatoire
        SLDX_ADMIN_PWD: obligatoire  
    ```
  - ``config.script1.toto.js`` surcharge la config de base (``config.script1.js``) si fichier présent
- ``SLDX_LEARNER_PREFIX=user`` permet de calculer le nom de l'utilisatuer ``SLDX_LEARNER_PREFIX + index (user1, user2...)``
## Les scripts
- **script1**
   - ``src/scripts/Script1.js``
      - Les scripts sont lancés par ``src/scripts/factory.js - runScript``
      - artillery: ``artillery/tests.js`` 
      - ``testFunction: "script1"`` du fichier ``.yml`` donne le nom du test à lancer
   - playwright: ``playwright/script1.spec.js`` 
      - Playwright est utilisé pour la mise au point
      - Artillery lance autant de tests playwright dans des workers node via la propriété ``- engine: playwright`` du fichier ``.yml``. Le VUsers sont fournis par le fichier .csv associé à config.payload
      - Playwright execute tous les tessts (un seul dans notre cas) en parallèle ou non (voir ``playwright.config.js``)
      - Playwright fonctionne comme JEST
- **Artillery**
   - ``artillery/test-script1-debug.yml``
      - Lance le script avec un seul learner
      - Le nom du learner est donné par le fichier .csv associé à la payload de la config yml
   - ``artillery/test-script1.yml`` 
      - Lance le script avec N users (voir propriété ``phases``)
      - Le nom du learner est donné par le fichier .csv associé à la payload de la config yml (lecture séquentielle)
   - ``artillery/test-vusers.yml`` 
      - Lance le script pour tester le fonctionnement d'artilery et des workers
   - Commandes
      - ``npm run artillery.script1``
      - ``npm run artillery.script1.debug``
      - ``npm run artillery.test.vusers``
      - ``npm run displayEnVariables`` pour afficher les variables d'environnment
 - workers
   - Artillery alloue par défaut 11 workers et lance les test dans ces workers. Si on lance 20 tests par exemple ile seront répartis entre les 10 workers. N scenarii peuvent s'exécuter dans un même worker ce qui n'est pas compatible avec le fonctionnement du ScriptRunner qui nécessite un worker par exécution (lié aux variables d'environnement).
   - Pour forcer le nombre de workers utiliser ``WORKERS`` ``WORKERS=100 artillery run ./artillery/test-vusers.yml``
 - **Report from .json file**
   - ``artillery report ./artillery-report/test-script1-debug-2023-07-21-5users.json``
- **Playwright**
   - ``playwright/script1.spec.js``
      - Lance le script avec un seul user dont le nom est donné par ``SLDX_PLAYWRIGHT_LEARNER_NAME`` ou l'argument ``--sldxpwleaner``
      - ```npm run playwright.script1.debug -- --sldxpwuser=user4 ```
      - ```npm run playwright.script1 -- --sldxpwuser=user4 ```
      - ```npm run playwright.script1 -- --sldxpwuser=user1 --ui``` ppour le mode UI interractif
   - **debuggage dans chromium**
      - Lancer le scripts en mode debug
      - Ouvrir la console JS dans chromium
      - L'objet playwright permet d'effectuer les tests ``await playwright.locator('#leaner')``
- **log scripts**
   - environment variable dans ;e fichier xx.dotenv ``SLDX_LOG_DIR_PATH = './_logs/$host/$day/tests'``
   - path pour le worker 5
      - ``_logs/localhost/2023-07-21/tests/tests.50616.w005.log``
   - Pour conserver les logs ``SLDX_LOG_DIR_REMOVE_FILES=true`` ou utiliser ``$date`` (``SLDX_LOG_DIR_PATH = './_logs/$host/$date/tests'``)
- **log runner**
   - ``runner.playwright.log``
   - ``runner.artillery.log``
- **screenshots si erreur playwright**
   - ``_logs/localhost/2023-07-21/tests/screenshots``
- **sMetrics©**
   - ``_logs/localhost/2023-07-21/tests/metrics``
- **CaddyFile logging configuration**
```
{
    debug off
    auto_https off
    http_port 80
    log default {
        level INFO
        output file ./access.log {
            roll_uncompressed
            roll_keep 10    
            roll_size 10Mib
        }
        format filter {
            wrap console
            fields {
                request>remote_ip   delete
                request>remote_port  delete
                request>proto       delete
                request>headers     delete
                request>host        delete
                size                delete
                user_id             delete
                resp_headers        delete
                request>uri regexp "(.*)\?.*$" "${1}"
            }
        }
    }
}
```
- **Utilitaires mongo**
   - ```_mongo/mongoRun.js``` ```npm run mongoRun -- --dryrun false/true```
   - **Mise à jour d password après import**
   - **Création de groupes avec différents lots (10, 50, 100...) d'utilisateurs**
      - ``testperfs.group.learners.1.10, testperfs.group.learners.11.20, testperfs.group.learners.801.900``
      - les indexes permettent d'accéder au profils qui composent ce group
      - ``testperfs.learners.1 -> testperfs.learners.10, testperfs.learners.801 -> testperfs.learners.900``
- **imports csv**
   - ``_mongo/users_16_6000.csv`` ``users_base.xlsx``
   - import par lot de 100 sinon plantage


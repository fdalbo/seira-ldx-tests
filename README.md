

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
  - la valeur par défaut 'local' (voir src/_helpers/env/defaultEnvVars.js)
- ``SLDX_ENV`` permet de piloter les fichiers de configuration
  - exemple pour ``npm run artillery.script1 -- --sldxenv=toto``
  - ``sldx.toto.dotenv`` surcharge les valeurs par défaut
    ```
        SLDX_PROXY_PROTOCOL: obligatoire
        SLDX_PROXY_HOST: obligatoire
        SLDX_ADMIN_USER: obligatoire
        SLDX_ADMIN_PASSWORD: obligatoire  
    ```
  - ``config.script1.toto.js`` surcharge la config de base (``config.script1.js``) si fichier présent
- ``SLDX_USER_PREFIX=user`` permet de calculer le nom de l'utilisatuer ``SLDX_USER_PREFIX + index (user1, user2...)``
## Les scripts
- **script1**
 - ``src/scripts/Script1.js``
    - Les scripts sont lancés par ``src/scripts/factory.js - runScript``
    - artillery: ``artillery/tests.js`` 
      - ``testFunction: "script1"`` du fichier ``.yml`` donne le nom du test à lancer
    - playwright: ``playwright/script1.spec.js`` 
      - Playwright est utilisé pour la mise au point
      - Artillery lance autant de tests playwright dans des workers node via la propriété ``- engine: playwright`` du fichier ``.yml``. La vaiable ``LOCAL_WORKER_ID`` est invréentée poru chaque wroker ce qui permet d'utiliser un user par worker basé sur l'index ``LOCAL_WORKER_ID`` et sur ``SLDX_USER_PREFIX`` (user1, user2....)
      - Playwright execute tous les tessts (un seul dans notre cas) en parallèle ou non (voir ``playwright.config.js``)
      - Playwright fonctionne comme JEST
- **Artillery**
 - ``artillery/test-script1-debug.yml``
   - Lance le script avec un seul user dont le nom est donné par ``SLDX_ARTILLERY_USER_FIRST_IDX``
   - Le nom du user = ``user(1+SLDX_ARTILLERY_USER_FIRST_IDX)``
   -  ``user8 pour SLDX_ARTILLERY_USER_FIRST_IDX = '7'``
 - ``artillery/test-script1.yml`` 
   - Lance le script avec N users (voir propriété ``phases``)
   - Dans chaque worker (sous-process) le user est calculé via le N° du worker (variable ``LOCAL_WORKER_ID``)
   -  ``user8 pour worker 8 LOCAL_WORKER_ID = '8'``
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
    - Lance le script avec un seul user dont le nom est donné par ``SLDX_PLAYWRIGHT_USER`` ou l'argument ``--sldxpwuser``
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


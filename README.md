
## Launch server
```osascript dev_scripts/start_full_project/mac.scpt```
## npm
```!!  "devDependencies": { "@playwright/test": "^1.36.0"} not "devDependencies": { "#playwright/test": "^1.36.0"}```
## esm modcules
```
    package.json: use 
        "imports":{ 
            "#commons/*": "./src/_helpers/commons/*",
        }
    import myConsole from '#commons/myConsole'
```
## Run playwright
```npx playwright test ./_playwright/tests/test.seira.spec.ts```
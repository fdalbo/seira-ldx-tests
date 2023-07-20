

## Install
[artillery](https://www.artillery.io/docs/get-started/get-artillery)
[playwright](https://playwright.dev/docs/intro)

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
## Run playwright
```npx playwright codegen http://localhost:2020/client```

npm run artillery.script1 -- --sldxenv=fdalbo
npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user3
npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user1 --debug
npm run playwright.script1 --  --sldxenv=fdalbo --sldxpwuser=user1 --ui

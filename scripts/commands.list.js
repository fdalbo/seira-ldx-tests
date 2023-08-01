"use strict";

const { pause } = require('#commons/promises');
const myConsole = require('#commons/myConsole');
const { commandsList } = require('#commons/npmutils');

/**
 * Node uncaughtException
 */
process.on('uncaughtException', function (err) {
    console.log()
    myConsole.error(`process.main.uncaughtException`, err)
    /** Let some time to flush the console */
    setTimeout(() => process.exit(), 500)
});


(async () => {
    const list = await commandsList()
    const margin = '   '
    list.forEach(x => {
        console.log('\n', x.title)
        if (x.scripts.length == 0) {
            console.log(margin, x.noScriptTitle)
        } else {
            x.scripts.forEach(y => {
                console.log(margin, y.title)
            })
        }
    })
    console.log()
    await pause(1000)
})()


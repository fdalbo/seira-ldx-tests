"use strict";

const myConsole = require('#commons/myConsole');
const { scriptList } = require('#commons/npmutils');
const runCmd = require('#env/runner-command');


const _verbose = false;

(async () => {
    const _log = (...args) => _verbose && myConsole.color.apply(myConsole, ['cyanBright', ...args, '\n'])
    let currentCmd = null
    let error = null
    try {
        _log(`RUN.BEGIN`)
        const args = process.argv.slice(2)
        if (args.length == 0) {
            _log(`No arguments. Item index(es) expected\n-> npm run items 3.2 3.3 3.4`)
            process.exit()
        }
        _log('args', args.join(','))
        const scripts = await scriptList()
        const itemIndexes = scripts.map(x => `${x.idx}`)
        const unknownIndexes = args.reduce((acc, a) => itemIndexes.includes(a) ? acc : acc.push(a) && acc, [])
        if (unknownIndexes.length > 0) {
            _log(`Item index(es) '${unknownIndexes.join(', ')}' not found\n-> Check with 'npm run list'`)
            process.exit()
        }
        const commands = args.map(idx => scripts.find(x => idx == x.idx)).map(x => x.cmd)
        _log(`COMMANDS${JSON.stringify(commands, null, 2)}`)
        let idx = 1
        for (currentCmd of commands) {
            _log(`[${idx}] RUN.CMD.BEGIN\n${currentCmd}`)
            runCmd(currentCmd)
            _log(`[${idx}] RUN.CMD.END.OK\n${currentCmd}`)
            idx++
        }
    } catch (e) {
        error = e
        console.error(`RUN.ERROR${currentCmd ? ` [RUNNING '${currentCmd}']` : ''}`, error)
    } finally {
        _log(`RUN.BEGIN.${error ? 'KO' : 'OK'}`)
    }
})()

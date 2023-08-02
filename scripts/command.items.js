"use strict";

const myConsole = require('#commons/myConsole');
const { scriptList } = require('#commons/npmutils');
const runCmd = require('#env/runner-command');
const parseArguments = require('minimist')


const _verbose = false;

(async () => {
    const _log = (...args) => _verbose && myConsole.color.apply(myConsole, ['cyanBright', ...args, '\n'])
    let currentCmd = null
    let error = null
    try {
        _log(`RUN.BEGIN`)
        const minimistOpts = {}
        const parsedArguments = parseArguments(process.argv.slice(2), minimistOpts)
        const argsIndexes = (parsedArguments._ ?? []).map(x => `${x}`)
        if (argsIndexes.length == 0) {
            _log(`No arguments. Item index(es) expected\n-> npm run items 3.2 3.3 3.4`)
            process.exit()
        }
        const additionalArguments = []
        for (const [key, value] of Object.entries(parsedArguments)) {
            key !=  '_'  && additionalArguments.push(`--${key}=${value}`)
        }
        _log('args', JSON.stringify(additionalArguments, null, 2))
        const scripts = await scriptList()
        _log(JSON.stringify(scripts, null, 2))
        const itemIndexes = scripts.map(x => `${x.idx}`)
        const unknownIndexes = argsIndexes.reduce((acc, a) => itemIndexes.includes(a) ? acc : acc.push(a) && acc, [])
        if (unknownIndexes.length > 0) {
            _log(`Item index(es) '${unknownIndexes.join(', ')}' not found\n-> Check with 'npm run list'`)
            process.exit()
        }
        const commands = argsIndexes.map(idx => scripts.find(x => idx == x.idx)).map(x => {
            return `${x.cmd} ${additionalArguments.length > 0 ? `-- ${additionalArguments.join(' ')}` : ''}`
        })
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

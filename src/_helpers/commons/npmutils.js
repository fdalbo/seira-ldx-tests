"use strict";

const _ = require('lodash')
const readPackageJon = require('read-package-json')
const chalk = require('chalk')
const path = require('path')
const appRootDir = require('app-root-dir')
const escapeStringRegexp = require('escape-string-regexp')


/**
 * See package.json.scripts
* 'jestitems' launches the npm command in silent mode (command-items-jest.js) contrary to 'items' (command-items.js)
 * @param {*} workspace 
 * @param {*} npmCommand 
 * @returns 
 */
const _itemsCmd = (workspace, npmCommand) => {
    if (workspace === 'apps/qsfab-tests') {
        /** This is jest script launched by jest-cli/bin/jest */
        const isJestTest = npmCommand.match(/npx\s+jest/) || npmCommand.match(/\stest\..*\.js/)
        if (isJestTest != null && isJestTest.length === 1) {
            return 'jestitems'
        }
    }
    return 'items'
}
/**
 * Scans the workspaces and the attached package.json
 * @returns {array} 
 */
const _commandsList = async (textSearched) => {
    textSearched ??= ''
    const textSearchRegexp = new RegExp(escapeStringRegexp(textSearched), 'gi')
    const _scanWorkspace = async (workspace = null, workspaceIdx) => {
        const res = {}
        const packageJsonPath = path.resolve(appRootDir.get(), workspace ? `./${workspace}/package.json` : './package.json')
        res.name = workspace ? workspace.split('/').pop() : 'root'
        return new Promise((resolve, reject) => {
            readPackageJon(packageJsonPath, console.error, false, function (err, data) {
                try {
                    if (err) {
                        throw new Error('Error loading package.json', {
                            cause: err
                        })
                    }
                    const entries = Object.entries(data.scripts)
                    res.idx = workspaceIdx
                    res.workspaces = data.workspaces ?? []
                    res.title = chalk.magenta(`${workspaceIdx} Commands list ${res.name.toUpperCase()}:`)
                    res.scripts = []
                    if (!_.isEmpty(textSearched) && res.scripts.length === 0) {
                        res.noScriptTitle = chalk.yellow(`No script found for text search '${textSearched}'`)
                    } else {
                        res.noScriptTitle = chalk.yellow(`No script`)
                    }
                    if (entries.length > 0) {
                        let i = 0
                        for (const [scriptName, npmCommand] of entries) {
                            i++
                            let displayedScriptName = scriptName
                            if (!_.isEmpty(textSearched)) {
                                displayedScriptName = scriptName.replace(textSearchRegexp, chalk.whiteBright('$&'))
                                if (displayedScriptName === scriptName) {
                                    continue
                                }
                                /*
                                if (scriptName.toLowerCase().includes(textSearched)) {
                                    displayedScriptName = scriptName.replace(new RegExp(`${textSearched}`, 'gi'), chalk.whiteBright(textSearched))
                                } else {
                                    continue
                                }
                                */
                            }
                            const itemIdx = `${workspaceIdx}.${i}`
                            const cmd = `npm run ${displayedScriptName} ${workspace ? `-w ${workspace}` : ''}`
                            res.scripts.push({
                                idx: itemIdx,
                                cmd: cmd,
                                title: `${chalk.yellow(`npm run ${_itemsCmd(workspace, npmCommand)} ${itemIdx}`.padEnd(30, ' '))}${chalk.grey(cmd)}`
                            })
                        }
                    }
                    resolve(res)
                } catch (error) {
                    reject(error)
                }
            })
        })

    }
    let idx = 0
    const res = []
    const data = await _scanWorkspace(null, idx++)
    res.push(data)
    const workspaces = data.workspaces ?? []
    for await (const workspace of workspaces) {
        const data = await _scanWorkspace(workspace, idx++)
        res.push(data)
    }
    return res
}

module.exports.commandsList = async () => {
    const args = process.argv.slice(2)
    const textSearched = (args[0] ?? '').toLowerCase()
    return _commandsList(textSearched)
}

module.exports.scriptList = async () => {
    const list = await _commandsList(null)
    const scripts = []
    list.forEach(item => {
        item.scripts.forEach(script => {
            scripts.push(script)
        })
    })
    return scripts
}
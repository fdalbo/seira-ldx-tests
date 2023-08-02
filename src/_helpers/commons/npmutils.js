"use strict";

const _ = require('lodash')
const readPackageJon = require('read-package-json')
const chalk = require('chalk')
const path = require('path')
const appRootDir = require('app-root-dir')
const escapeStringRegexp = require('escape-string-regexp')

const _chalk = (cmd)=>{
    if(cmd.toLowerCase().includes('artillery')) return chalk.magenta(cmd)
    if(cmd.toLowerCase().includes('playwright')) return chalk.cyan(cmd)
    if(cmd.toLowerCase().includes('tools')) return chalk.green(cmd)
    return chalk.grey(cmd)

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
                    res.title = chalk.magenta(`Commands list:`)
                    res.scripts = []
                    if (!_.isEmpty(textSearched) && res.scripts.length === 0) {
                        res.noScriptTitle = chalk.yellow(`No script found for text search '${textSearched}'`)
                    } else {
                        res.noScriptTitle = chalk.yellow(`No script`)
                    }
                    if (entries.length > 0) {
                        let itemIdx = 0
                        for (const [scriptName, npmCommand] of entries) {
                            itemIdx++
                            let displayedScriptName = scriptName
                            if (!_.isEmpty(textSearched)) {
                                displayedScriptName = scriptName.replace(textSearchRegexp, chalk.whiteBright('$&'))
                                if (displayedScriptName === scriptName) {
                                    continue
                                }
                            }
                            const cmd = `npm run ${displayedScriptName} ${workspace ? `-w ${workspace}` : ''}`
                            res.scripts.push({
                                idx: itemIdx,
                                cmd: cmd,
                                title: _chalk(`${`npm run items ${itemIdx}`.padEnd(30, ' ')} ${cmd}`)
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
'use strict';

import path from 'path'
import appRootDir from 'app-root-dir'
import readPckgAsync from 'read-package-json'
import myConsole from '#commons/myConsole'
import assert from 'assert'
import _ from 'lodash'

export const readPackageJson = async (rootDir, fail = true) => new Promise((resolve, reject) => {
    const packagePath = path.resolve(rootDir, 'package.json')
    readPckgAsync(packagePath, console.error, false, (err, data) => {
        if (err && fail) {
            reject(new Error(`Error loading package.json\n${packagePath}`, {
                cause: err
            }))
        } else {
            resolve(err || _.isEmpty(data) ? null : data)
        }
    })
})
export const getWorkspaceRootPath = async () => {
    if (!process.env.SLDX_WORKSPACE_ROOTDIR) {
        let rootDir = appRootDir.get()
        let pckgJSon = await readPackageJson(rootDir, false)
        assert.notStrictEqual(pckgJSon, null, `${rootDir} is not an npm root directory - empty package json`)
        if ((pckgJSon.workspaces ?? []).length == 0) {
            rootDir = path.resolve(rootDir, '../..')
            pckgJSon = await readPackageJson(rootDir, false)
            assert.notStrictEqual(pckgJSon, null, `${rootDir} is not an npm root directory - empty package json`)
            assert.ok((pckgJSon.workspaces ?? []).length > 0, `${rootDir} is not an npm workspace root directory - no workspaces properties in package json`)
        }
        process.env.SLDX_WORKSPACE_ROOTDIR = rootDir
        myConsole.highlight(`process.env.SLDX_WORKSPACE_ROOTDIR: '${rootDir}'`)
    }
    return process.env.SLDX_WORKSPACE_ROOTDIR
}

export const resolveFromWorkspaceRoot = async (filePath) => path.resolve(await getWorkspaceRootPath(), filePath)
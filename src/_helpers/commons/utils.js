'use strict';

import jmespath from 'jmespath'
import _ from 'lodash'
import path from 'path'
import fs from 'fs'
import clone from 'clone'
import isValidPath from 'is-valid-path'


export function jsonSearch(data = {}, expression, klone = true) {
    if (!_.isPlainObject(data)) {
        throw new Error(`JS PlainObject expected`)
    }
    const res = jmespath.search(data, expression)
    klone = klone && res != null && typeof res === 'object'
    return res == null || klone === false ? res : clone(res)
}

/**
 * @returns the first value that match expression (Eg: data.*.targetId)
 */
export function jsonSearchFirst(data = {}, expression, klone) {
    const res = jsonSearch(data, expression, klone)
    if (res == null || !Array.isArray(res)) {
        return res
    }
    return res.length == 0 ? null : res[0]
}

export function sortById(a, b) {
    return sortByProp('id', a,b)
}

export function sortByProp(prop, a, b) {
    return a[prop] > b[prop] ? 1 : a[prop] < b[prop] ? -1 : 0
}

export function base64ToJson(b64str) {
    try {
        if (!b64str) return b64str
        return JSON.parse(Buffer.from(b64str, 'base64'))
    } catch (e) {
        throw new Error(`Can't decode base 64 string into JSON`, {
            cause: e
        })
    }
}

/**
 * @param {string} path  File or dir path
 * @returns true if the parent directory exists
 */
export function checkParentPath(fileOrDirPath) {
    return isValidPath(fileOrDirPath) && fs.existsSync(path.dirname(fileOrDirPath))
}

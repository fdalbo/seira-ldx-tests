'use strict';

const jmespath = require('jmespath')
const _ = require('lodash')
const path = require('path')
const fs = require('fs')
const clone = require('clone')
const isValidPath = require('is-valid-path')


module.exports.jsonSearch = function (data = {}, expression, klone = true) {
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
module.exports.jsonSearchFirst = function (data = {}, expression, klone) {
    const res = jsonSearch(data, expression, klone)
    if (res == null || !Array.isArray(res)) {
        return res
    }
    return res.length == 0 ? null : res[0]
}

module.exports.sortById = function (a, b) {
    return sortByProp('id', a, b)
}

module.exports.sortByProp = function (prop, a, b) {
    return a[prop] > b[prop] ? 1 : a[prop] < b[prop] ? -1 : 0
}

module.exports.base64ToJson = function (b64str) {
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
module.exports.checkParentPath = function (fileOrDirPath) {
    return isValidPath(fileOrDirPath) && fs.existsSync(path.dirname(fileOrDirPath))
}

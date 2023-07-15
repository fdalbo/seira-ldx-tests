
"use strict";

import _moment from 'moment-timezone'
import _numeral from 'numeral'

import {
    DATE_PARSE_OBILOG,
    DATE_UTC_STR,
    DATE_UTC_EPOCH
} from './consts'

const _dateParsingFormats = new Map()
_dateParsingFormats.set(DATE_PARSE_OBILOG, "DD/MM/YYYY hh:mm:ss")

const _unitIds = {
    "PCE": "PIECE",
    "HUR": "HOUR",
    "MIN": "MINUTE",
    "SEC": "SECOND",
    "DAY": "DAY",
}

const __status_op = {
    "0": "RELEASED",
    "1": "ONGOING",
    "2": "SUSPENDED",
    "3": "COMPLETED",
    "4": "CLOSED",
    "5": "ASSIGNED"
}

export const getUnitId = (id) => {
    const res = _unitIds[id]
    if (!res) {
        throw new Error(`Unit id[${id}] not found`)
    }
    return res
}

export const getOpStatus = (id) => {
    const res = __status_op[id]
    if (!res) {
        throw new Error(`Status operation id[${id}] not found`)
    }
    return res
}

export const getBoolean = (id) => {
    return id === '1' ? 'true' : 'false'
}

export const getDate = (dateStr, opts) => {
    opts ??= {}
    const parsingFormat = opts.parsingFormat ?? ''
    const format = _dateParsingFormats.get(parsingFormat)
    if (!format) {
        throw new Error(`Unknown date parsingFormat - opts.parsingFormat='${parsingFormat}'`)
    }
    const valueFormat = opts.valueFormat ?? DATE_UTC_STR
    /** 
     * UTC convertion depends on the timezone:
     * --> _moment TimeZone is initialized by the caller depending on the 'timeZone' option (see CSV2JSON) ('Europe/Paris' by default)
     * --> _moment.tz.setDefault(opts.timeZone)
     */
    const date = _moment(dateStr, format)
    if (valueFormat === DATE_UTC_STR) {
        return date.utc().format()
    }
    if (valueFormat === DATE_UTC_EPOCH) {
        return date.utc().valueOf()
    }
    throw new Error(`Unknown date valueFormat - opts.valueFormat='${valueFormat}'`)
}

export const getInteger = (cellStr) => {
    cellStr = (cellStr ?? '').trim()
    if (cellStr.length === 0) {
        return 0
    }
    /** 
     * String number parsing depends on the local (thousandSep...):
     *  --> _numeral locale is initialized by the caller depending on the 'locale' option (see CSV2JSON) ('fr' by default)
     *  --> _numeral.locale(opts.locale)
     */
    return Math.floor(_numeral(cellStr).value())
}

export const getDecimal = (cellStr) => {
    cellStr = (cellStr ?? '').trim()
    if (cellStr.length === 0) {
        return 0
    }
    /** 
     * String number parsing depends on the local (thousandSep...):
     *  --> _numeral locale is initialized by the caller depending on the 'locale' option (see CSV2JSON) ('fr' by default)
     *  --> _numeral.locale(opts.locale)
     */
    return _numeral(cellStr).value()
}

export const checkId = (id) => {
    id = (id ??= '').trim()
    if (id == null || id.length === 0 || id.length > 36) {
        throw new Error(`Bad entity id[${id}] length[${(id ?? '').length}]`)
    }
    return id
}
export const checkExternalId = (externalId) => {
    externalId = (externalId ??= '').trim()
    if (externalId == null || externalId.length === 0 || externalId.length > 255) {
        throw new Error(`Bad entity externalId[${externalId}] length[${(externalId ?? '').length}]`)
    }
    return externalId
}

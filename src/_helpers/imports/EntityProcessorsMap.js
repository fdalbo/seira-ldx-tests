"use strict";

import _ from 'lodash'
import myConsole from '../commons/myConsole';
import {
    descriptions as _entitiesDescriptors,
    calculateProperties as _calculateProperties,
    processEntityBegin as _processEntityBegin,
    processEntityEnd as _processEntityEnd
} from './descr.entities'
import {
    getUnitId as _getUnitId,
    getOpStatus as _getOpStatus,
    getBoolean as _getBoolean,
    getDate as _getDate,
    getInteger as _getInteger,
    getDecimal as _getDecimal
} from './descr.references'
import {
    CSV_SEP,
    TYPE_BOOL,
    TYPE_INTEGER,
    TYPE_DECIMAL,
    TYPE_DATE,
    TYPE_STR,
    TYPE_UUID,
    TYPE_JSON,
    TYPE_OP_STATUS,
    ENTITY_UNITS,
    ENTITY_MACHINE_GROUP,
    ENTITY_MACHINES,
    PROP_EXTERNAL_UID,
    REGEXP_EXTRACT_VALUE,
    SKIP_CELL
} from './consts'

const _getIdPropertyName = (entity) => {
    if (entity === ENTITY_MACHINES) {
        /** :-( */
        return 'machineId'
    }
    return 'id'
}

const _superVerbose = false
class CellProcessor {
    #dataType = null
    #erpPropertyName = null
    #quasarmesPropertyName = null
    /** Array of strings */
    #opts = null
    #jsonPath = null
    constructor(dataType, erpPropertyName, quasarmesPropertyName, opts) {
        this.#opts = opts ?? ''
        this.#dataType = dataType
        this.#erpPropertyName = erpPropertyName
        this.#quasarmesPropertyName = quasarmesPropertyName
        /** JSON FIELDS - erpinfo1~data.info1~json */
        this.#jsonPath = this.#quasarmesPropertyName.split('.')
        if (this.#jsonPath.length === 1) {
            /** not a json field */
            this.#jsonPath = null
        } else if (this.#jsonPath.length === 2) {
            /** field 'data' for erpinfo1~data.info1~string (one level of depth) -> {data:{info1:value}} */
            this.#quasarmesPropertyName = this.#jsonPath[0]
        } else {
            /** Add infinite levels if needed - erpinfo1~data.lev1.lev2.lev3~string -> {dada:{lev1:{lev2:{lev3:value}}}} */
            throw new Error(`FIeld '${erpPropertyName}~${quasarmesPropertyName}' - JSON field accepts only one level of depth`)
        }
    }
    get skip() {
        return this.#erpPropertyName === SKIP_CELL
    }
    get isJson() {
        return this.#jsonPath != null
    }
    get dataType() {
        return this.#dataType
    }
    get erpPropertyName() {
        return this.#erpPropertyName
    }
    get quasarmesPropertyName() {
        return this.#quasarmesPropertyName
    }
    processCell(erpStr, jsonObject) {
        /** working raw data */
        jsonObject[this.erpPropertyName] = erpStr
        if (!this.quasarmesPropertyName) {
            _superVerbose && myConsole.color('yellow', this.quasarmesPropertyName, this.dataType, `'${erpStr}'`, 'No mapping')
            /** no mapping - working value used for calculations */
            return jsonObject
        }
        /** quasarmes payload data*/
        let fieldValue = this.erpStr2quasarmesValue(erpStr)
        if (this.isJson) {
            /**
             *  info1~data.info1~json'
             *  info2~data.info2~json'
             *  --> {
             *          data:{ 
            *                 info1: value,
            *                 info2: value
             *          }
             *      }
             */
            const jsonValue = jsonObject.quasarmes[this.quasarmesPropertyName] ?? {
                /** type used only to not mistake PlainOject value with uuid association */
                _type_: TYPE_JSON
            }
            jsonValue[this.#jsonPath[1]] = fieldValue
            fieldValue = jsonValue
        }
        jsonObject.quasarmes[this.quasarmesPropertyName] = fieldValue
        return jsonObject
    }
    erpStr2quasarmesValue(erpStr, jsonObject) {
        _superVerbose && myConsole.color('blue', this.quasarmesPropertyName, this.dataType, `'${erpStr}'`)
        switch (this.dataType) {
            case TYPE_STR:
                return erpStr
            case TYPE_BOOL:
                return _getBoolean(erpStr)
            case TYPE_OP_STATUS:
                return _getOpStatus(erpStr)
            case TYPE_INTEGER:
                return _getInteger(erpStr)
            case TYPE_DECIMAL:
                return _getDecimal(erpStr)
            case TYPE_DATE:
                /**  
                 * dte_hre_deb_prev~startPlannedDate~date~obilog~epoch' 
                 * parsingFormat-> obilog
                 * valueFormat-> epoch
                 */
                return _getDate(erpStr, {
                    parsingFormat: this.#opts[0],
                    valueFormat: this.#opts[1]
                })
            default:
                throw new Error(`Unknown cell type '${this.dataType}'`)
        }
    }
}

class UnitsUuidProcessor extends CellProcessor {
    constructor(erpPropertyName, quasarmesPropertyName) {
        super(TYPE_STR, erpPropertyName, quasarmesPropertyName)
    }
    processCell(cellStr, jsonObject) {
        _superVerbose && myConsole.color('blue', this.quasarmesPropertyName, TYPE_UUID, `'${cellStr}'`)
        /** working raw data */
        jsonObject[this.erpPropertyName] = cellStr
        /** quasarmes payload data*/
        jsonObject.quasarmes[this.quasarmesPropertyName] = {
            _type_: TYPE_UUID,
            id: _getUnitId(cellStr),
            entity: ENTITY_UNITS
        }
        return jsonObject
    }
}

class EntityProcessor {
    #entityDescriptor = null
    #processorsMap = null
    #cellProcessors = []
    #jsonResult = null
    #done = false
    #opts = null
    constructor(entityDescriptor, processorsMap, opts) {
        this.#opts = Object.assign({
            verbose: false
        }, opts ?? {})
        this.#entityDescriptor = entityDescriptor
        this.#processorsMap = processorsMap
        for (const header of this.#entityDescriptor.header) {
            this.#cellProcessors.push(this.#getCellProcessor(header))
        }
    }
    get opts() {
        return this.#opts
    }
    get verbose() {
        return this.opts.verbose
    }
    get entityDescriptor() {
        return this.#entityDescriptor
    }
    get processorsMap() {
        return this.#processorsMap
    }
    get tagName() {
        return this.entityDescriptor.tag
    }
    get entityId() {
        return this.entityDescriptor.entityId
    }
    getDataByExternalUid(externalUid) {
        /** jsonResult contains only quasar mes payload objects*/
        if (this.#jsonResult == null) {
            this.#throwError('getDataByExternalUid', 'Unexpected null jsonResult')
        }
        return this.#jsonResult.find(x => x[PROP_EXTERNAL_UID] === externalUid)
    }
    processBegin() {
        if (this.#done === true) {
            this.#throwError('processBegin', 'Entity already processed')
        }
        this.#jsonResult = []
        _processEntityBegin(this.entityDescriptor)
    }
    processLine(lineStr, lineNumber) {
        const jsonData = {
            /** technical and  erp data */
            _rank: lineNumber,
            /** The payload for quasar MES API */
            quasarmes: {
            }
        }
        const cells = lineStr.split(CSV_SEP).map(cellStr => {
            const quotedContent = cellStr.match(REGEXP_EXTRACT_VALUE)
            return quotedContent == null ? cellStr : (quotedContent[1] ?? '')
        })
        if (cells.length == 0) {
            this.#throwError(`processLine.${lineNumber}`, `CellProcessor not found - lineStr[${lineStr}]`)
        }
        if (cells.length !== this.#cellProcessors.length) {
            this.#throwError(`processLine.${lineNumber}`, `The number of columns[${cells.length}] must be equal to the number of headers[${this.#cellProcessors.length}] - lineStr[${lineStr}]`)
        }
        _superVerbose && myConsole.color('green', lineStr)
        cells.forEach((cellStr, index) => {
            const processor = this.#cellProcessors[index]
            if (processor.skip) {
                _superVerbose && myConsole.color('cyan', 'cellStr - skipped')
                return
            }
            _superVerbose && myConsole.color('cyan', 'cellStr', cellStr)
            processor.processCell(cellStr, jsonData, this.entityDescriptor)
        })
        /** calculated fields - return false if record is skipReason is not null */
        const skipReason = _calculateProperties(jsonData, this.entityDescriptor)
        if (skipReason != null) {
            myConsole.color('yellow', `Skip entity '${this.entityId}' rank[${lineNumber}] reason[${skipReason}]`)
            myConsole.lowlight(lineStr)
            return
        } else {
            this._checkAssociations(jsonData)
            if (this.verbose) {
                myConsole.color('green', `Push entity '${this.entityId}' id=${jsonData.quasarmes.externalUniqueId ?? `'none'`} rank=${lineNumber}`)
                myConsole.lowlight(lineStr)
                myConsole.lowlight(JSON.stringify(jsonData, null, 2))
            }
            /** We store only quasar MES payload API */
            this.#jsonResult.push(jsonData.quasarmes)
        }
    }
    _checkAssociations(jsonData) {
        for (const [key, value] of Object.entries(jsonData.quasarmes)) {
            if (!_.isPlainObject(value) || value._type_ !== TYPE_UUID || value.entity === ENTITY_UNITS) {
                continue
            }
            let linkedEntity = value.entity
            if (linkedEntity === ENTITY_MACHINE_GROUP) {
                /**
                 * Machine's group is created whith the machine so we check the presence of the machine
                 */
                linkedEntity = ENTITY_MACHINES
            }
            const processor = this.processorsMap.getByEntityId(linkedEntity)
            let error = null
            if (processor == null) {
                error = `No processor found for entity [${linkedEntity}] - Entity [${linkedEntity}] must be declared before the current entity in csv file`
            }
            if (!error && processor.getDataByExternalUid(value.externalUniqueId) == null) {
                error = `Linked entity [${linkedEntity}] not found with ${_getIdPropertyName(linkedEntity)} [${value.externalUniqueId}]`
            }
            if (error) {
                this.#throwError(`checkAssociations.${key}`, error)
            }
        }
    }
    processEnd(resultJson) {
        /** Calculate properties that needs the presence of all entities */
        _processEntityEnd(this.#jsonResult, this.entityDescriptor)
        /** quasar mes payload only - not erp data */
        if (this.#jsonResult.length > 0) {
            /** some entities can be skipped - empty array fail in test cases */
            resultJson[this.entityId] = this.#jsonResult
        }
        this.#done = true
        /** jsonResult must stay in memory for linked entities*/
        return this.#jsonResult
    }
    #getCellProcessor(headerDescriptor) {
        const headerInfo = headerDescriptor.split('~')
        const erpPropertyName = headerInfo[0].trim()
        /** mandatory */
        if (erpPropertyName.length == 0) {
            this.#throwError('getCellProcessor', `Empty erpPropertyName - index [0] - [${headerDescriptor}]`)
        }
        /** empty allowed */
        const quasarmesPropertyName = (headerInfo[1] ?? '').trim()
        const dataType = headerInfo[2] ?? TYPE_STR
        switch (dataType) {
            case TYPE_STR:
            case TYPE_BOOL:
            case TYPE_INTEGER:
            case TYPE_DECIMAL:
            case TYPE_OP_STATUS:
            case TYPE_DATE:
                /** 'label' or 'autoControl~bool'... */
                const options = headerInfo.slice(3)
                return new CellProcessor(dataType, erpPropertyName, quasarmesPropertyName, options)
            case TYPE_UUID:
                /** 'unitUuidQuantity~uuid~units' */
                let linkedEntityId = (headerInfo[3] ?? '').trim()
                if (linkedEntityId === ENTITY_UNITS) {
                    return new UnitsUuidProcessor(erpPropertyName, quasarmesPropertyName)
                }
                /** Other entity associations are processed by calculation because we need to calculate the id of the linked entity with the data (no unic id provided...) */
                this.#throwError('getCellProcessor', `Linked entity[${linkedEntityId}] of type '${linkedEntityId}' must be processed by the '_calculate' method of entity descriptor - header[${headerDescriptor}]`)
            default:
                this.#throwError('getCellProcessor', `Unknown header type[${type}]`)
        }
    }
    #throwError(method, message) {
        throw new Error(`EntityProcessor.${this.entityId}.${method} - ${message}`)
    }
}
class EntityProcessorsMap {
    #entityMap = new Map()
    #tagMap = new Map()
    constructor(opts) {
        for (const entityDescriptor of _entitiesDescriptors) {
            const processor = new EntityProcessor(entityDescriptor, this, opts)
            if (this.#tagMap.get(entityDescriptor.tag)) {
                throw new Error(`Duplicated tag name[${entityDescriptor.tag}] in entities description`)
            }
            this.#tagMap.set(entityDescriptor.tag, processor)
            if (this.#entityMap.get(entityDescriptor.entityId)) {
                throw new Error(`Duplicated entityId[${entityDescriptor.entityId}] in entities description`)
            }
            this.#entityMap.set(entityDescriptor.entityId, processor)
        }
    }
    getByTag(tag) {
        return this.#tagMap.get(tag)
    }
    getByEntityId(entityId) {
        return this.#entityMap.get(entityId)
    }
}

export default EntityProcessorsMap
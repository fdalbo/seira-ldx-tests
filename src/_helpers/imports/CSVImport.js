
import * as qsPlant from '../api/qsPlant'
import * as qsFab from '../api/qsFab'
import myConsole from '../commons/myConsole'
import fs from 'fs'
import path from 'path'
import _ from 'lodash'
import CSV2JSON from './CSV2JSON'
import {
    ENTITY_UNITS,
    ENTITY_MACHINES,
    ENTITY_GROUPS,
    ENTITY_MACHINE_GROUP,
    ROOT_GROUP,
    TYPE_UUID,
    TYPE_JSON,
    TYPE_PARAMS
} from './consts'

class CSVImport {

    #uuidsByEntity = new Map()
    #machineGroupUuids = new Map()
    #opts = null

    constructor(opts) {
        this.#opts = Object.assign({
            putEnabled: false
        }, opts ?? {})
    }

    get putEnabled() {
        return this.#opts.putEnabled === true
    }

    #setUuid(ctx, entityId, entityData, response) {
        const uuid = response.body.data.uuid
        if (!uuid) {
            throw new Error(`setUuid.${entityId} - Unexpected null uuid`)
        }
        /** 
         * We store the uuid/machineGroupUuid in entityData because we could need them in some test cases
         * Eg:  In development mode we import the csv one time in order to create the entities and get the uuids (see _skipImport)
         *      We store the data into a file and are able to launch the tests without having to do an import each time
         *      If a test needs the uuid or machineGroupUuid we are able to read it
         */
        entityData.uuid = uuid
        const externalUniqueId = entityData.externalUniqueId
        if (!externalUniqueId) {
            throw new Error(`setUuid.${entityId} - Unexpected null externalUniqueId`)
        }
        let uuidsMap = this.#uuidsByEntity.get(entityId)
        if (!uuidsMap) {
            uuidsMap = new Map()
            this.#uuidsByEntity.set(entityId, uuidsMap)
        }
        uuidsMap.set(externalUniqueId, uuid)
        if (entityId === ENTITY_MACHINES) {
            /** 
             * we read the machine's group created with the machine and store it in the map
             * the group uuid will be used for 'machinegroup' associations 
             */
            const machineGroupUuid = response.body?.data?.group_doc?.uuid ?? ''
            if (!machineGroupUuid) {
                throw new Error(`setUuid.${entityId} - Unexpected null machineGroupUuid`)
            }
            this.#machineGroupUuids.set(externalUniqueId, machineGroupUuid)
            /** We store the machineGroupUuid  (see uuid above _skipImport)*/
            entityData.machineGroupUuid = machineGroupUuid
        }
        /** put entity/id in cache to be removed automaticaly by the cleanupManager (see beforeAll/afterAll test) */
        ctx.cleanupManager && ctx.cleanupManager.addById(`csv-${entityId}-${externalUniqueId}`, entityId, response)
        return true
    }

    #getUuid(entityId, externalUniqueId) {
        const uuidsMap = this.#uuidsByEntity.get(entityId)
        if (!uuidsMap) {
            throw new Error(`getUuid.${entityId} - Unexpected null uuidsMap`)
        }
        return uuidsMap.get(externalUniqueId)
    }

    logStep(text) {
        myConsole.color('magentaBright', text)
    }

    logError(text, e) {
        myConsole.color('red', text)
        myConsole.error(e)
    }

    csvfile2Jsonfile(csvFilePath, jsonFilePath, opts) {
        this.logStep(`csvfile2Jsonfile.begin`)
        myConsole.lowlight(`csvFilePath: ${csvFilePath}`)
        const processor = new CSV2JSON(opts)
        processor.run(csvFilePath)
        if (fs.existsSync(jsonFilePath)) {
            fs.rmSync(jsonFilePath)
        }
        fs.writeFileSync(jsonFilePath, JSON.stringify(processor.resultJson, null, 2))
        myConsole.lowlight(`jsonFilePath: ${jsonFilePath}`)
        this.logStep(`csvfile2Jsonfile.end`)
        return processor.resultJson
    }

    csvfile2Json(csvFilePath, opts) {
        this.logStep(`csvfile2Json.begin`)
        myConsole.lowlight(`csvFilePath: ${csvFilePath}`)
        const processor = new CSV2JSON(opts)
        processor.run(csvFilePath)
        this.logStep(`csvfile2Json.end`)
        return processor.resultJson
    }


    /**
     * Imports all the entities from csvFilePath
     * @param {FabContext or at least {company: company}} ctx access to unitUuids, ROOT_GROUP... 
     * @param {*} csvFilePath 
     * @param {*} opts  see CSV2JSON 
     * @param {*} entityCallBack called after each import
     * @returns jsonData created from csv file with the uuids of the enties
     */
    async importCsvFile(ctx, csvFilePath, opts, entityCallBack) {
        const step = `import.importCsvFile.${path.basename(csvFilePath)}`
        this.logStep(`${step}.begin`)
        myConsole.lowlight(`csvFilePath: ${csvFilePath}`)
        const processor = new CSV2JSON(opts)
        processor.run(csvFilePath)
        await this.importEntities(ctx, processor.resultJson, entityCallBack)
        this.logStep(`${step}.end`)
        /** jsonData updtaed with uuids */
        return processor.resultJson
    }

    /**
     * Imports all the entities from jsonFilePath (created from csv file)
     * @param {FabContext or at least {company: company}} ctx access to unitUuids, ROOT_GROUP... 
     * @param {*} jsonFilePath 
     * @param {*} entityCallBack called after each import
     * @returns jsonData created from csv file with the uuids of the enties
     */
    async importJsonFile(ctx, jsonFilePath, entityCallBack) {
        const step = `import.importJsonFile.${path.basename(jsonFilePath)}`
        this.logStep(`${step}.begin`)
        myConsole.lowlight(`jsonFilePath: ${jsonFilePath}`)
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath))
        await this.importEntities(ctx, jsonData, entityCallBack)
        this.logStep(`${step}.end`)
        /** jsonData updated with uuids */
        return jsonData
    }

    /**
     * Import all the entities given by jsonData
     * The order is given by the chronological order of property creation (top to down)
     * @param {FabContext or at least {company: company}} ctx access to unitUuids, ROOT_GROUP... 
     * @param {jsonObject} jsonData 
     * {
     *      entityId1:[{entityData}, {entityData}],
     *      entityId2:[{entityData}, {entityData}]
     * }
     * !! entityData is updated with the uuid of the created entities
     * @param {*} entityCallBack called after each import
     */
    async importEntities(ctx, jsonData, entityCallBack) {
        jsonData ??= {}
        const entries = Object.entries(jsonData)
        const step = `import.importEntities.${entries.length}`
        this.logStep(`${step}.begin`)
        let cpt = 0
        for await (const [entityId, jsonDataArray] of entries) {
            await this.importEntityArray(ctx, entityId, jsonDataArray ?? [], entityCallBack)
            cpt = cpt + jsonDataArray.length
        }
        this.logStep(`${step}.end - nbEntities[${cpt}]`)
        /** jsonData updtaed with uuids */
        return jsonData
    }
    /**
     * Import an array of entities 
     * [{entityData},...]
     * !! entityData is updated with the uuid of the created entities
     * @param {FabContext or at least {company: company}} ctx access to unitUuids, ROOT_GROUP... 
     * @param {string} entityId 'customers', 'items'..
     * @param {[jsonOject]} jsonDataArray array of entoty data comming from csv2json
     * @param {function} entityCallBack optional - called each time an entity is imported - callBack(entityId, jsonPayload, response)
     */
    async importEntityArray(ctx, entityId, jsonDataArray, entityCallBack) {
        if (ctx?.currentCompany?.getUnitUuid == null) {
            throw new Error('CSVImport.importEntityArray - Wrong ctx object - Expectded[ctx.currentCompany.getUnitUuid]')
        }
        if (ctx.cleanupManager == null) {
            myConsole.warningLowlight(`CSVImport.importEntityArray - ctx does provide 'cleanupManager' - Entities detetion is the responsibility of the caller`)
        }
        jsonDataArray ??= []
        const step = `import.entities.${entityId}.${jsonDataArray.length}`
        this.logStep(`${step}.begin`)
        let index = 0
        for await (const entityData of jsonDataArray) {
            await this.#importEntity(ctx, entityId, index++, entityData, entityCallBack)
        }
        this.logStep(`${step}.end`)
    }
    /**
     * Import the given entities
     * @param {FabContext or at least {company: company}} ctx access to unitUuids, ROOT_GROUP... 
     * @param {string} entityId 'customers', 'items'..
     * @param {integer} index 
     * @param {jsonOject} entityData entity json data provided by csv2Json
     * !! entityData is updated with the uuid of the created entities
     * @param {function} entityCallBack optional - called each time an entity is imported - async entityCallBack(entityId, jsonPayload, response)
     */
    async #importEntity(ctx, entityId, index, entityData, entityCallBack) {
        entityData ??= {}
        const postData = {}
        const step = `import.entity.${entityId}[${index}].${entityData.externalUniqueId}`
        /** myConsole.lowlight(`${step}.begin\n${JSON.stringify(entityData, null, 2)}`) */
        for await (const [key, value] of Object.entries(entityData)) {
            if (_.isPlainObject(value)) {
                if (value._type_ === TYPE_JSON) {
                    /** json data  */
                    postData[key] = { ...value }
                    delete postData[key]._type_
                } else {
                    /** Associations to another entity - uuid is needed */
                    let uuid = null
                    switch (value._type_) {
                        case TYPE_UUID:
                            switch (value.entity) {
                                case ENTITY_UNITS:
                                    /** Given by the referential */
                                    uuid = ctx.currentCompany.getUnitUuid(value.id)
                                    break
                                case ENTITY_MACHINE_GROUP:
                                    /**  we need to get the uuid of the group  created with the machine */
                                    uuid = this.#machineGroupUuids.get(value.externalUniqueId)
                                    break
                                default:
                                    /** Retreived from previous value.entity POST by externalUniqueId*/
                                    uuid = this.#getUuid(value.entity, value.externalUniqueId)
                                    break
                            }
                            break
                        case TYPE_PARAMS:
                            if (value.entity === ENTITY_GROUPS && value.externalUniqueId === ROOT_GROUP) {
                                uuid = ctx.COMPANY_ROOT_GROUP_UUID
                            } else {
                                throw new Error(`unkown 'params' association - '${JSON.stringify(value)}`)
                            }
                            break
                        default:
                            throw new Error(`unkown association type '${JSON.stringify(value)}`)
                    }
                    if ((uuid ?? '').length == 0) {
                        throw new Error(`unexpected empty uuid '${JSON.stringify(value)}'`)
                    }
                    /** !! set value.uuid in entityData (not postData) or the association in order to able to retreive it later */
                    value.uuid = uuid
                    postData[key] = uuid
                }
            } else {
                postData[key] = value
            }
        }
        if (_.isEmpty(postData.externalUniqueId)) {
            throw new Error(`Unexpected empty externalUniqueId`)
        }
        let response = null
        let post = true
        if (this.putEnabled === true) {
            response = await this.getApi(entityId).getByExternalId(postData.externalUniqueId)
                .expect(200)
            if (response.body.data.length > 1) {
                throw new Error(`getByExternalId must return zero or one entity got[${response.body.data.length}]`)
            }
            if (response.body.data.length === 1) {
                myConsole.lowlight(`PUT ${postData.externalUniqueId}`)
                response = await this.getApi(entityId).putByUuid(response.body.data[0].uuid, postData)
                    .expect(200)
                post = false
            }
        }
        if (post === true) {
            response = await this.getApi(entityId).post(postData)
                .expect(201)
        }
        /** !! entityData not postData */
        this.#setUuid(ctx, entityId, entityData, response)
        if (entityCallBack) {
            await entityCallBack(entityId, postData, response)
        }
        myConsole.lowlight(`${step}.imported`)
    }

    async readEntity(entityId, uudid, externalUniqueId) {
        this.logStep(`readEntity.${entityId}.${externalUniqueId ?? uudid}`)
        const response = await this.getApi(entityId).getByUuid(uudid)
            .expect(200)
        return response.body.data
    }

    getApi(entityId) {
        const api = qsPlant[entityId] ?? qsFab[entityId]
        if (!api) {
            throw new Error(`api qsPlant.${entityId} or qsFab.${entityId} not found`)
        }
        return api
    }

}

export default CSVImport
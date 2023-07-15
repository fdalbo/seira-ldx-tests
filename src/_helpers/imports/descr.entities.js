"use strict";

import _ from 'lodash';
import myConsole from '../commons/myConsole';

import {
    TENANT_ID,
    SKIP_CELL,
    STATE_VALID,
    TYPE_UUID,
    TYPE_PARAMS,
    ROOT_GROUP
} from './consts'
import {
    checkId as _checkId,
    checkExternalId as _checkExternalId
} from './descr.references'

const EMPTY_ID_PART = 'none'
const _assertNotEmpty = (entity, ...args) => {
    args.forEach((x, idx) => {
        if (_.isNil(x) || (_.isString(x) && _.isEmpty(x))) {
            throw new Error(`externalUniqueId.calculation.${entity} - Unexpected empty argument index ${idx} [${args.join(',')}]`)
        }
    })
}

let _externalIdsSet = null
export const processEntityBegin = (entityDescriptor) => {
    _externalIdsSet = new Set()
}
/**
 * Eventually re-process all data
 * @param {[jsonData]]} entitiesData 
 * @param {jsonDescr} entityDescription 
 * @returns 
 */
export const processEntityEnd = (entitiesData, entityDescription) => {
    return
}
/**
 * Default properties expected by backend
 * @param {json} json 
 * @param {jsonDescr} entityDescription 
 * @returns 
 */
const _setDefaultProps = (qsfabData, entityDescription) => {
    if (qsfabData.state == null) {
        /** for entities that don't support 'comment' */
        qsfabData.state = STATE_VALID
    }
    if (entityDescription.noCommentProperty !== true && qsfabData.comment == null) {
        qsfabData.comment = ''
    }
}

/**
 * Calculate the properties of the record (Eg: essociations)
 * Add calculated properties to jsonData
 * @param {jsonData} jsonData record
 * @param {jsonDescr} entityDescription  export const descriptions element
 * @returns 'skip reason' if entity is skipped - null otherwise
 */
export const calculateProperties = (jsonData, entityDescription) => {
    const erpData = jsonData
    const qsfabData = jsonData.quasarmes
    if (entityDescription._externalId) {
        qsfabData.externalUniqueId = _checkExternalId(entityDescription._externalId(jsonData))
        if (_externalIdsSet.has(qsfabData.externalUniqueId)) {
            throw new Error(`Entity ${entityDescription.entity} - externalUniqueId already exists [${qsfabData.externalUniqueId}]`)
        }
        _externalIdsSet.add(qsfabData.externalUniqueId)
    }
    if (entityDescription._calculate) {
        entityDescription._calculate(erpData, qsfabData)
    }
    _setDefaultProps(qsfabData, entityDescription)
    if (entityDescription._skip) {
        /** 
         * _skip returns a string with the skipReason
         * if skipReason!=null entity is skipped 
         */
        return entityDescription._skip(erpData, qsfabData)
    }
    if (entityDescription.noIdProperty !== true && qsfabData.id == null) {
        /**
         * !!! CAUTION
         * 'id' is not really an idenfier (not unic for the entity which is really strange)
         * Eg: customers, items have true ids
         * Eg: operations, rangeoperations don't have unic ids which is hard to figure out...
         * The real id is the externalUniqueId which is calculated by the import engin (not by the erp export :-( )
         * Should be reviewed and improved (simplified)
         */
        throw new Error(`Entity '${entityDescription.entity}' has no 'id' property`)
    }
    /** No skip reason */
    return null
}

/**
 * External ids calculation
 * ExternalId's are used also as id's
 * They allows us to resolve associations
 * --> Before the creation of the entity we will get the actual uuid of the linked entity with the id/externalId
 */
const _mapExternalIds = {
    customers: (cd_cl) => {
        _assertNotEmpty('customers', cd_cl)
        return `${TENANT_ID}_CUST_${cd_cl}`
    },
    items: (cd_art, ind_pr_art, cd_cl) => {
        if (_.isEmpty(cd_cl)) {
            /** cd_cl can be empty ??*/
            cd_cl = EMPTY_ID_PART
        }
        _assertNotEmpty('items', cd_art, ind_pr_art, cd_cl)
        return `${TENANT_ID}_REF_${cd_art}/${ind_pr_art}/${cd_cl}`
    },
    groups: (cd_ctchar) => {
        _assertNotEmpty('groups', cd_ctchar)
        return `${TENANT_ID}_GRP_${cd_ctchar}`
    },
    machines: (cd_moy) => {
        _assertNotEmpty('machines', cd_moy)
        return `${TENANT_ID}_MACH_${cd_moy}`
    },
    ranges: (cd_proc) => {
        _assertNotEmpty('ranges', cd_proc)
        return `${TENANT_ID}_RANGE_${cd_proc}`
    },
    process: (cd_proc) => {
        _assertNotEmpty('process', cd_proc)
        return `${TENANT_ID}_PROCESS_${cd_proc}`
    },
    processonitems: (cd_proc, cd_art, indice, cd_cl) => {
        if (_.isEmpty(cd_cl)) {
            /** cd_cl can be empty ??*/
            cd_cl = EMPTY_ID_PART
        }
        _assertNotEmpty('processonitems', cd_proc, cd_art, indice, cd_cl)
        return `${TENANT_ID}_PROCESONREF_${cd_proc}_${cd_art}/${indice}/${cd_cl}`
    },
    rangeoperations: (cd_proc, no_int_proc_gamope) => {
        _assertNotEmpty('rangeoperations', cd_proc, no_int_proc_gamope)
        return `${TENANT_ID}_RANGEOPE_${cd_proc}/${no_int_proc_gamope}`
    },
    defectfamilies: (cd_famdef) => {
        _assertNotEmpty('defectfamilies', cd_famdef)
        return `${TENANT_ID}_DEFAM_${cd_famdef}`
    },
    defects: (cd_famdef, cd_def) => {
        if (_.isEmpty(cd_famdef)) {
            /** cd_famdef can be empty ??*/
            cd_famdef = EMPTY_ID_PART
        }
        _assertNotEmpty('defects', cd_famdef, cd_def)
        return `${TENANT_ID}_DEF_${cd_famdef}/${cd_def}`
    },
    operators: (cd_perso) => {
        _assertNotEmpty('operators', cd_perso)
        return `${TENANT_ID}_OPERATOR_${cd_perso}`
    },
    stopcausefamilies: (cd_famcau) => {
        _assertNotEmpty('stopcausefamilies', cd_famcau)
        return `${TENANT_ID}_STFAM_${cd_famcau}`
    },
    stopcauses: (cd_famcau, cd_cau) => {
        _assertNotEmpty('stopcauses', cd_famcau, cd_cau)
        return `${TENANT_ID}_STCAUSE_${cd_famcau}/${cd_cau}`
    },
    productionorders: (no_int_ord_fab) => {
        _assertNotEmpty('productionorders', no_int_ord_fab)
        return `${TENANT_ID}_OF_${no_int_ord_fab}`

    },
    operations: (no_int_ord_fab, no_int_opegam_of) => {
        _assertNotEmpty('operations', no_int_ord_fab, no_int_opegam_of)
        return `${TENANT_ID}_OPE_${no_int_ord_fab}/${no_int_opegam_of}`

    },
    documentations: (no_int_obj_lie) => {
        _assertNotEmpty('documentations', no_int_obj_lie)
        return `${TENANT_ID}_DOC_${no_int_obj_lie}`

    },
    documentationonitems: (no_int_obj_lie, cd_art, indice, cd_cl) => {
        _assertNotEmpty('documentationonitems', no_int_obj_lie, cd_art, indice, cd_cl)
        return `${TENANT_ID}_DOCONREF_${no_int_obj_lie}/${cd_art}/${indice}/${cd_cl}`

    }
}

export const descriptions = [{
    entityId: 'customers',
    tag: '#CUSTOMER',
    noCommentProperty: true,
    _externalId: (rec) => _mapExternalIds.customers(rec.cd_cl),
    header: [
        SKIP_CELL,
        'cd_cl~id',
        'des_cl~label'
    ]
}, {
    entityId: 'items',
    tag: '#REFERENCE',
    _externalId: (rec) => _mapExternalIds.items(rec.cd_art, rec.ind_pr_art, rec.cd_cl),
    _calculate: (erpData, qsfabData) => {
        if (erpData.cd_cl) {
            qsfabData.customerUuid = {
                _type_: TYPE_UUID,
                externalUniqueId: _mapExternalIds.customers(erpData.cd_cl),
                entity: 'customers'
            }
        }
    },
    header: [
        SKIP_CELL,
        'cd_art~id',
        'ind_pr_art~index',
        'cd_cl',
        'des_art_a~label',
        'ind_pl~planIndex',
        'cd_unit_sto~unitUuidQuantity~uuid~units',
        'typ_appro~type',
        'cd_pl~planRef',
        'const1~autoControl~boolean',
        'const2~goNoGo~boolean'
    ]
}, {
    entityId: 'groups',
    tag: '#PRODUCTIVE_ASSET',
    noCommentProperty: true,
    _externalId: (rec) => _mapExternalIds.groups(rec.cd_ctchar),
    _calculate: (erpData, qsfabData) => {
        qsfabData.connected = false
        qsfabData.simulator = false
        qsfabData.parentUuid = {
            _type_: TYPE_PARAMS,
            /**externalUniqueId to keep the same pattern as others associations*/
            externalUniqueId: ROOT_GROUP,
            entity: 'groups'
        }
    },
    header: [
        SKIP_CELL,
        'cd_ctchar~id',
        'const1~family',
        'des~label',
        'const2~type',
        'const3~comment',
        'const4~unitUuidQuantity~uuid~units'
    ]
}, {
    entityId: 'machines',
    tag: '#MACHINE',
    noIdProperty: true,
    _externalId: (rec) => _mapExternalIds.machines(rec.cd_moy),
    _calculate: (erpData, qsfabData) => {
        qsfabData.parentUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.groups(erpData.cd_ctchar),
            entity: 'groups'
        }
    },
    header: [
        SKIP_CELL,
        /** empty */
        SKIP_CELL,
        'cd_moy~machineId',
        'des_pst_trv~label',
        'des_no_seri~serialNumber',
        'cd_ctchar',
        'const1~unitUuidQuantity~uuid~units',
        'const1~type'
    ]
}, {
    entityId: 'ranges',
    tag: '#RANGE',
    _externalId: (rec) => _mapExternalIds.ranges(rec.cd_proc),
    header: [
        SKIP_CELL,
        'cd_proc~id',
        'des~label'
    ]
}, {
    entityId: 'process',
    tag: '#PROCESS',
    _externalId: (rec) => _mapExternalIds.process(rec.cd_proc),
    _calculate: (erpData, qsfabData) => {
        qsfabData.nomenclatureUuid = null
        qsfabData.rangeUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.ranges(erpData.cd_proc),
            entity: 'ranges'
        }
    },
    header: [
        SKIP_CELL,
        'cd_proc~id',
        'des~label',
        /**cd_proc */
        SKIP_CELL,
        /**cd_proc */
        SKIP_CELL
    ]
}, {
    entityId: 'processonitems',
    tag: '#PROCESS_ON_REFERENCE',
    noIdProperty: true,
    _externalId: (rec) => _mapExternalIds.processonitems(rec.cd_proc, rec.cd_art, rec.indice, rec.cd_cl),
    _calculate: (erpData, qsfabData) => {
        qsfabData.itemUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.items(erpData.cd_art, erpData.indice, erpData.cd_cl),
            entity: 'items'
        }
        qsfabData.processUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.process(erpData.cd_proc),
            entity: 'process'
        }
        //qsfabData.nomenclatureUuid = null
    },
    header: [
        SKIP_CELL,
        'cd_art',
        'indice',
        'cd_cl',
        'cd_proc',
        'pt_def'
    ]
}, {
    entityId: 'rangeoperations',
    tag: '#RANGE_OPERATION',
    _externalId: (rec) => _mapExternalIds.rangeoperations(rec.cd_proc, rec.no_int_proc_gamope),
    _calculate: (erpData, qsfabData) => {
        qsfabData.rangeUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.ranges(erpData.cd_proc),
            entity: 'ranges'
        }
        if (erpData.cd_ctchar) {
            qsfabData.groupUuidLoadcenter = {
                _type_: TYPE_UUID,
                externalUniqueId: _mapExternalIds.groups(erpData.cd_ctchar),
                entity: 'groups'
            }
        }
    },
    header: [
        SKIP_CELL,
        'cd_oper~id',
        'des~label',
        'no_oper~externalCode',
        'cd_unit~unitUuidQuantity~uuid~units',
        'cd_unit_tps_prod~unitUuidCadence~uuid~units',
        'qte~cadence~decimal',
        'cd_proc',
        'no_int_proc_gamope~erpId',
        'no_aff~order~integer',
        'cd_ctchar'
    ]
}, {
    entityId: 'defectfamilies',
    tag: '#DEFECT_FAMILY',
    _externalId: (rec) => _mapExternalIds.defectfamilies(rec.cd_famdef),
    header: [
        SKIP_CELL,
        'cd_famdef~id',
        'des_famdef~label'
    ]
}, {
    entityId: 'defects',
    tag: '#DEFECT',
    _skip: (erpData, qsfabData) => {
        if (erpData.cd_famdef.length == 0) {
            return `defects '${erpData.cd_def}' - Empty defectfamilies`
        }
        return null
    },
    _externalId: (rec) => _mapExternalIds.defects(rec.cd_famdef, rec.cd_def),
    _calculate: (erpData, qsfabData) => {
        if (erpData.cd_famdef) {
            qsfabData.defectFamilyUuid = {
                _type_: TYPE_UUID,
                externalUniqueId: _mapExternalIds.defectfamilies(erpData.cd_famdef),
                entity: 'defectfamilies'
            }
        }
    },
    header: [
        SKIP_CELL,
        'cd_def~id',
        'des_def~label',
        'cd_famdef'
    ]
}, {
    entityId: 'operators',
    noIdProperty: true,
    tag: '#OPERATOR',
    _externalId: (rec) => _mapExternalIds.operators(rec.cd_perso),
    header: [
        SKIP_CELL,
        'cd_perso~operatorId',
        'des_nom~label',
        'const1~type'
    ]
}, {
    entityId: 'stopcausefamilies',
    tag: '#STOP_CAUSE_FAMILY',
    _externalId: (rec) => _mapExternalIds.stopcausefamilies(rec.cd_famcau),
    header: [
        SKIP_CELL,
        'cd_famcau~id',
        'des_famcau~label'
    ]
}, {
    entityId: 'stopcauses',
    tag: '#STOP_CAUSE',
    _externalId: (rec) => _mapExternalIds.stopcauses(rec.cd_famcau, rec.cd_cau),
    _calculate: (erpData, qsfabData) => {
        if (erpData.cd_famcau) {
            qsfabData.stopcausefamilyUuid = {
                _type_: TYPE_UUID,
                externalUniqueId: _mapExternalIds.stopcausefamilies(erpData.cd_famcau),
                entity: 'stopcausefamilies'
            }
        }
    },
    header: [
        SKIP_CELL,
        'cd_cau~id',
        'des_cau~label',
        SKIP_CELL,
        'const2~type',
        SKIP_CELL,
        SKIP_CELL,
        'cd_famcau'
    ]
}, {
    entityId: 'productionorders',
    tag: '#PRODUCTION_ORDER',
    _externalId: (rec) => _mapExternalIds.productionorders(rec.no_int_ord_fab),
    _calculate: (erpData, qsfabData) => {
        qsfabData.itemUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.items(erpData.cd_art, erpData.ind_pr_art, erpData.cd_cl),
            entity: 'items'
        }
        qsfabData.processUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.process(erpData.cd_proc),
            entity: 'process'
        }
    },
    header: [
        SKIP_CELL,
        'no_int_ord_fab~id',
        'des~label',
        'cd_art',
        'qte~quantity~integer',
        'cd_unit~unitUuidQuantity~uuid~units',
        'cd_etat_ordfab~status~statusop',
        SKIP_CELL,
        SKIP_CELL,
        'dte_hre_deb_prev~startPlannedDate~date~obilog~utcepoch',
        'dte_hre_fin_prev~endPlannedDate~date~obilog~utcepoch',
        SKIP_CELL,
        'ind_pr_art',
        'cd_cl',
        'cd_proc'
    ]
},
{
    entityId: 'operations',
    tag: '#OPERATION',
    _externalId: (rec) => _mapExternalIds.operations(rec.no_int_ord_fab, rec.no_int_opegam_of),
    _calculate: (erpData, qsfabData) => {
        qsfabData.managedByMes = true
        qsfabData.productionorderUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.productionorders(erpData.no_int_ord_fab),
            entity: 'productionorders'
        }
        qsfabData.groupUuidLoadcenter = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.groups(erpData.cd_ctchar),
            entity: 'groups'
        }
        qsfabData.groupUuidMachine = {
            _type_: TYPE_UUID,
            /**  
             * cd_moy could be used as the machineid :-( 
             * All associations should be done through an id provided by the erp (not through a calculated externalid)
             */
            externalUniqueId: _mapExternalIds.machines(erpData.cd_moy),
            entity: 'machinegroup'
        }
        qsfabData.rangeoperationUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.rangeoperations(erpData.cd_proc, erpData.no_int_opegam_of),
            entity: 'rangeoperations'
        }
    },
    header: [
        SKIP_CELL,
        'cd_oper~id',
        'des~label',
        'cd_unit~unitUuidQuantity~uuid~units',
        'cd_unit_prod~unitUuidCadence~uuid~units',
        'qte~cadenceReference~integer',
        'qte_brute~quantity~integer',
        'pt_etat~status~statusop',
        SKIP_CELL,
        SKIP_CELL,
        'dte_hre_deb_prev_tot~startPlannedDate~date~obilog~utcepoch',
        'dte_hre_fin_prev_tot~endPlannedDate~date~obilog~utcepoch',
        SKIP_CELL,
        SKIP_CELL,
        'no_int_ord_fab',
        'const5~trsGoal~integer',
        'cd_ctchar',
        'cd_moy',
        'const6~planned',
        'no_aff~rank~integer',
        'no_int_opegam_of~erpId',
        'cd_proc',
        'info1~data.info1~string',
        'info2~data.info2~string'
    ]
}, {
    entityId: 'documentations',
    tag: '#DOCUMENT',
    noIdProperty: true,
    _skip: (erpData, qsfabData) => {
        return `entities not imported (to complete)`
    },
    _externalId: (rec) => _mapExternalIds.documentations(rec.no_int_obj_lie),
    header: [
        SKIP_CELL,
        'cd_obj~label',
        'no_int_obj_lie',
        'cd_repert_obj~url',
        'cd_repert_obj~mimeType',
        SKIP_CELL,
    ]
}, {
    entityId: 'documentationonitems',
    tag: '#DOCUMENT_ON_REFERENCE',
    noIdProperty: true,
    _skip: (erpData, qsfabData) => {
        return `entities not imported (to complete)`
    },
    _externalId: (rec) => _mapExternalIds.documentationonitems(rec.no_int_obj_lie, rec.cd_art, rec.indice, rec.cd_cl),
    _calculate: (erpData, qsfabData) => {
        qsfabData.itemUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.items(erpData.cd_art, erpData.indice, erpData.cd_cl),
            entity: 'items'
        }
        qsfabData.documentationUuid = {
            _type_: TYPE_UUID,
            externalUniqueId: _mapExternalIds.documentations(erpData.no_int_obj_lie),
            entity: 'documentations'
        }
    },
    header: [
        SKIP_CELL,
        'cd_art',
        'indice',
        'cd_cl',
        'const1~itemPhoto~boolean',
        'const2~default~boolean',
        'no_int_obj_lie',
        'const3~setting~boolean'
    ]
}]

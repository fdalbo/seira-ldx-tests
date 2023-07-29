'use strict';

const chalk = require('chalk');
const {
    SEIRASSO_COLLECTIONS,
    LEARNERS,
    REGEXPS,
    SeiraMongoClient
} = require('#helpers/mongo')

const _ = require('lodash')

/**
 * COMMAND: node ./_mongo/mongoClient.js --url mongodb://host:port
 * Default url is mongodb://localhost:27017
 */
class MyClient extends SeiraMongoClient {
    #loginCollection = null
    #profilesCollection = null
    #groupsCollection = null

    async runBefore(method, ...args) {
        this.#loginCollection = await this.seirassoCollection(SEIRASSO_COLLECTIONS.LOGINS)
        this.#profilesCollection = await this.seirassoCollection(SEIRASSO_COLLECTIONS.PROFILES)
        this.#groupsCollection = await this.seirassoCollection(SEIRASSO_COLLECTIONS.GROUPS)
        /** this.logCollection(DBNAMES.SEIRASSO, SEIRASSO_COLLECTIONS.LOGINS) */
    }
    get groupsCollection() {
        return this.#groupsCollection
    }
    get loginCollection() {
        return this.#loginCollection
    }
    get profilesCollection() {
        return this.#profilesCollection
    }
    get actionChoices() {
        return [
            { title: 'Update password after import', description: `For all logins.login.match('/${LEARNERS.PREFIX}[0-9]+/') with NOT_DEFINED paswword replaces the password by '${LEARNERS.PASSWORD}' (encrypted)`, value: this.updatePwdImportedLearners.name },
            //  { title: 'fixNameAsDateIssue', description: `fixNameAsDateIssue`, value: this.fixNameAsDateIssue.name },
            { title: 'createGroups', description: `Creates groups testperfs.group.startidx.stopidx with 50, 10, 20.. users`, value: this.createGroups.name },
        ]
    }
    async getLearnerProfiles() {
        this.log(REGEXPS.LEARNERS_NAMES)
        return this.profilesCollection.find({ name: { $regex: REGEXPS.LEARNERS_NAMES, '$options': 'i' } }).toArray()
    }
    async getLearnerGroups() {
        this.log(REGEXPS.GROUPS_NAME)
        return this.groupsCollection.find({ name: { $regex: REGEXPS.GROUPS_NAME, '$options': 'i' } }).toArray()
    }
    async getLearnerLogins() {
        this.log(REGEXPS.LEARNERS_NAMES)
        return this.loginCollection.find({ login: { $regex: REGEXPS.LEARNERS_NAMES, '$options': 'i' } }).toArray()
    }
    async updateOne(collection, doc, data) {
        if (_.isEmpty(data)) {
            return {
                modifiedCount: 0
            }
        }
        if (this.dryrun != false) {
            //this.log('dryrun - updateOne', JSON.stringify(data))
            return {
                modifiedCount: 1
            }
        } else {
            return collection.updateOne(doc, {
                $set: data
            })
        }
    }
    async updatePwdImportedLearners() {
        const docs = await this.getLearnerLogins().toArray()
        this.log(`loginCollection.docs.length[${docs.length}]`)
        let modifiedCount = 0
        for await (const doc of docs) {
            if (doc.password === 'NOT_DEFINED') {
                const result = await this.updateOne(this.loginCollection, doc, {
                    password: LEARNERS.ENCRYPTED_PASSWORD
                })
                modifiedCount += result.modifiedCount
            }
        }
        this.loghighlight(`updatePwdImportedLearners: ${modifiedCount} docs modified`)
    }

    async fixNameAsDateIssue() {
        const profilesOk = await this.profilesCollection.find({ name: { $regex: REGEXPS.LEARNERS_NAMES, '$options': 'i' } }).toArray()
        this.log(`profilesOk[${profilesOk.length}]`)
        let idx = profilesOk.length
        const profilesKo = await this.profilesCollection.find({ name: { $type: 'date' } }).toArray()
        let loginsKo = await this.loginCollection.find({ login: { $type: 'date' } }).toArray()
        this.log(`profilesKo[${profilesKo.length}] loginsKo[${loginsKo.length}]`)
        let modifiedProfiles = 0, modifiedLogins = 0
        for await (const loginKo of loginsKo) {
            idx++
            const newName = `${LEARNERS.PREFIX}${idx}`
            const profileKo = profilesKo.find(x => x._id == loginKo.profileId)
            if (!profileKo) {
                this.logwarning(`no profile for login ${loginKo.login} profileId[${loginKo.profileId}]`)
                continue
            }
            let result = await this.updateOne(this.profilesCollection, profileKo, {
                name: newName,
                firstname: newName,
                email: `${newName}@noemail.net`
            })
            modifiedProfiles += result.modifiedCount
            result = await this.updateOne(this.loginCollection, loginKo, {
                login: newName
            })
            modifiedLogins += result.modifiedCount
        }
        this.loghighlight(`modifiedLogins[${modifiedLogins}] modifiedProfiles[${modifiedProfiles}]`)
    }

    async createGroups() {
        const learnersIndexes = [
            [1, 10],
            [11, 20],
            [21, 30],
            [31, 40],
            [41, 50],
            [51, 60],
            [61, 70],
            [71, 80],
            [81, 90],
            [91, 100],
            [1, 50],
            [51, 100],
            [101, 150],
            [151, 200],
            [201, 250],
            [251, 300],
            [301, 350],
            [351, 400],
            [401, 450],
            [451, 500],
            [1, 100],
            [101, 200],
            [201, 300],
            [301, 400],
            [401, 500],
            [501, 600],
            [601, 700],
            [701, 800],
            [801, 900],
            [901, 1000],
            [1, 200],
            [201, 400],
            [401, 600],
            [601, 800],
            [801, 1000],
            [1, 500],
            [501, 1000],
            [1001, 1500],
            [1501, 2000],
            /**
              [2001, 2500],
              [2501, 3000],
              [3001, 3500],
              [3501, 4000],
              [4501, 5000]
             */
        ]
        const groups = await this.getLearnerGroups()
        const profiles = await this.getLearnerProfiles()
        const groupsToCreate = []
        let allErrors = []
        for await (const indexes of learnersIndexes) {
            const startIdx = indexes[0]
            const stopIdx = indexes[1]
            const groupeName = `${LEARNERS.GROUPS_PREFIX}${startIdx}.${stopIdx}`
            const errors = []
            const group = groups.find(g => g.name === groupeName)
            const expectedProfiles = stopIdx - startIdx + 1
            if (group == null) {
                const groupInfo = {
                    startIdx: startIdx,
                    stopIdx: stopIdx,
                    groupeName: groupeName,
                    profileIds: []
                }
                for (let learnerIdx = startIdx; learnerIdx <= stopIdx; learnerIdx++) {
                    const learnerName = `${LEARNERS.PREFIX}${learnerIdx}`
                    const profile = await profiles.find(p => p.name === learnerName)
                    if (!profile) {
                        errors.push(`Group[${groupeName}] - No profile found with name '${learnerName}'`)
                        break
                    } else {
                        groupInfo.profileIds.push(profile._id)
                    }
                }
                groupsToCreate.push(groupInfo)
            } else if (group.profiles.length != expectedProfiles) {
                errors.push(`Group[${groupeName}] - Expected profiles[${sexpectedProfiles}] - Got [${group.profiles.length}]`)
            } else {
                this.log(`Group[${groupeName}] already exists with the expected number of profiless [${expectedProfiles}] `)
            }
            allErrors = allErrors.concat(errors)
        }
        if (allErrors.length > 0) {
            this.logwarning('Errors occured creating learners groups')
            this.log(`Errors\n\t- ${allErrors.join('\n\t- ')}`)
            return
        }
        this.loghighlight(`${groupsToCreate.length}/${learnersIndexes.length} groups to create `)
        allErrors = []
        let done = 0
        for await (const groupInfo of groupsToCreate) {
            const doc = {
                profiles: groupInfo.profileIds,
                name: groupInfo.groupeName
            }
            let result = null
            if (this.dryrun != false) {
                doc.profiles = `length[${doc.profiles.length}] - [${doc.profiles[0]}...${doc.profiles[doc.profiles.length - 1]}]`
                this.log(JSON.stringify(doc))
                result = { acknowledged: true }
            } else {
                result = await this.groupsCollection.insertOne(doc)
            }
            if (result.acknowledged === true) {
                done++
            } else {
                allErrors.push({ groupeName: groupInfo.groupeName, result })
            }
        }
        this.loghighlight(`${done}/${groupsToCreate.length} groups has been created  ${this.dryrun ? chalk.yellow('!! DRYRUN MODE') : ''}`)
        if (allErrors.length > 0) {
            this.log(JSON.stringify(allErrors, null, 2))
            this.logwarning(`${done}/${allErrors.length} groups on error`)
        }
    }

}

(async () => {
    await MyClient.factory()
})()


'use strict';

const runner = require('#env/runner')

const MYENVVARS = []
runner(__filename, MYENVVARS, {
    exec: 'node'
})



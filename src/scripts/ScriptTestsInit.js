
const axios = require('axios');
const _ = require('lodash');
const ApiClient = require('./ApiClient');
/** !! ; needed */

(async () => {
   const cli = await ApiClient.factory({
    scriptId: 'script1'
   })
   await cli.askAndExecAction()
})()
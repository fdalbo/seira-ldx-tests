/** 
module.exports = {
    sessions:{
        mainNbLearners: 200
    },
    scenario:{
        nbLoopQuiz1: 100,
        nbLoopQuiz2: 100,
        nbLoopQuiz3: 100
    },
    tempo: {
        default: 5000,
        page: 10000,
        radioCheckbox: 5000,
        cardDisplay: 10000,
        textInput: 5000,
        modal: 5000
    },
}
*/

module.exports = {
    sessions:{
        /** can handle 1000 user max (see /Users/fred/seira/git/playwright/artillery/script1-local.yml maxVusers and arrivalRate) */
        mainNbLearners: 1000
    },
    scenario:{
        nbLoopQuiz1: 100,
        nbLoopQuiz2: 100,
        nbLoopQuiz3: 100
    },
    tempo: {
        default: 3000,
        page: 3000,
        radioCheckbox: 1000,
        cardDisplay: 3000,
        textInput: 2000,
        modal: 3000
    }
}
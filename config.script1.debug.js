
module.exports = {
    /**
     * small timeout compared to config.script1 for debug
     */
    scenario:{
        sessionName: 'testperfs',
        nbLoopQuiz1: 10,
        nbLoopQuiz2: 10,
        nbLoopQuiz3: 10
    },
    tempo: {
        default: 1000,
        page: 1000,
        radioCheckbox: 1000,
        cardDisplay: 1000,
        textInput: 1000,
        modal: 2000
    },
}
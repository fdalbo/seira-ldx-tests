
module.exports = {
    /**
     * small timeout compared to config.script1 for debug
     */    
    sessions:{
        mainNbLearners: 1
    },
    scenario:{
        nbLoopQuiz1: 2,
        nbLoopQuiz2: 2,
        nbLoopQuiz3: 2
    },
    tempo: {
        default: 1000,
        page: 1000,
        radioCheckbox: 500,
        cardDisplay: 1000,
        textInput: 1000,
        modal: 2000
    },
}
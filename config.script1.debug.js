
module.exports = {
    /**
     * small timeout compared to config.script1 for debug
     */    
    sessions:{
        mainNbLearners: 1
    },
    scenario:{
        nbLoopQuiz1: 100,
        nbLoopQuiz2: 100,
        nbLoopQuiz3: 100
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
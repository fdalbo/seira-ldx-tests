
const { ScriptRunner } = require('./ScriptRunner')

module.exports = class Script1 extends ScriptRunner {
  async afterLogin() {
    await super.afterLogin()
    /** 
     * Page is 'Apprenant homme page' 
     * Progression is 0%
     */
    await this.clickSessionsApprenant()
    await this.clickSelectSessionApprenant()
    /** Démarrer */
    await this.clickDemarrerParcours()
    await this.clickNextCard()
    await this.clickNextCard()
    await this.clickNextCard()
    await this.clickNextCard()
    await this.clickNextCardBeforeModal()
    await this.clickModalCancel()
    await this.clickPrevCard()
    await this.clickPrevCard()
    await this.clickPrevCard()
    await this.clickPrevCard()
    /** pdf */
    await this.clickNextCard()
    /** video */
    await this.clickNextCard()
    /** audio */
    await this.clickNextCard()
    /** card attention!! */
    await this.clickNextCard()
    /** Etes vous sur de vouloir de démarrer ? */
    await this.clickNextCardBeforeModal()
    /** Dialog */
    await this.clickModalOK()
    /** First quiz 3 radios */
    for (let i = 1; i < this.scenario.nbLoopQuiz1; i++) {
      await this.clickRadio(i % 3 + 1)
    }
    await this.clickNextCard()
    /** Second quiz */
    for (let i = 1; i < this.scenario.nbLoopQuiz2; i++) {
      await this.clickRadio(i % 3 + 1)
    }
    /** Third quiz */
    await this.clickNextCard()
    for (let i = 1; i < this.scenario.nbLoopQuiz3; i++) {
      await this.clickCheckBox(i % 4 + 1)
    }
    /** Quiz end */
    await this.clickNextCard()
    /** career completed */
    await this.clickNextCard()
    /** Feedback */
    await this.clickNextCard()
    await this.clickNextCard()
    await this.clickNextCard()
    /** Landing page */
    await this.clickNextCard()
  }
}

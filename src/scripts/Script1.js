
const {ScriptRunner} = require('./ScriptRunner')

class _Script1 extends ScriptRunner {
  async afterLogin() {
    await super.afterLogin()
    await this.clickBySelector('#learner')
    await this.clickLink('Toutes mes sessions')
    await this.clickText('testperfs')
    /** Démarrer / Poursuivre */
    await this.clickBySelector('button.start-button-cta')
    await this.clickButton('SUIVANT')
    await this.clickButton('SUIVANT')
    await this.clickButton('Précédent')
    await this.clickButton('Précédent')
    /** Page d'accueil */
    await this.clickButton('SUIVANT')
    /** pdf */
    await this.clickButton('SUIVANT')
    /** video */
    await this.clickButton('SUIVANT')
    /** audio */
    await this.clickButton('SUIVANT')
    /** quiz */
    await this.clickButton('SUIVANT')
    /** Dialog */
    await this.clickButton('Ok')
    /** First quiz */
    await this.clickBySelector('mat-radio-button:nth-child(2)')
    await this.clickButton('SUIVANT')
    /** Second quiz */
    await this.clickBySelector('mat-radio-button:nth-child(2)')
    await this.clickButton('SUIVANT')
    /** Third quiz */
    await this.clickBySelector('mat-checkbox:nth-child(2)')
    await this.clickBySelector('mat-checkbox:nth-child(4)')
    await this.clickButton('SUIVANT')
    /** Quiz terminé */
    await this.clickButton('SUIVANT')
    /** Parcours complété */
    await this.clickButton('SUIVANT')
    /** Feedback personnalisé */
    await this.clickButton('SUIVANT')
    /** Page de fin */
    await this.clickButton('SUIVANT')
    /** Page de fin */
    await this.clickButton('SUIVANT')
  }
}

module.exports = _Script1
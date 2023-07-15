module.exports = { test1 };
const myConsole = require('#commons/myConsole')
const { pause } = require('#commons/promises')

const _target = {
  url: 'http://localhost:2020'
}
let _pageIdx = 0

const fullUrl = (path) => {
  return `${_target.url}${path}`
}

const getPageId = (pwPage) => {
  const url = new URL(`${pwPage.url()}?`)
  return url.pathname.substring(url.pathname.lastIndexOf('/'))
}

const waitPage = async (pwPage) => {
  _pageIdx++
  await pause(1000);
  myConsole.lowlight(`page[${_pageIdx}] ${getPageId(pwPage)}`)
}

const gotoPage = async (pwPage, path) => {
  myConsole.lowlight(`gotoPage ${path}`)
  await pwPage.goto(fullUrl(path))
  await waitPage(pwPage)
}

const fillLabel = async (pwPage, label, value) => {
  myConsole.lowlight(`fillLabel '${label}'`)
  return pwPage.getByLabel(label).fill(value)
}

const clickButton = async (pwPage, name) => {
  myConsole.lowlight(`clickButton '${name}'`)
  await pwPage.getByRole('button', { name: name }).click()
  await waitPage(pwPage)
}
const clickLink = async (pwPage, name) => {
  myConsole.lowlight(`clickLink '${name}'`)
  await pwPage.getByRole('link', { name: name }).click()
  await waitPage(pwPage)
}
const clickTile = async (pwPage, title) => {
  myConsole.lowlight(`clickTile ${title}`)
  await pwPage.getByTitle(title).click();
  await waitPage(pwPage)
}


const _scriptId='TEST1'
async function test1(pwPage) {
  myConsole.initLoggerFromModule(__filename)
  const userNum = process.env.LOCAL_WORKER_ID ?? ''
  const user = `user${process.env.LOCAL_WORKER_ID}`
  const password = 'seira'
  if (userNum.length == 0 || isNaN(userNum)) {
    throw new Error(`Unexpected empty 'LOCAL_WORKER_ID' env variable`)
  }
  try {
    myConsole.superhighlight(`BEGIN ${_scriptId} user[${user}]`)
    const traceEnv = []
    for (const [key, value] of Object.entries(process.env)) {
      (key == 'LOCAL_WORKER_ID' || key.startsWith('SLDX')) && traceEnv.push(`${key}=${value}`)
    }
    myConsole.lowlight(`SLDX Variables:\n${traceEnv.join('\n')}\n`)
    await gotoPage(pwPage, `/client`);
    await fillLabel(pwPage, 'Veuillez entrer votre identifiant ou e-mail *', user)
    await fillLabel(pwPage, 'Mot de passe : *', password)
    await clickButton(pwPage, 'Connexion')
    await clickTile(pwPage, 'Apprenant')
    await clickLink(pwPage, 'Toutes mes sessions')
  } catch (e) {
    myConsole.error(`END ${_scriptId} ERROR user[${user}]`, e)
    throw e
  }
  myConsole.superhighlight(`END ${_scriptId} OK user[${user}]`)
  await pause(1000);
}
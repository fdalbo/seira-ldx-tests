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

const displayPageId = (pwPage) => {
  myConsole.lowlight(`page[${_pageIdx}] ${getPageId(pwPage)}`)
}

const gotoPage = async (pwPage, path) => {
  myConsole.lowlight(`gotoPage ${path}`)
  _pageIdx++
  await pwPage.goto(fullUrl(path))
  await pause(1000);
  displayPageId(pwPage)
}

const fillLabel = async (pwPage, label, value) => {
  myConsole.lowlight(`fillLabel '${label}'`)
  return pwPage.getByLabel(label).fill(value);
}

const clickButton = async (pwPage, name, changePage = true) => {
  changePage && _pageIdx++
  myConsole.lowlight(`clickButton '${name}'`)
  await pwPage.getByRole('button', { name: name }).click();
  await pause(1000);
  displayPageId(pwPage)
}
const clickLink = async (pwPage, name, changePage = true) => {
  changePage && _pageIdx++
  myConsole.lowlight(`clickLink '${name}'`)
  await pwPage.getByRole('link', { name: name }).click();
  await pause(1000);
  displayPageId(pwPage)
}
const clickImg = async (pwPage, title, changePage = true) => {
  changePage && _pageIdx++
  myConsole.lowlight(`clickImg ${title}`)
  await pwPage.getByTitle(title).getByRole('img').click();
  await pause(1000);
  displayPageId(pwPage)
}


async function test1(pwPage) {
  myConsole.superhighlight('BEGIN TEST1')
  const traceEnv = []
  try {
    for (const [key, value] of Object.entries(process.env)) {
      key.startsWith('SLDX') && traceEnv.push(`${key}=${value}`)
    }
    myConsole.lowlight(`SLDX Variables:\n${traceEnv.join('\n')}`)
    await gotoPage(pwPage, `/client`);
    await fillLabel(pwPage, 'Veuillez entrer votre identifiant ou e-mail *', 'user1');
    await fillLabel(pwPage, 'Mot de passe : *', 'seira');
    await clickButton(pwPage, 'Connexion')
    await clickImg(pwPage, 'Apprenant');
    await clickLink(pwPage, 'Toutes mes sessions');
  } catch (e) {
    myConsole.error("END TEST1 ERROR", e)
    await pause(1000);
    throw e
  }
  myConsole.superhighlight('END TEST1 OK')
  await pause(1000);
}
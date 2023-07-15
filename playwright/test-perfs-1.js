module.exports = { test1 };

const _target = {
  url: 'http://localhost:2020'
}
let _pageIdx = 0

const fullUrl = (path) => {
  return `${_target.url}`
}

const getPageId = (pwPage) => {
  const url = new URL(`${pwPage.url()}?`)
  return url.pathname.substring(url.pathname.lastIndexOf('/'))
}

const displayPageId = (pwPage) => {
  console.log(`[${_pageIdx}] ${getPageId(pwPage)}`)
}

const gotoPage = async (pwPage, path) => {
  _pageIdx++
  await pwPage.goto(fullUrl(path))
  displayPageId(pwPage)
}

const clickLabel = async (pwPage, label) => {
  await pwPage.getByLabel(label).click();
}

async function test1(pwPage) {
  await gotoPage(`${URL}/client`);
  
  await page.getByLabel('Veuillez entrer votre identifiant ou e-mail *').fill('user1');
  await page.getByLabel('Mot de passe : *').fill('seira');
  await page.getByRole('button', { name: 'Connexion' }).click();
  displayPageId(page)
  await page.getByTitle('Apprenant').getByRole('img').click();
  displayPageId(page)
  await page.getByRole('link', { name: 'Toutes mes sessions' }).click();
  displayPageId(page)
}
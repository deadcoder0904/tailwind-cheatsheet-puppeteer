const puppeteer = require('puppeteer')
const writeJsonFile = require('write-json-file')

const isProd = process.env.NODE_ENV === 'production'

const main = async () => {
  let browser,
    page,
    json = []

  try {
    browser = await puppeteer.launch({
      headless: isProd,
      devtools: !isProd,
    })

    page = await browser.newPage()
    await page.goto('https://tailwindcss.com', { waitUntil: 'networkidle2' })

    // Log Console Tab to Terminal
    page.on('console', async (msg) =>
      console[msg._type](
        ...(await Promise.all(msg.args().map((arg) => arg.jsonValue())))
      )
    )
  } catch (error) {
    console.log(`Can't launch Puppeteer`)
  }

  const versionNoSel = 'select>option'

  // Get Version Number
  await page.waitForSelector(versionNoSel)

  const versionNo = await page.$eval(
    versionNoSel,
    (versionNo) => versionNo.innerText
  )

  const topicsSel = '.mb-8>h5'

  // Gets Topics from Tailwind CSS
  await page.waitForSelector(topicsSel)

  const data = await page
    .$$eval(topicsSel, (topics) => {
      const headers = topics.slice(4, topics.length - 1)
      return Array.from(headers).map((node) => {
        const lis = node.nextElementSibling.querySelectorAll('li')
        const topic = node.innerText
        const urls = Array.from(lis).map(
          (li) => `${li.querySelector('a').href}/`
        )
        return { topic, urls }
      })
    })
    .catch((err) => console.error(err))

  await page.close()

  const topics = data.map((item) => item.topic)
  const urls = data.map((item) => item.urls)
  for (let i = 0; i < urls.length; i++) {
    let subTopics = []
    for (let j = 0; j < urls[i].length; j++) {
      const page = await browser.newPage()
      const url = urls[i][j]
      const titleSel = 'h1',
        descriptionSel = 'div.mt-0.mb-4.text-gray-600',
        thSel = 'tr>th.text-sm.font-semibold.text-gray-700.p-2.bg-gray-100',
        tdSel = 'tr>td.p-2.border-t.font-mono.text-xs'

      await page.goto(url, { waitUntil: 'networkidle0' })
      await page.waitForSelector(titleSel)

      const subTopic = await page.evaluate(
        (titleSel, descriptionSel, thSel, tdSel, url) => {
          const title = document.querySelector(titleSel).innerText
          const description = document.querySelector(descriptionSel).innerText
          const hasColor = title.includes('color')
          const hasBreakpoint = Array.from(
            document.querySelectorAll(thSel)
          ).some((item) => item.innerText === 'Breakpoint')
          let css = []
          const tds = Array.from(document.querySelectorAll(tdSel)).map(
            (item) => item.innerText
          )
          if (hasBreakpoint) {
            css.push({ class: tds[0] })
            for (let k = 1; k < tds.length; k += 2) {
              css.push({
                breakpoint: tds[k],
                property: tds[k + 1],
              })
            }
          } else if (hasColor) {
            for (let k = 0; k < tds.length; k += 3) {
              css.push({
                class: tds[k],
                property: tds[k + 1],
              })
            }
          } else {
            for (let k = 0; k < tds.length; k += 2) {
              css.push({
                class: tds[k],
                property: tds[k + 1],
              })
            }
          }

          return {
            title,
            description,
            url,
            hasBreakpoint,
            css,
          }
        },
        titleSel,
        descriptionSel,
        thSel,
        tdSel,
        url
      )
      subTopics.push(subTopic)
      await page.close()
    }

    json.push({ topic: topics[i], subTopics })
  }

  await writeJsonFile(`versions/${versionNo}.json`, json)

  await browser.close()
}

main()

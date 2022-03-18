const puppeteer = require('puppeteer');
const fs = require("fs");
const {Telegraf} = require('telegraf');

const bot = new Telegraf('YOUR_TOKEN');//ADD YOUR TOKEN BOT
let TESTING_IN_PROCESS = false;

bot.start((ctx) => TESTING_IN_PROCESS === false ? startTest(ctx) : ctx.reply('Тестирование уже запущено, попробуйте позже'));
bot.launch();

//Установка статуса тестирования
function setStatusProcess(status) {
    status === true ? TESTING_IN_PROCESS = false : TESTING_IN_PROCESS = true;
}

//Функционал с тестированием
function startTest(ctx) {
    let countOK = 0;
    let countNEOK = 0;
    let countErrors = 0;
    let dataForBotSuccess = '';
    let dataForBotFailed = '';
    let dataForBotErrors = '';
    let statusTest = 'ERROR';
    let statusCode = 'ERROR';

    setStatusProcess(TESTING_IN_PROCESS);
    //Конвертирование из CSV в JSON
    (async () => {
        const file = fs.readFileSync('file-read/urls.csv', {
            encoding: 'utf8'
        });

        const newFile = file.split('\n')
            .map((res) => {
                let [url, sec] = res.split(';');

                return {
                    url,
                    sec: +sec
                };
            });

        fs.writeFileSync('file-read/urls.json', JSON.stringify(newFile, null, 4));
    })();

    //Чтение списка сайтов для тестирования
    const fileContent = fs.readFileSync("file-read/urls.json", "utf8");
    let arrayData = JSON.parse(fileContent);

    (async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setViewport({width: 1800, height: 1000});

        ctx.reply(`Тестирование началось...`);
        console.log(`Тестирование началось...`);

        for (let data of arrayData) {
            try {
                await page.setCacheEnabled(false);
                await page.goto(data.url, {
                    waitUntil: 'networkidle0'
                })
                    .then((log) => statusCode = log.status());

                let timing = await page.evaluate(() => {
                    let result = {};

                    for (let key of Object.keys(window.performance.timing.__proto__))
                        result[key] = window.performance.timing[key];
                    return result;
                });
                let fullyLoadEvaluate = ((timing.loadEventEnd - timing.navigationStart) / 1000);

                if (statusCode > 200) {
                    statusTest = 'FAILED';
                    countNEOK++;
                    dataForBotFailed += `${statusTest} [${statusCode}] [${fullyLoadEvaluate}s], ${data.url}\r\n`;
                } else {
                    statusTest = 'OK';
                    countOK++;
                    dataForBotSuccess += `${statusTest} [${statusCode}] [${fullyLoadEvaluate}s], ${data.url}\r\n`;
                }
            } catch (error) {
                dataForBotErrors += `Произошла ошибка:\r\n [${data.url}]\r\n ${error}\r\n`;
                countErrors++;
            }
        }

        //Процесс передачи сообщений боту
        // ctx.reply(dataForBotSuccess); //Вывод успещных загрузок страниц
        ctx.reply(dataForBotFailed)
            .then(() => ctx.reply(dataForBotErrors))
            .then(() => ctx.reply(`Тест завершен, OK [${countOK}] | BAD [${countNEOK}] | ERRORS [${countErrors}]`));
        setStatusProcess(TESTING_IN_PROCESS);

        return browser
    })()
        .then((browser) => {
            browser.close();
            console.log(`Тестирование завершено!`);
        });
}


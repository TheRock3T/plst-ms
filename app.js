let puppeteer = require('puppeteer');
let fileSystem = require("fs");
let telegraf = require('telegraf');

let bot = new telegraf.Telegraf('5264660015:AAGSs5W-tCBWiNqS0uHiiQKZt1NAbx7kiP4');
let processStatus = false;

bot.start((ctx) => processStatus === false ? startTest(ctx) : ctx.reply('Тестирование уже запущено, попробуйте позже'));
bot.launch();

//Установка статуса тестирования
function setStatusProcess(status) {
    status === true ? processStatus = false : processStatus = true;
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

    setStatusProcess(processStatus);
    //Конвертирование из CSV в JSON
    (async () => {
        const file = fileSystem.readFileSync('file-read/urls.csv', {
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

        fileSystem.writeFileSync('file-read/urls.json', JSON.stringify(newFile, null));
    })();

    //Чтение списка сайтов для тестирования
    const fileContent = fileSystem.readFileSync("file-read/urls.json", "utf8");
    let arrayData = JSON.parse(fileContent);

    (async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setViewport({width: 1800, height: 1000});

        ctx.reply(`Тестирование началось...`);
        console.log(`Тестирование началось...`);

        for (let item of arrayData) {
            try {
                await page.setCacheEnabled(false);
                await page.goto(item.url, {
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
                    dataForBotFailed += `${statusTest} [${statusCode}] [${fullyLoadEvaluate}s], ${item.url}\r\n`;
                    console.log(dataForBotFailed)
                } else {
                    statusTest = 'OK';
                    countOK++;
                    dataForBotSuccess += `${statusTest} [${statusCode}] [${fullyLoadEvaluate}s], ${item.url}\r\n`;
                    console.log(dataForBotSuccess)
                }
            } catch (error) {
                dataForBotErrors += `Произошла фатальная ошибка:\r\n [${item.url}]\r\n ${error}\r\n`;
                countErrors++;
                console.log(dataForBotErrors)
            }
        }

        //Процесс передачи сообщений боту
        ctx.reply(dataForBotSuccess); //Вывод успещных загрузок страниц
        ctx.reply(dataForBotFailed !== '' ? dataForBotFailed : 'Не успешные запросы отсутствуют')
            .then(() => {
                ctx.reply(dataForBotErrors !== '' ? dataForBotErrors : 'Ошибки отсутствуют')
            })
            .then(() => {
                ctx.reply(`Тест завершен, OK [${countOK}] | BAD [${countNEOK}] | ERRORS [${countErrors}]`)
            })
        setStatusProcess(processStatus);

        return browser
    })()
        .then((browser) => {
            browser.close();
            console.log(`Тестирование завершено!`);
        })
        .catch((error) => ctx.reply("Ошибка кода: ", error)
        )
}


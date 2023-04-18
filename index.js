/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */


const {PubSub} = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const topicName = process.env.topicName;

const puppeteer = require('puppeteer');
const os = require('os');
const fs = require('fs');
const Discord = require('./discord.js');


async function publish(messageString, topicName){  
  const topic = pubsub.topic(topicName);
  const messageObject = {
    data: {
      message: messageString,
    },
  };
  const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');

  topic.publishMessage({data: messageBuffer});
  return 'Done';
};

async function get_html(html_file, cookie_file){
  console.log('getting_html');
  const discord = new Discord();
  const dl_status = await discord.get_file('cookies', cookie_file);   
  console.log(dl_status);
  let cookies = JSON.parse(fs.readFileSync(cookie_file, 'utf8')); 
  const browser = await puppeteer.launch({
    headless:true,
    args: [        
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-sandbox',
      '--no-zygote',
      '--single-process'
    ],
  });
  console.log('opening page');
  const page = await browser.newPage(); 
  console.log('setting cookies');
  await page.setCookie(...cookies);
  console.log('going to shopee');
  await page.goto('https://shopee.com.my/cart', {waitUntil: 'load', timeout: 0});
  await page.waitForSelector('.container', {visible: true});
  console.log('found container');
  await page.waitForSelector('.stardust-checkbox', {visible: true});
  console.log('found stardust');
  await new Promise(r => setTimeout(r, 5000));
  const checkbox = await page.$$('.stardust-checkbox');
  await checkbox[0].click();
  console.log('clciked checkbox');
  
  let complete_div = await page.$x("//div[contains(.,'All Rights Reserved')]");
  console.log('All Rights Reserved');
  while (complete_div === undefined || complete_div.length == 0){ 
      await page.evaluate(()=>{ 
          window.scrollBy(0, 100);
      });
      complete_div = await page.$x("//div[contains(.,'All Rights Reserved')]");
  }
  console.log(complete_div);
  const cdp = await page.target().createCDPSession();
  const {data} = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
  fs.writeFileSync(html_file, data); 
  
  cookies = await page.cookies();
  fs.writeFileSync(cookie_file, JSON.stringify(cookies, null, 2));
  let up_status = await discord.send_file('cookies', cookie_file); 
  console.log(up_status);
  up_status = await discord.send_file('html', html_file); 
  console.log(up_status);
  await browser.close();
  await publish('sending message', topicName);
  return 'Done';
}

exports.helloPubSub = (event, context) => {
  const message = event.data
    ? Buffer.from(event.data, 'base64').toString()
    : 'Hello, World';
  console.log(message);
  
  const temp_path = os.tmpdir();
  // const temp_path = '.';
  let now = new Date().toISOString();
  now = (now.split('.')[0]).replace(/-|T|:/g,'_');

  const html_file = `${temp_path}/${now}_shopee-scrape.mhtml`; 
  const cookie_file = `${temp_path}/cockies.json`;
  return get_html(html_file, cookie_file);
};

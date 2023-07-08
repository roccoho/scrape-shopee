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
const {parse} = require('node-html-parser'); 
const mimelib = require("mimelib");
const sqlite3 = require('sqlite3');
const nodemailer = require('nodemailer');


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


async function db_all(db, query){
  return new Promise(function(resolve,reject){
      db.all(query, function(err,rows){
         if(err){return reject(err);}
         resolve(rows);
       });
  });
}

function create_row(row, header=false, columns=[], links={}, diff={}){
  let content = '';

  if(header===true){
      for(i=0; i<row.length; i++){
          content += `<th>${row[i]}</th>`
      }
      return `<tr>${content}</tr>` 
  }

  for(const [key, value] of Object.entries(row)){
      if (Object.keys(links).includes(key)){
          content += `<td><a href="${row[links[key]]}">${row[key]}</a></td>`;
      }
      else if (Object.keys(diff).includes(key) && row[key]!=row[diff[key]]){
          content+=`<td><p style="color:red;"><s>${String(row[key])}</s>${String(row[diff[key]])}<br></p></td>`
      }
      else if (columns.includes(key)){
          content += `<td>${value}</td>`;
      }
  }
  return `<tr>${content}</tr>` 
}

function create_html(table){
  return `
  <!DOCTYPE html>
  <html>
  <style>
  table, th, td {
      border:1px solid black;
      border-collapse: collapse;
  }
  </style>
  <body>

  <table style="width:100%">
      ${table}
  </table>
  </body>
  </html>`
}


async function send_email(db_file, sql_file, title){
  const db = new sqlite3.Database(db_file);
  const sql = fs.readFileSync(sql_file).toString();
  let rows = await db_all(db, sql); 

  if(rows.length > 0){
    let table = '';
    table += create_row(['shop_name', 'item_name', 'variation', 'sold_out', 'price', 'shipping', 'voucher'], true);
    for(i=0; i < rows.length; i++){
        // console.log(rows[i]);
        table += create_row(
            rows[i], 
            false,
            ['shop_name', 'item_name', 'variation', 'new_sold_out', 'new_price', 'new_shipping', 'new_voucher'],
            {shop_name: 'shop_url', item_name: 'item_url'},
            {new_sold_out: 'old_sold_out', new_price: 'old_price', new_shipping: 'old_shipping', new_voucher: 'old_voucher'}
        )
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.email,
          pass: process.env.email_password
        }
    });
    
    const mailOptions = {
        from: process.env.email,
        to: process.env.email,
        subject: title,
        html: create_html(table)
    };

    transporter.sendMail(mailOptions, function(error, info){
    if (error) {
        console.log(error);
    } else {
        console.log('Email sent: ' + info.response);
    }
    });
  }
  return 'send email done';
}

function insert(db, arr){
  return new Promise((resolve, reject) => {        
    return db.run(
      `INSERT INTO scrape (
        shop_name, 
        shop_url,
        item_img,
        item_name,
        item_url,
        price,
        variation,
        sold_out,
        voucher,
        shipping
      )
      values(?,?,?,?,?,?,?,?,?,?)`,
      arr,
      (err, res) =>{	
        if(err) {
          console.log(err.message); 
          return reject(err.message);
        }
        return resolve('done');
      }
    );
  });
}

function element_contains(arr, regex){
  for(let i=0; i<arr.length; i++){
    if(arr[i].text.match(regex)){
      // console.log(regex);
      return arr[i];
    }
  }
  return null;
}


async function dynamic_extract(discord, html_file, db_file){
  console.log('dynamic-extract');
  let dl_status = await discord.get_file('db', db_file);   
  console.log(`db: ${dl_status}`);
  let html = fs.readFileSync(html_file, 'utf8');
  html = mimelib.decodeQuotedPrintable(html);
  const root = parse(html);

  const db = new sqlite3.Database(db_file);
  // console.log(db);
  let main = root.querySelectorAll('div.container')[1];
  main = main.childNodes[0];
  const shop = main.childNodes[2];
  const shop_class = shop.classList.value[0];  // _48e0yS
  const shop_name_class = shop.childNodes[0].classList.value[0];  // SFF7z2
  let item_container = shop.childNodes[1].childNodes[0];  // VPZ9zs / d1QL+1 

  const span = item_container.querySelectorAll('span');
  if (element_contains(span, /.*Add-on Deals|Free Gift.*/)!==null){
    item_container = item_container.childNodes[1];  // VPZ9zs
  }
  item_container = item_container.childNodes[0]; 
  const item_container_class = item_container.classList.value[0]; //zoXdNN
  const item_name_url_class = item_container.childNodes[1].childNodes[0].classList.value[0];  //LAQKxn
  const item_price_class = item_container.childNodes.at(-2).classList.value[0]; // ofQLuG

  shops = main.querySelectorAll(`div.${shop_class}`);
  for(let i=0; i<shops.length; i++){         
    shop_container = shops[i].querySelector(`div.${shop_name_class}`);
    const shop_name_a = shop_container.querySelector('a');
    const shop_url = shop_name_a.getAttribute('href');
    const shop_name = shop_container.querySelector('span').text;
    // console.log(shop_name);

    const coupons = shops[i].querySelectorAll('div');
    const voucher = element_contains(coupons, /.*Claim voucher for|off voucher available|more to get|coin cashback available.*/);
    let voucher_text = null;
    if (voucher!==null){
      voucher_text = voucher.querySelector('div').querySelector('div').text;
    }

    const shipping = element_contains(coupons, /.*off shipping for orders over.*/);
    let shipping_text = null;
    if (shipping!==null){
      shipping_text = shipping.querySelector('div').text;
    }
    
    let item_img_url = null;
    let item_name = null;
    let item_url = null;
    let item_price = 0;
    let item_variation = null;
    let sold_out = false;

    items = shops[i].querySelectorAll(`div.${item_container_class}`);
    for(let j=0; j<items.length; j++){   
      const item_name_url_container = items[j].querySelector(`div.${item_name_url_class}`);
      const item_name_url = item_name_url_container.querySelector('a');
      item_url = item_name_url.getAttribute('href');
      item_name = item_name_url.getAttribute('title');
      item_img_url = item_name_url.querySelector('div').getAttribute('style').split('\"')[1];

      const item_price_container = items[j].querySelector(`div.${item_price_class}`);
      item_price = item_price_container.querySelectorAll('span');
      item_price = element_contains(item_price, /.*RM.*/);
      item_price = parseFloat(item_price.text.slice(2).replace(',',''));

      let item_checks = items[j].querySelectorAll('div');
      item_variation = element_contains(item_checks, /.*Variations:.*/);
      if(item_variation!==null){
        item_variation = item_variation.childNodes[0].childNodes[0].childNodes[1];
        item_variation = item_variation.text;
        // console.log(item_variation);
      }

      if (element_contains(item_checks, /.*sold out.*/)){
        sold_out = true;
        // console.log(sold_out);
      }
    };

    await insert(db, [
      shop_name, 
      shop_url,
      item_img_url,
      item_name,
      item_url,
      item_price,
      item_variation,
      sold_out,
      voucher_text,
      shipping_text
    ]);
  };
  let up_status = await discord.send_file('db', db_file); 
  console.log(`db: ${up_status}`);
  return 'dynamic-scrape-done';
}

async function get_html(discord, html_file, cookie_file){
  console.log('getting_html');
  let dl_status = await discord.get_file('cookies', cookie_file);   
  console.log(`cookies: ${dl_status}`);
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
  await new Promise(r => setTimeout(r, 5000));

  const check_login = (await page.$('[placeholder="Phone number / Username / Email"]')) || "";
  if (check_login!==""){
    const email_input = await page.waitForSelector('input[type="text"][placeholder="Phone number / Username / Email"]');
    await email_input.type(process.env.shopeeUser);
    const password_input = await page.waitForSelector('input[type="password"][placeholder="Password"]');
    await password_input.type(process.env.shopeePassword);

    page.keyboard.press('Enter');
  }

  await page.waitForSelector('.container', {visible: true});
  console.log('found container');
  await page.waitForSelector('.stardust-checkbox', {visible: true});
  console.log('found stardust');
  await new Promise(r => setTimeout(r, 5000));
  const checkbox = await page.$$('.stardust-checkbox');
  await checkbox[0].click();
  console.log('clicked checkbox');
  await new Promise(r => setTimeout(r, 10000));
  
  let complete_div = await page.$x("//div[contains(.,'All Rights Reserved')]");
  console.log('All Rights Reserved');
  while (complete_div === undefined || complete_div.length == 0){ 
      await page.evaluate(()=>{ 
          window.scrollBy(0, 100);
      });
      complete_div = await page.$x("//div[contains(.,'All Rights Reserved')]");
  }
  // console.log(complete_div);
  const cdp = await page.target().createCDPSession();
  const {data} = await cdp.send('Page.captureSnapshot', { format: 'mhtml' });
  fs.writeFileSync(html_file, data); 
  
  cookies = await page.cookies();
  fs.writeFileSync(cookie_file, JSON.stringify(cookies, null, 2));
  let up_status = await discord.send_file('cookies', cookie_file); 
  console.log(`cookies: ${up_status}`);
  await browser.close();

  up_status = await discord.send_file('html', html_file); 
  console.log(`html: ${up_status}`);
  return 'get-html done';
}

exports.helloPubSub = async(event, context) => {
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
  const db_file = `${temp_path}/scrape_${now}.db`;
  const title = `Shopee Scrape ${now}`;
  const sql_file = `difference.sql`;
  const discord = new Discord();
  const html_status = await get_html(discord, html_file, cookie_file);
  console.log(html_status);
  const extract_status = await dynamic_extract(discord, html_file, db_file);
  console.log(extract_status);
  const email_status = await send_email(db_file, sql_file, title); 
  console.log(email_status);
  // return await publish('sending message', topicName);
};

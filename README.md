# scrape-shopee
## Scrapes items and prices in [Cart](https://shopee.com.my/cart)
### Node.js 
- Puppeteer for headless scraping (Selenium in Python is not possible) in Cloud Functions triggered by Cloud Scheduler
- Retrieves latest cookies (to bypass logging in and puzzle captcha) from _discord_ server <sub>(this is bad.)</sub>
- Sends latest cookies and mhtml to discord server <sub>(baaad)</sub>
- node-html-parser to extract data from mhtml
- Updates sqlite db retrieved from discord and resend <sub>(baaad)</sub>
- Sends email if there is a change in price, availability or voucher
- No longer publish topic to trigger Python function 

All is done in Node.js

~~### Python~~
~~- Deployed in Cloud Functions triggered by topic subscription.~~\
~~- Retrieves latest html and sqlite file from <sub>discord</sub>~~\
~~- Beautifulsoup to extract data~~\
~~- Updates sqlite file and sends it to <sub>discord</sub>~~\
~~- Sends email if there is a change in price/voucher/availability/etc.~~\

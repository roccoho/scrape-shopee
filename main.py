import re
import os
import quopri 
import sqlite3
import tempfile
import pandas as pd
import pendulum as pen
from redmail import gmail
from discord import Discord 
from bs4 import BeautifulSoup
from datetime import datetime


def pen_to_dt(pen_datetime: pen.DateTime):
    return datetime.fromisoformat(pen_datetime.to_iso8601_string())  


def dynamic_extract(discord, html_path, db_path, scrape_time):
    discord.get_file(filetype='html', filepath=html_path)
    with open(html_path, encoding='utf-8') as f:
        raw_html = f.read() 

    discord.get_file(filetype='db', filepath=db_path)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    soup = BeautifulSoup(quopri.decodestring(raw_html), 'html.parser')

    main = soup.find_all('div', class_='container')[1]
    main = list(main.children)[0]
    shop = list(main.children)[2]
    shop_class = shop.attrs['class'][0]  # _48e0yS 
    shop_name_class = list(shop.children)[0].attrs['class'][0]  # SFF7z2

    item_container = list(shop.children)[1]  # Eb+POp 
    item_container = list(item_container.children)[0]  # VPZ9zs / d1QL+1 
    if (item_container.select('span:-soup-contains("Add-on Deals")')
        or item_container.select('span:-soup-contains("Free Gift")')): 
        item_container = list(item_container.children)[1]  # / VPZ9zs

    item_container = list(item_container.children)[0]  # zoXdNN
    item_container_class = item_container.attrs['class'][0]

    item_name_url = list(item_container.children)[1]
    item_name_url = list(item_name_url.children)[0]
    item_name_url_class = item_name_url.attrs['class'][0]  # LAQKxn

    item_price = list(item_container.children)[-2]
    item_price_class =item_price.attrs['class'][0]  # ofQLuG

    for ea_shop in main.find_all('div', class_=shop_class):
        shop_container = ea_shop.find('div', class_=shop_name_class)
        shop_name = shop_container.find('a')
        shop_url = shop_name['href']
        shop_name = shop_container.find('span').text
        # print(f"shop_url: {shop_url}")
        # print(f"shop_name: {shop_name}")
        
        voucher_text = ['Claim voucher for', 'off voucher available', 'more to get']
        for text in voucher_text:
            voucher = ea_shop.select(f'div:-soup-contains("{text}")')
            if voucher:    
                voucher = list(voucher[0].children)[1]
                voucher = list(voucher.children)[0].get_text() 
                # print(f'voucher: {voucher}')   
                break
        else:
            voucher = None 
     
        shipping = ea_shop.select('div:-soup-contains("off shipping for orders over")')
        if shipping:    
            shipping = list(shipping[0].children)[1]
            shipping = list(shipping.children)[0].get_text() 
            # print(f'shipping: {shipping}')
        else:
            shipping = None

        for item in ea_shop.find_all('div', class_=item_container_class):
            item_name_url_container = item.find('div', class_=item_name_url_class) 
            item_name_url = item_name_url_container.find('a')
            item_name = item_name_url['href']
            item_url = item_name_url['title']
            item_img_url = re.search(r'\("(.*?)"\)', item_name_url.find('div')['style'])[0][2:-2]
            # print(f"item_url: {item_name_url['href']}")
            # print(f"item_name: {item_name_url['title']}")
            # print(f'item_img_url: {item_img_url}')
            
            
            item_price_container = item.find('div', class_=item_price_class) 
            item_price = item_price_container.select('span:-soup-contains("RM")')
            item_price = float(item_price[0].text[2:].replace(',',''))
            # print(f"item_price: {item_price}") 

            item_variation = item.select('div:-soup-contains("Variations:")')
            if item_variation: 
                item_variation = list(item_variation[0].children)[0]
                item_variation = list(item_variation.children)[0]
                item_variation = list(item_variation.children)[1].get_text()
                # print(f"item_variation: {item_variation}")
            else:
                item_variation = None 

            sold_out = False
            if item.select('div:-soup-contains("sold out")'):
                sold_out = True

            c.execute('''INSERT INTO scrape values(?,?,?,?,?,?,?,?,?,?,?)''', 
                        (shop_name, 
                         shop_url, 
                         item_img_url, 
                         item_name, 
                         item_url, 
                         item_price, 
                         item_variation, 
                         sold_out, 
                         voucher, 
                         shipping, 
                         pen_to_dt(scrape_time),
                        )
                    ) 
            # print('')

    conn.commit()
    conn.close()    

    discord.send_file(filename=db_path, filetype='db') 


def send_email(db_path, scrape_time): 
    conn = sqlite3.connect(db_path)
    difference = open('sql/difference.sql', 'r').read()
    df = pd.read_sql_query(difference, conn)

    df['shop_name'] =  '<a href=' + df["shop_url"] + '><div>' + df["shop_name"] + '</div></a>'
    df['item_name'] =  '<a href=' + df["item_url"] + '><div>' + df["item_name"] + '</div></a>'

    compare = ['sold_out', 'voucher', 'shipping', 'price']
    for attr in compare: 
        old = f'old_{attr}'
        new = f'new_{attr}'
        df[attr] = df[new]
        df.loc[df[new]!=df[old], attr] = '<p style="color:red;"><s>' + df[old].astype(str) + '</s><br>' + df[new].astype(str) + '</p>'  

    df = df.drop(['shop_url',
                'item_url', 
                'item_img',
                'old_sold_out', 'new_sold_out',
                'old_voucher', 'new_voucher',
                'old_shipping', 'new_shipping',
                'old_price', 'new_price'], 
                axis=1)
    # df.to_html('test.html', escape=False, index=False)
    # print(df.to_html(escape=False, index=False))

    gmail.username = os.environ.get('gmail_username')
    gmail.password = os.environ.get('gmail_password')
    if not df.empty:
        gmail.send(
            subject=f'Shopee Price Tracker {scrape_time.strftime("%Y_%m_%d_%H_%M")}',
            receivers=[os.environ.get('gmail_username')], 
            html=df.to_html(escape=False, index=False) 
        )


# def hello_pubsub(event, context):
def main():
    """Triggered from a message on a Cloud Pub/Sub topic.
    Args:
         event (dict): Event payload.
         context (google.cloud.functions.Context): Metadata for the event.
    """

    script_directory = tempfile.gettempdir()
    # script_directory = '.'
    scrape_time = pen.now(tz='Asia/Singapore')  
    scrape_time_str = scrape_time.format("Y_MM_DD_HH_mm")

    html_path = f'{script_directory}/shopee-cart.mhtml' 
    db_path = f'{script_directory}/scrape-{scrape_time_str}.db'  

    discord = Discord()  # very BAD !!

    dynamic_extract(discord, html_path, db_path, scrape_time)
    send_email(db_path, scrape_time)

main()
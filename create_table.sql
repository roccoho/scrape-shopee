CREATE TABLE scrape (
    shop_name VARCHAR, 
    shop_url VARCHAR NOT NULL,
    item_img VARCHAR,
    item_name VARCHAR,
    item_url VARCHAR NOT NULL,
    price FLOAT,
    variation VARCHAR,
    sold_out BOOLEAN,
    voucher VARCHAR,
    shipping VARCHAR,
    scrape_time DATETIME DEFAULT (DATETIME('now','localtime'))
);
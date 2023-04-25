SELECT 
	b.shop_name, 
	b.shop_url, 
	b.item_img,  
	b.item_name, 
	b.item_url,
	b.variation,
	a.sold_out AS old_sold_out, 
	b.sold_out AS new_sold_out,
	a.price AS old_price, 
	b.price AS new_price,
	a.shipping AS old_shipping, 
	b.shipping AS new_shipping,
	a.voucher AS old_voucher, 
	b.voucher AS new_voucher
FROM ( 
	SELECT *
	FROM scrape
	WHERE scrape_time = (
		SELECT MAX(scrape_time)
		FROM scrape
	) 
) b LEFT JOIN ( 
	SELECT * 
	FROM scrape 
	WHERE scrape_time = (
		SELECT MAX(scrape_time)
		FROM scrape
		WHERE scrape_time < (
			SELECT MAX(scrape_time)
			FROM scrape
		) 
	)
) a ON a.item_url = b.item_url 
	and a.shop_url = b.shop_url
	and a.variation = b.variation
WHERE a.sold_out <> b.sold_out 
OR a.price <> b.price
OR a.voucher <> b.voucher
OR a.shipping <> b.shipping;
const request = require('request');
const https = require('https');
const fs = require('fs');

class Discord{
    constructor(){
        this.channels = ['db', 'cookies', 'html'];
        this.headers = {
            "Authorization": process.env.token, 
        }; 
    }

    get_url(channel){ 
        return `https://discord.com/api/v9/channels/${process.env[channel]}/messages`;    
    }

    post_request(options){ 
        return new Promise((resolve,reject)=>{
            request(options, function(err, res, body){
                if (!err && res.statusCode == 200){
                    resolve('Upload Complete!');
                }
                else{ 
                    console.log(err);
                }
            });
        }) 
    }

    async send_file(filetype, filepath){
        return new Promise((resolve, reject) =>{
            let url = '';
            if (this.channels.includes(filetype)) {
                url = this.get_url(filetype);
            } else {
                resolve('wrong channel');
            } 
            const filename = filepath.split('/').slice(-1)[0];
            const files = {
                'file[0]': (filename, fs.createReadStream(filepath))
            };
            const options = {
                url: url,
                formData: files,
                method: 'POST',
                headers: this.headers
            }
            resolve(this.post_request(options));
        })
    }

    get_request(options, filename){ 
        return new Promise((resolve,reject)=>{
            request(options, function(err, res, body){
                if (!err && res.statusCode == 200){
                    const url = JSON.parse(body)[0]['attachments'][0]['url']; 
                    const req = https.get(url, function(response) {
                        const file = fs.createWriteStream(filename, 'utf8');
                        response.pipe(file);  
                        file.on("finish", () => {
                            file.close();
                            resolve("Download Completed");
                        });
                    });
                }
                else{ 
                    console.log(err);
                }
            });
        }) 
    }


    async get_file(filetype, filename){
        return new Promise((resolve, reject) =>{
            let url = '';
            if (this.channels.includes(filetype)) {
                url = this.get_url(filetype);
            } else {
                resolve('wrong channel');
            } 
            let options = {
                url: url,
                qs: {'limit': 1},
                method: 'GET',
                headers: this.headers
            }
            resolve(this.get_request(options, filename));
        });
    }
}
module.exports = Discord

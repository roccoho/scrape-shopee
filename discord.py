import requests
import os

# very Bad, avoid !!

class Discord():
    def __init__(self) -> None:  
        self.channel_list = ['db', 'cookies', 'html']
        self.url = 'https://discord.com/api/v9/channels/{channel}/messages'    

        self.headers = {
            "Authorization": os.environ.get('TOKEN'), 
        } 

    
    def send_file(self, filetype: str, filename: str, fileobj: bytes=None): 
        if filetype in self.channel_list:
            url = self.url.format(channel = os.environ.get(filetype))
        else:
            return

        if not fileobj: 
            filepath = filename
            filename = filepath.split('/')[-1]
            fileobj = open(filepath, 'rb')

        files = {
            'file[0]': (filename, fileobj)
        }   
 
        r = requests.post(url, 
                          headers=self.headers, 
                          files=files)   
        return r
    
    
    def get_file(self, filetype: str, filepath: str): 
        if filetype in self.channel_list:
            url = self.url.format(channel = os.environ.get(filetype))
        else: 
            return
 
        r = requests.get(url=url, 
                         headers=self.headers, 
                         params={'limit':1}) 

        dl_link = r.json()[0].get('attachments')[0].get('url')
        file = requests.get(dl_link)
        
        with open(filepath, 'wb') as f: 
            f.write(file.content)

        return file.content


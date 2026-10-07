#!/bin/bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1")
curl -sSL -m 30 -A "$UA" "https://www.bing.com/search?q=$q&setlang=fr&cc=FR&count=15" -o /tmp/bing_$$.html
python3 - /tmp/bing_$$.html <<'P'
import re,sys,html,base64,urllib.parse
t=open(sys.argv[1],errors='ignore').read()
for m in re.finditer(r'<li class="b_algo".*?</li>',t,re.S):
    b=m.group(0)
    a=re.search(r'<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>(.*?)</a>',b,re.S)
    if not a: continue
    u=html.unescape(a.group(1))
    if 'bing.com/ck/a' in u:
        mm=re.search(r'[?&]u=a1([^&]+)',u)
        if mm:
            s=mm.group(1); s+='='*(-len(s)%4)
            try: u=base64.urlsafe_b64decode(s).decode()
            except: pass
    title=html.unescape(re.sub('<[^>]+>','',a.group(2)))
    sn=re.search(r'<p[^>]*>(.*?)</p>',b,re.S)
    sn=html.unescape(re.sub('<[^>]+>','',sn.group(1)))[:220] if sn else ''
    print('-',title,'|',u); print('    ',sn)
P
rm -f /tmp/bing_$$.html

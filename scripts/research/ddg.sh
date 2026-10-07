#!/bin/bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1")
curl -sSL -m 30 -A "$UA" "https://html.duckduckgo.com/html/?q=$q" | python3 -c "
import re,sys,html,urllib.parse
t=sys.stdin.read()
for m in re.finditer(r'<a rel=\"nofollow\" class=\"result__a\" href=\"([^\"]+)\">(.*?)</a>.*?class=\"result__snippet\"[^>]*>(.*?)</a>',t,re.S):
    u=m.group(1)
    mm=re.search(r'uddg=([^&]+)',u)
    if mm: u=urllib.parse.unquote(mm.group(1))
    print(html.unescape(re.sub('<[^>]+>','',m.group(2))),'|',u); print('   ',html.unescape(re.sub('<[^>]+>','',m.group(3)))[:250])
"

#!/bin/bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1")
curl -sSL -m 30 -A "$UA" "https://www.mojeek.com/search?q=$q&lang=fr" | python3 -c "
import re,sys,html
t=sys.stdin.read()
for m in re.finditer(r'<li[^>]*>\s*<a class=\"ob\" href=\"([^\"]+)\".*?<h2><a[^>]*>(.*?)</a></h2>.*?<p class=\"s\">(.*?)</p>',t,re.S):
    print('-',html.unescape(re.sub('<[^>]+>','',m.group(2))),'|',m.group(1)); print('    ',html.unescape(re.sub('<[^>]+>','',m.group(3)))[:250])
"

#!/bin/bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1")
curl -sSL -m 30 -A "$UA" "https://search.brave.com/search?q=$q&source=web" -o /tmp/brave_$$.html
python3 - /tmp/brave_$$.html <<'P'
import re,sys,html
t=open(sys.argv[1],errors='ignore').read()
n=0
for m in re.finditer(r'<a href="(https?://[^"]+)"[^>]*class="[^"]*(?:l1|heading|svelte)[^"]*"[^>]*>(.*?)</a>',t,re.S):
    u=m.group(1)
    if 'brave.com' in u: continue
    title=html.unescape(re.sub(r'<[^>]+>','',m.group(2))).strip()
    if title and n<12: print('-',title[:120],'|',u); n+=1
P
rm -f /tmp/brave_$$.html

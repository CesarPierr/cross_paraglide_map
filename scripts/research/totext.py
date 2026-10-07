import re,html,sys
t=open(sys.argv[1],errors='ignore').read()
t=re.sub(r'(?s)<(script|style|noscript).*?</\1>','',t)
t=re.sub(r'<br\s*/?>|</p>|</div>|</li>|</tr>|</h\d>','\n',t)
t=re.sub(r'<[^>]+>','',t)
t=html.unescape(t)
t=re.sub(r'[ \t]+',' ',t)
t=re.sub(r'\n\s*\n+','\n',t)
print(t)

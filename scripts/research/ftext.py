import re,html,sys
raw=open(sys.argv[1],'rb').read()
t=raw.decode('iso-8859-1')
t=re.sub(r'(?s)<(script|style|noscript).*?</\1>','',t)
t=re.sub(r'<br\s*/?>|</p>|</div>|</li>|</tr>|</h\d>','\n',t)
t=re.sub(r'<[^>]+>','',t); t=html.unescape(t)
t=re.sub(r'[ \t\xa0]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
a=t.find('Imprimer'); b=t.find('Aller à:')
t=t[a:b if b>0 else None]
skip=('Signaler au','Enregistrée','Rampant','Hors ligne','Messages:','vols:','Aile:','pratique principale','Invité')
print('\n'.join(l for l in t.split('\n') if not any(l.strip().startswith(s) or (s in ('Signaler au','Enregistrée') and s in l) for s in skip)))

import json,time,urllib.request
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
L=[x for x in json.load(open('gp_list.json')) if (x['dimension_propiedad'] or 0)>=100]
out=[]
for x in L:
    for i in range(3):
        try: d=json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.goplaceit.com/api/v4/properties/{x['id']}",headers={"User-Agent":UA}),timeout=30)); break
        except Exception as e: d=None; time.sleep(2)
    if d: out.append(d)
    time.sleep(1)
json.dump(out,open('gp_detail.json','w'),ensure_ascii=False); print(len(L),len(out))

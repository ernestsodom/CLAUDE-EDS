import json,time,urllib.request
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
def get(u):
    for i in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA}),timeout=30))
        except Exception as e: time.sleep(2*(i+1)); err=e
    print("FAIL",u,err); return None
B="https://api.goplaceit.com/api/v4/search/all_properties?country=1&mode=1&type=2&commune=288&id_currency_sell=2&per_page=30&to_price_sell=8500&habitaciones_desde=3&banos_desde=2"
res={};p=1
while True:
    d=get(f"{B}&page={p}")
    if not d or not d['response']: break
    for x in d['response']: res[x['id']]=x
    pg=d['meta']['pagination']; print(p,pg['pages'],pg['total_entries'],len(res),flush=True)
    if p>=pg['pages']: break
    p+=1; time.sleep(1)
json.dump(list(res.values()),open('gp_list.json','w'),ensure_ascii=False)

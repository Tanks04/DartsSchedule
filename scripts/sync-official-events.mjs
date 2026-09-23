import fs from "node:fs";
import path from "node:path";

const outFile=path.resolve("public/data/official-events.json");
let previousSnapshot=null;try{previousSnapshot=JSON.parse(fs.readFileSync(outFile,"utf8"));}catch{}
const ua={"user-agent":"DartsScheduler official calendar checker/1.0 (+https://github.com/Tanks04/DartsSchedule)"};
const months={sijecnja:1,veljace:2,ozujka:3,travnja:4,svibnja:5,lipnja:6,srpnja:7,kolovoza:8,rujna:9,listopada:10,studenog:11,prosinca:12};
const plain=value=>String(value??"").replace(/&nbsp;|&#160;/gi," ").replace(/<br\s*\/?>/gi," ").replace(/<[^>]+>/g," ").replace(/&scaron;/gi,"š").replace(/&zcaron;/gi,"ž").replace(/&cacute;/gi,"ć").replace(/&ccaron;/gi,"č").replace(/&dstrok;/gi,"đ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const slug=value=>plain(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
async function get(url){const response=await fetch(url,{headers:ua});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.text();}
function blocks(html,tag){const result=[];const re=new RegExp(`<\\/?${tag}\\b[^>]*>`,`gi`);let depth=0,start=-1,match;while((match=re.exec(html))){const closing=match[0][1]==="/";if(!closing){if(depth===0)start=match.index;depth++;}else if(depth){depth--;if(depth===0&&start>=0){result.push(html.slice(start,re.lastIndex));start=-1;}}}return result;}
function croDate(value){const normalized=slug(value).replaceAll("-"," ");const match=normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);if(!match||!months[match[2]])return"";return`${match[3]}-${String(months[match[2]]).padStart(2,"0")}-${match[1].padStart(2,"0")}`;}

async function hpsEvents(){
  const home=await get("https://hps-dart.hr/");
  const links=[...home.matchAll(/href=["']([^"']*raspored-natjecanja-[^"']+)["']/gi)].map(m=>new URL(m[1],"https://hps-dart.hr/").href).sort().reverse();
  const sourceUrl=links[0]||"https://hps-dart.hr/raspored-natjecanja-2025-26";
  const html=await get(sourceUrl);const events=[];const season=(sourceUrl.match(/(\d{4})-(\d{2})(?:\D|$)/)||[]).slice(1).join("-")||"unknown";
  for(const row of blocks(html,"tr")){
    const cells=blocks(row,"td").map(plain);
    const text=plain(row);if(!/HPS Masters/i.test(text))continue;
    const date=croDate(cells[0]||text);const titleCell=cells.find(x=>/HPS Masters/i.test(x))||text;const place=cells.at(-1)||"";if(!date)continue;
    const number=(titleCell.match(/(\d+)\.\s*HPS Masters/i)||[])[1]||String(events.length+1);
    const discipline=/klasi/i.test(titleCell)?"classic":"electronic";const address=(place.match(/Adresa:\s*(.+)$/i)||[])[1]||"";const location=place.replace(/Adresa:\s*.+$/i,"").trim();const parts=location.split(",").map(x=>x.trim()).filter(Boolean);
    events.push({externalId:`hps-${season}-m${number}-${discipline==="classic"?"c":"e"}`,eventDate:date,endDate:"",startTime:"",title:`${number}. HPS Masters`,organizer:"HPS",discipline,category:"Svi",venueName:parts.slice(1).join(", "),address,city:parts[0]||"",sourceUrl,note:""});
  }
  return events;
}

async function psgzEvents(){
  const sourceUrl="https://psgz.hr/competitions";const page=await get(sourceUrl);
  const unionId=(page.match(/id=["']Id["'][^>]*value=["'](\d+)/i)||[])[1]||"2";
  const seasonSelect=(page.match(/<select[^>]*search-season[^>]*>[\s\S]*?<\/select>/i)||[])[0]||"";
  const selectedSeason=seasonSelect.match(/<option[^>]*selected[^>]*value=["'](\d+)["'][^>]*>([\s\S]*?)<\/option>/i)||seasonSelect.match(/<option[^>]*value=["'](\d+)["'][^>]*>([\s\S]*?)<\/option>/i)||[];const seasonId=selectedSeason[1];const seasonCode=(plain(selectedSeason[2]).match(/(\d{4})\D+(\d{2,4})/)||[]).slice(1).join("-")||seasonId;
  const leagueSelect=(page.match(/<select[^>]*search-league[^>]*>[\s\S]*?<\/select>/i)||[])[0]||"";
  const leagues=[...leagueSelect.matchAll(/<option[^>]*value=["'](\d+)["'][^>]*>([\s\S]*?)<\/option>/gi)].map(m=>({id:m[1],name:plain(m[2])})).filter(x=>/masters/i.test(x.name));
  const raw=[];
  for(const league of leagues){
    const endpoint=new URL("/site/uniondivision/UnionLeagueTable",sourceUrl);endpoint.search=new URLSearchParams({unionId,seasonId,leagueId:league.id});
    const json=JSON.parse(await get(endpoint.href));
    for(const game of String(json.html||"").matchAll(/<div class="date">\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s+(\d{1,2}:\d{2})\s*<\/div>\s*<a href="\/event\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
      const date=`${game[3]}-${game[2].padStart(2,"0")}-${game[1].padStart(2,"0")}`;const title=plain(game[6]);const number=(title.match(/(\d+)/)||[])[1]||"";const discipline=/klasi/i.test(league.name)?"classic":"electronic";const pairs=/par/i.test(title);const category=/junior/i.test(league.name)?"Juniori":/seniorke/i.test(league.name)?"Seniorke":"Seniori";
      raw.push({date,time:game[4],number,discipline,pairs,category,eventId:game[5]});
    }
  }
  const grouped=new Map();
  for(const item of raw){
    const kind=item.discipline==="classic"?"classic":item.pairs?"pairs":item.category;const key=`${item.date}|${item.time}|${item.number}|${kind}`;
    const previous=grouped.get(key);if(previous){previous.category="Seniori i seniorke";continue;}grouped.set(key,{...item});
  }
  return [...grouped.values()].map(item=>{const code=item.discipline==="classic"?`c${item.number}`:`e${item.number}-${item.pairs?"p":item.category==="Juniori"?"j":item.category==="Seniorke"?"z":"s"}`;return{externalId:`psgz-${seasonCode}-${code}`,eventDate:item.date,endDate:"",startTime:item.time,title:`${item.number}. ${item.discipline==="classic"?"klasični Masters":item.pairs?"Masters parova":"Masters"}`,organizer:"PSGZ",discipline:item.discipline,category:item.category,venueName:"",address:"",city:"",sourceUrl,note:""};});
}

const result={generatedAt:new Date().toISOString(),sources:[],events:[]};
for(const [name,loader] of [["HPS",hpsEvents],["PSGZ",psgzEvents]]){try{const events=await loader();result.sources.push({name,ok:true,count:events.length});result.events.push(...events);}catch(error){const retained=(previousSnapshot?.events??[]).filter(event=>event.organizer===name);result.sources.push({name,ok:false,count:retained.length,error:error instanceof Error?error.message:String(error)});result.events.push(...retained);}}
result.events.sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||a.startTime.localeCompare(b.startTime)||a.organizer.localeCompare(b.organizer));
if(previousSnapshot&&JSON.stringify(previousSnapshot.sources)===JSON.stringify(result.sources)&&JSON.stringify(previousSnapshot.events)===JSON.stringify(result.events))result.generatedAt=previousSnapshot.generatedAt;
fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(result,null,2)+"\n");
console.log(result.sources.map(x=>`${x.name}: ${x.ok?`${x.count} events`:x.error}`).join("\n"));
if(result.sources.every(x=>!x.ok))process.exitCode=1;

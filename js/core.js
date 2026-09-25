// ======================================================================
// HELPERS  ·  DOM lookup, escaping, number and date formatting
// ======================================================================
const $=id=>document.getElementById(id);
// Anything dropped into HTML goes through here first, text or attribute:
// the quotes matter inside an attribute, and null reads as nothing rather
// than the word "null".
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Yes/no settings are checkboxes; these keep the read/write sites tidy.
const boolVal=id=>!!$(id)?.checked;
const setBool=(id,v)=>{const el=$(id);if(el)el.checked=!!v};
// Money-formatted text inputs: stored as "$1,234,567" but read as a number.
const MONEY_INPUTS=["piRent","piIncome","cayman","bankDeposit","capital","dailyBudget","planBankAmount","planBankInvested","bkDeposit","bkBudget"];
function numVal(id){const el=$(id);if(!el)return 0;const n=parseFloat(String(el.value).replace(/[^0-9.\-]/g,""));return isFinite(n)?n:0}
function formatMoneyInput(el){
  const n=parseFloat(String(el.value).replace(/[^0-9.\-]/g,""));
  el.value=isFinite(n)&&String(el.value).trim()!==""?"$"+Math.round(n).toLocaleString("en-US"):"";
}
function setMoneyInput(id,n){const el=$(id);if(el)el.value="$"+Math.round(n).toLocaleString("en-US")}
// City Bank deposit cap: $2B normally, $3B with the Oil Rig "Fat Cat" special.
function bankDepositCap(){return boolVal("fatCat")?3e9:2e9}
function bankDepositValue(){return Math.min(Math.max(0,numVal("bankDeposit")),bankDepositCap())}
function clampBankDeposit(){
  const cap=bankDepositCap();
  const raw=Math.min(Math.max(0,numVal("bankDeposit")),cap);
  setMoneyInput("bankDeposit",raw);
  const help=$("bankDepositHelp");
  if(help) help.textContent="Max $"+cap.toLocaleString("en-US");
}
function median(arr){const s=[...arr].sort((a,b)=>a-b);const mid=Math.floor(s.length/2);return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;}
// ======================================================================
// SETTINGS UI  ·  API key field, reset buttons, dependent help text
// ======================================================================
function toggleApiKeyVisibility(){
  const input=$("apiKey"), button=$("toggleApiKey");
  const visible=input.type==="text";
  input.type=visible?"password":"text";
  button.textContent=visible?"Show":"Hide";
  button.setAttribute("aria-label",(visible?"Show":"Hide")+" Torn API key");
  button.setAttribute("aria-pressed",String(!visible));
}
const money=v=>v==null||!isFinite(v)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
const pct=v=>v==null||!isFinite(v)?"—":(v*100).toFixed(2)+"%";
function setStatus(t,cls=""){ window.freshnessLive=false; $("status").className="status "+cls; $("status").textContent=t; }
// ----------------------------------------------------------------------
// DEBUG LOG  ·  A red panel under the API status that stays hidden until
// something actually goes wrong, then collects every problem in one place.
// Nothing here should ever fire in normal use; if it does, the entry is the
// bug report. Kept as text nodes rather than innerHTML because the messages
// can carry arbitrary API strings.
// ----------------------------------------------------------------------
window.debugEntries=[];
function logProblem(where,err){
  const detail=err&&err.message?err.message:(err==null?"":String(err));
  const line=detail?where+" · "+detail:where;
  const time=new Date().toLocaleTimeString("en-GB",{hour12:false});
  window.debugEntries.push(time+"  "+line);
  const box=$("debugLog"), body=$("debugLogBody"), count=$("debugLogCount");
  if(!box||!body) return;
  const row=document.createElement("div");
  const stamp=document.createElement("span");
  stamp.className="debug-log-time"; stamp.textContent=time;
  row.appendChild(stamp);
  row.appendChild(document.createTextNode(line));
  body.appendChild(row);
  if(count) count.textContent=String(window.debugEntries.length);
  const noun=$("debugLogNoun");
  if(noun) noun.textContent=window.debugEntries.length===1?"problem":"problems";
  // Open itself the first time only. A panel that has to be found is a panel
  // that gets missed, but re-opening it after it has been collapsed would be
  // fighting the user every time another entry lands.
  const first=box.hidden;
  box.hidden=false;
  if(first) box.open=true;
}
function clearProblems(){
  window.debugEntries=[];
  const box=$("debugLog"), body=$("debugLogBody"), count=$("debugLogCount");
  if(body) body.textContent="";
  if(count) count.textContent="0";
  const noun=$("debugLogNoun");
  if(noun) noun.textContent="problems";
  if(box){ box.hidden=true; box.open=false }
}
// Elapsed time since a fetch, as m:ss (or h:mm:ss past an hour).
function fmtAgo(ts){
  if(!ts) return "—";
  const s=Math.max(0,Math.floor((Date.now()-ts)/1000));
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  const p=n=>String(n).padStart(2,"0");
  return h?`${h}:${p(m)}:${p(sec)}`:`${m}:${p(sec)}`;
}
// Live "x ago" readout, refreshed every second once data has loaded.
function renderFreshness(){
  const el=$("status");
  if(!el||!lastUpdated.stocks) return;
  const other=lastUpdated.items||lastUpdated.bank;
  el.className="status good";
  const yours=lastUpdated.user?` · your data: ${fmtAgo(lastUpdated.user)} ago`:"";
  el.innerHTML=`<strong>Data refreshed</strong> · stocks: ${fmtAgo(lastUpdated.stocks)} ago · items &amp; bank: ${fmtAgo(other)} ago${yours}`;
}
setInterval(()=>{ if(window.freshnessLive) renderFreshness(); },1000);
$("toggleApiKey").addEventListener("click",toggleApiKeyVisibility);
$("apiKey").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();refresh(true)}});

function selectItemInStat(selectId,itemName){
  const el=$(selectId);
  if(!el) return false;
  const want=itemName.trim().toLowerCase();
  const opt=[...el.options].find(o=>o.textContent.trim().toLowerCase().startsWith(want))
         || [...el.options].find(o=>o.textContent.trim().toLowerCase().includes(want));
  if(opt){el.value=opt.value;return true}
  return false;
}
// Applies the default booster items to any of the three dropdowns that has no
// current selection. Leaves an existing choice untouched, so refreshes don't
// override what the user picked.
function applyDefaultBoosters(){
  const defaults=[["happyItem","Erotic DVD"],["energyItem","Xanax"],["nerveItem","Bottle of Beer"]];
  defaults.forEach(([id,name])=>{
    const el=$(id);
    if(el && !el.value) selectItemInStat(id,name);
  });
}
function resetMoneyTab(){
  $("merits").value="0";
  setBool("tciOwned",false);
  setBool("fatCat",false);
  setMoneyInput("piRent",850000);
  setMoneyInput("piIncome",900000);
  setMoneyInput("cayman",1000000000);
  setMoneyInput("bankDeposit",2000000000);
  clampBankDeposit();
  $("cayFaction").value="0";
  setBool("oilRig",false);
  $("oilMogulJp").value="0";
  selectItemInStat("nerveItem","Bottle of Beer");
  selectItemInStat("happyItem","Erotic DVD");
  selectItemInStat("energyItem","Xanax");
  calculate();
}
function resetEducationTab(){
  $("educationMerits").value="0";
  $("companyJp").value="0";
  setBool("wsuOwned",false);
  setBool("edJobPerk",false);
  document.querySelectorAll(".education-course-check").forEach(cb=>cb.checked=false);
  calculate();
}
function resetMiscTab(){
  $("piPerYear").value="1";
  $("adsPerMonth").value="1";
  $("bannerDays").value="90";
  setBool("eltOwned",false);
  setBool("propertyBroker",false);
  calculate();
}
function resetPrefsTab(){
  $("incMode").value="everything";
  $("incMax").value="optimum";
  document.querySelectorAll(".plan-prio").forEach(cb=>cb.checked=true);
  syncPlanPrioAll();
  document.querySelectorAll(".pref-prio").forEach(cb=>cb.checked=true);
  syncPrioAll();
  calculate();
}

// ======================================================================
// PERSISTENCE  ·  Save, load and clear localStorage
// ======================================================================
// Restores saved settings, selections and course ticks from this browser.
// Each group is restored independently: a corrupt entry for one should not
// take the others down with it, and every failure is named in the debug log
// rather than being swallowed.
function loadLocal(){
  try{
    const s=JSON.parse(localStorage.getItem("tornInvSettings")||"{}");
    Object.entries(s).forEach(([k,v])=>{
      if(!$(k)) return;
      const isMoney=MONEY_INPUTS.includes(k);
      const num=isMoney?parseFloat(String(v).replace(/[^0-9.\-]/g,"")):null;
      // The three item dropdowns are empty until data loads, so remember the
      // saved choice and re-apply it after the first refresh fills them.
      if(["happyItem","energyItem","nerveItem"].includes(k)&&v){
        window.savedBoosters=window.savedBoosters||{};
        window.savedBoosters[k]=v;
      }
      if($(k).type==="checkbox") $(k).checked=(v===true||v==="true");
      else if(isMoney){ if(isFinite(num)) setMoneyInput(k,num); }
      else $(k).value=v;
    });
  }catch(e){ logProblem("Saved settings could not be read. Defaults used",e) }

  try{
    $("apiKey").value=localStorage.getItem("tornInvApiKey")||"";
    MONEY_INPUTS.forEach(id=>{const el=$(id);if(el&&el.value)formatMoneyInput(el)});
  }catch(e){ logProblem("Saved API key could not be read",e) }

  // Prioritised tickers are stored separately from the field values.
  try{
    const raw=localStorage.getItem("tornInvStockPrio");
    if(raw){
      const d=JSON.parse(raw);
      if(Array.isArray(d)) document.querySelectorAll(".pref-prio").forEach(cb=>{cb.checked=d.includes(cb.dataset.ticker)});
      syncPrioAll();
    }
  }catch(e){ logProblem("Saved stock priorities could not be read",e) }

  // Owned and selected rows are saved with the settings, not automatically.
  try{
    const o=JSON.parse(localStorage.getItem("tornInvOwned")||"[]");
    if(Array.isArray(o)){window.ownedRows.clear();o.forEach(k=>window.ownedRows.add(k))}
    const sk=JSON.parse(localStorage.getItem("tornInvSkipped")||"[]");
    if(Array.isArray(sk)){window.skippedRows.clear();sk.forEach(k=>window.skippedRows.add(k))}
    const sel=JSON.parse(localStorage.getItem("tornInvSelected")||"[]");
    if(Array.isArray(sel)){window.selectedRows.clear();sel.forEach(k=>window.selectedRows.add(k))}
  }catch(e){ logProblem("Saved row marks could not be read",e) }

  try{
    restoreEducationCourseState(JSON.parse(localStorage.getItem("tornInvCourses")||"null"));
  }catch(e){ logProblem("Saved education courses could not be read",e) }

  try{
    const pin=JSON.parse(localStorage.getItem("tornInvPinned")||"null");
    if(pin){
      if(Array.isArray(pin.pinned)){window.pinnedStocks.clear();pin.pinned.forEach(t=>window.pinnedStocks.add(t))}
      window.dudPinned=!!pin.dud;
      // Saved pins are a decision already made, so the defaults stay out.
      if(pin.user) window.pinsUserSet=true;
    }
  }catch(e){ logProblem("Pinned stocks could not be read",e) }

  try{
    if(localStorage.getItem("tornInvStaleNote")==="off") window.staleNoteDismissed=true;
  }catch(e){ logProblem("Warning dismissal could not be read",e) }

  try{
    // Absent means "never saved", which should leave the defaults alone.
    const rawPrio=localStorage.getItem("tornInvPrio");
    if(rawPrio){
      const prio=JSON.parse(rawPrio);
      if(Array.isArray(prio)) document.querySelectorAll(".plan-prio").forEach(cb=>{cb.checked=prio.includes(cb.dataset.ticker)});
    }
    syncPlanPrioAll();
    const pd=JSON.parse(localStorage.getItem("tornInvPlanDone")||"[]");
    if(Array.isArray(pd)){window.planDone.clear();pd.forEach(k=>window.planDone.add(k))}
  }catch(e){ logProblem("Saved plan progress could not be read",e) }
}
function educationCourseState(){
  const state={};
  document.querySelectorAll(".education-course-check").forEach(el=>state[el.id]=el.checked);
  return state;
}
function restoreEducationCourseState(state){
  if(!state) return;
  Object.entries(state).forEach(([id,checked])=>{
    const el=$(id);
    if(el) el.checked=!!checked;
  });
}

// Persists settings, selections, course ticks and the current view.
// Fields on the Investments page. Changing one rebuilds the investment rows.
const INVESTMENT_FIELDS=[
  "merits",
  "educationMerits",
  "tciOwned",
  "fatCat",
  "wsuOwned",
  "edJobPerk",
  "happyItem",
  "energyItem",
  "nerveItem",
  "piRent",
  "piIncome",
  "cayman",
  "bankDeposit",
  "cayFaction",
  "oilRig",
  "piPerYear",
  "adsPerMonth",
  "bannerDays",
  "eltOwned",
  "oilMogulJp",
  "companyJp",
  "propertyBroker",
  "incMode",
  "incMax",
  "compareTermTable",
  "returnPeriodTable"
];
// Fields on the Planner page. These only mark an existing plan out of date,
// so that typing in the planner does not re-run the simulation on every key.
const PLANNER_FIELDS=[
  "capital",
  "dailyBudget",
  "planGoal",
  "planTarget",
  "planTci",
  "planIncMax",
  "planPiOwn",
  "planPiRent",
  "planCayman",
  "planCityBank",
  "planTargetBlock",
  "planBankAmount",
  "planBankDays",
  "planBankTermSel",
  "returnPeriodPlan"
];
// Fields on the Basic Banking page. Each one shadows an Investments field of
// its own, listed here, and starts out mirroring it. Editing one stops the
// mirroring for that field only, so the page can be played with freely
// without disturbing the investment settings until Apply is pressed.
const BANKING_MIRROR={bkMerits:"merits",bkTci:"tciOwned",bkOilJp:"oilMogulJp",
                      bkFatCat:"fatCat",bkDeposit:"bankDeposit",bkBudget:"dailyBudget"};
const BANKING_FIELDS=[...Object.keys(BANKING_MIRROR),"bkDetailTerm"];
// Which of them the reader has taken over. Restored by loadBankingTouched().
window.bankingTouched=new Set();
// Everything persisted to localStorage, which is the three lists together.
const SAVED_FIELDS=[...INVESTMENT_FIELDS,...PLANNER_FIELDS,...BANKING_FIELDS];
// Every write is guarded: a browser in private mode, or one whose storage is
// full, throws on setItem. Left unhandled that threw straight out of the Save
// button and the page looked like it had saved when nothing had.
function saveLocal(){
  const s={};
  SAVED_FIELDS.forEach(k=>{const el=$(k);if(el)s[k]=el.type==="checkbox"?el.checked:el.value});
  try{
    localStorage.setItem("tornInvSettings",JSON.stringify(s));
    localStorage.setItem("tornInvStockPrio",JSON.stringify([...prioritised()]));
    localStorage.setItem("tornInvOwned",JSON.stringify([...window.ownedRows]));
    localStorage.setItem("tornInvSkipped",JSON.stringify([...window.skippedRows]));
    localStorage.setItem("tornInvSelected",JSON.stringify([...window.selectedRows]));
    localStorage.setItem("tornInvCourses",JSON.stringify(educationCourseState()));
    localStorage.setItem("tornInvView",document.body.classList.contains("basic")?"basic":"advanced");
    localStorage.setItem("tornInvPrio",JSON.stringify([...prioritisedTickers()]));
    localStorage.setItem("tornInvPlanDone",JSON.stringify([...window.planDone]));
    if(window.edJobPerkPrefs) localStorage.setItem("tornInvPerkPrefs",JSON.stringify(window.edJobPerkPrefs));
    if($("apiKey").value)localStorage.setItem("tornInvApiKey",$("apiKey").value);
  }catch(e){
    logProblem("Settings could not be saved. Storage may be full, or private mode is on",e);
    setStatus("Nothing was saved: this browser refused to write to storage. Private mode, or storage is full.","bad");
    return;
  }
  setStatus("Settings and selections saved locally.","good");
}
// Wipes everything this page has stored, on screen and in localStorage.
function clearLocal(){
  ["tornInvSettings","tornInvApiKey","tornInvStockPrio","tornInvOwned","tornInvSkipped","tornInvSelected","tornInvBankTerm","tornInvCourses","tornInvView","tornInvPrio","tornInvPlanDone","tornInvConfigCollapsed","tornInvBankPrincipal","tornInvPinned","tornInvStaleNote","tornInvBankingTouched","tornInvScriptsDraft","tornInvGhToken","tornInvPerkPrefs",MARKET_CACHE_KEY]
    .forEach(k=>localStorage.removeItem(k));
  window.ownedRows.clear();
  window.skippedRows.clear();
  window.selectedRows.clear();
  window.planDone.clear();
  // Pins are stored in tornInvPinned, so they have to be dropped here too.
  // Leaving them set meant the pin buttons still looked pinned after a clear,
  // and the next Save wrote them straight back.
  window.pinnedStocks.clear();
  window.dudPinned=false;
  if(typeof syncPinnedButtons==="function") syncPinnedButtons();
  if(window.edJobPerkPrefs) window.edJobPerkPrefs.length=0;
  if(typeof renderEdJobPerks==="function") renderEdJobPerks();
  $("apiKey").value="";
  window.savedBoosters=null;
  render();
  setStatus("Saved key, settings and selections cleared from this browser. Your row marks and pins are cleared on screen too; the settings stay until you reload.","good");
}

// ======================================================================
// DATA FETCHING  ·  Torn API and tornsy.com, with error reporting
// ======================================================================
async function torn(url){
  const key=$("apiKey").value.trim(); if(!key) throw new Error("Enter a Torn API key.");
  const u=new URL(url);u.searchParams.set("key",key);u.searchParams.set("comment","Torn Investments by Autumn");
  let r;
  try{ r=await fetch(u); }
  catch{ throw new Error("Can't reach the Torn API · it may be down, or your connection dropped."); }
  if(!r.ok) throw new Error(`Torn API returned an error (HTTP ${r.status}). It may be down or rate limiting.`);
  let j;
  try{ j=await r.json(); }
  catch{ throw new Error("The Torn API sent an unreadable response · it may be down."); }
  if(j.error) throw new Error(`Torn API: ${j.error.error||"unknown error"}`);
  return j;
}
// ---- Market data cache -------------------------------------------------
// Share prices, item values and bank rates are the same for everybody, so
// there is no reason to re-fetch them on every page load. They are written
// here after each successful pull and read back on startup, which makes a
// reload instant and costs no API calls. Personal data is never cached.
const MARKET_CACHE_KEY="tornInvMarket";
function cacheMarket(){
  try{
    localStorage.setItem(MARKET_CACHE_KEY,JSON.stringify({
      v:1,prices,rates,lastUpdated,
      // Descriptions are only read while the page is open; dropping them keeps
      // the cache small enough to survive a tight storage quota.
      items:items.map(({id,name,market,buy,sell})=>({id,name,market,buy,sell})),
      stockMeta:window.stockMeta||null,
      live:window.live||null,
      educationIndex:window.educationIndex||null,
      pointsMarket:window.pointsMarket||null
    }));
  }catch(e){ logProblem("Market cache could not be written. Storage may be full, or private mode is on",e) }
}
// Age of the cached market data, in hours, or null if there is none.
function marketCacheAge(){
  const t=Math.max(lastUpdated.stocks||0,lastUpdated.items||0,lastUpdated.bank||0);
  return t?(Date.now()-t)/3600000:null;
}
function restoreMarket(){
  let c=null;
  try{ c=JSON.parse(localStorage.getItem(MARKET_CACHE_KEY)||"null") }
  catch(e){ logProblem("Market cache could not be read. A refresh will rebuild it",e) }
  if(!c||c.v!==1) return false;
  if(c.prices&&Object.keys(c.prices).length) prices=c.prices;
  if(c.rates&&Object.keys(c.rates).length) rates=c.rates;
  if(Array.isArray(c.items)&&c.items.length){ items=c.items.map(x=>({...x,description:""})); populateStatItems() }
  if(c.stockMeta) window.stockMeta=c.stockMeta;
  if(c.educationIndex) window.educationIndex=c.educationIndex;
  if(Array.isArray(c.pointsMarket)&&c.pointsMarket.length) window.pointsMarket=c.pointsMarket;
  // Only fields the cached run actually resolved are taken; a null there means
  // that fetch had failed, and the built-in table is the better fallback.
  if(c.live&&window.live) Object.entries(c.live).forEach(([k,v])=>{ if(v!=null) window.live[k]=v });
  if(c.lastUpdated) lastUpdated={...lastUpdated,...c.lastUpdated};
  return !!(Object.keys(prices).length||items.length);
}
async function fetchRates(){
  const j=await torn("https://api.torn.com/torn/?selections=bank"); rates=j.bank||{}; lastUpdated.bank=Date.now();
}
async function fetchItems(){
  const j=await torn("https://api.torn.com/torn/?selections=items");
  const raw=j.items||j.data?.items||{}; items=Object.entries(raw).map(([id,x])=>({id:+id,name:x.name,market:+x.market_value||0,buy:+x.buy_price||0,sell:+x.sell_price||0,description:x.description||""}));
  lastUpdated.items=Date.now(); populateStatItems();
}
// Public reference lists: stock ids to tickers, and course ids to names.
// Both are only needed to translate a user's own data, so a failure here is
// reported rather than fatal.
async function fetchStockMeta(){
  const j=await tornTry("https://api.torn.com/torn/?selections=stocks");
  if(j.__error){ window.stockMetaError=j.__error; return }
  const raw=j.stocks||j.data?.stocks||{};
  window.stockMeta=Object.fromEntries(Object.entries(raw)
    .map(([id,x])=>[String(id),{acronym:x.acronym||x.name,name:x.name}]));
  // Shares per benefit block, straight from the game rather than the table
  // baked in below, so a patch to a requirement can't quietly skew every ROI.
  const req={};
  Object.values(raw).forEach(x=>{
    const n=+(x.benefit?.requirement);
    if(x.acronym&&n>0) req[x.acronym]=n;
  });
  window.live.benefitReq=Object.keys(req).length?req:null;
  window.stockMetaError=null;
}
// Purchase prices for every property. Upgrade costs aren't exposed by any
// selection, so PI_UPGRADE_COSTS stays as the built-in figure.
async function fetchPropertyPrices(){
  const j=await tornTry("https://api.torn.com/torn/?selections=properties");
  if(j.__error){ window.propertyPricesError=j.__error; return }
  const raw=j.properties||j.data?.properties||{};
  const out={};
  Object.values(raw).forEach(x=>{
    const cost=+x.cost;
    if(x.name&&cost>0) out[x.name]=cost;
  });
  window.live.propertyPrices=Object.keys(out).length?out:null;
  window.propertyPricesError=null;
}
async function fetchEducationIndex(){
  const j=await tornTry("https://api.torn.com/torn/?selections=education");
  if(j.__error){ window.educationIndexError=j.__error; return }
  const raw=j.education||j.data?.education||{};
  window.educationIndex=Object.fromEntries(Object.entries(raw).map(([id,x])=>[String(id),x.name]));
  // Course length and price, keyed to this app's own course checkboxes.
  const days={},costs={},samples=[];
  const info={},appIdOf={};
  Object.entries(raw).forEach(([apiId,x])=>{
    const id=educationIdFor(x.name);
    if(!id) return;
    appIdOf[String(apiId)]=id;
    const cost=+x.money_cost;
    if(cost>0) costs[id]=cost;
    const dur=+x.duration;
    if(dur>0) samples.push({id,duration:dur});
  });
  Object.entries(raw).forEach(([apiId,x])=>{
    const id=appIdOf[String(apiId)];
    if(!id) return;
    const r=x.results||{};
    // Anything the API lists that this app has no checkbox for is dropped from
    // the prerequisites rather than left as a number nothing can satisfy.
    info[id]={
      needs:(Array.isArray(x.prerequisites)?x.prerequisites:[])
        .map(n=>appIdOf[String(n)]).filter(Boolean),
      gains:["manual_labor","intelligence","endurance","perk"]
        .flatMap(k=>Array.isArray(r[k])?r[k]:[])
        .map(s=>String(s).trim()).filter(Boolean)
    };
  });
  const unit=calibrateCourseDuration(samples);
  if(unit) samples.forEach(x=>{ days[x.id]=x.duration/unit.per });
  window.live.courseCosts=Object.keys(costs).length?costs:null;
  window.live.courseDays=Object.keys(days).length?days:null;
  window.live.courseInfo=Object.keys(info).length?info:null;
  window.live.notes=[unit?`course length in ${unit.unit}`:"course length unit unrecognised, using built-in weeks"];
  window.educationIndexError=null;
}
// The API doesn't document what unit course duration is in, so it's worked
// out from the data: whichever divisor lines it up with the built-in weeks is
// the one used throughout. If nothing lines up, the built-in table is kept.
function calibrateCourseDuration(samples){
  const known=samples.filter(x=>COURSE_WEEKS[x.id]>0);
  if(known.length<5) return null;
  const ratios=known.map(x=>x.duration/(COURSE_WEEKS[x.id]*7)).sort((a,b)=>a-b);
  const mid=ratios[Math.floor(ratios.length/2)];
  for(const [unit,per] of [["seconds",86400],["hours",24],["days",1]]){
    if(mid>per*0.8&&mid<per*1.25) return {unit,per};
  }
  return null;
}
async function fetchPoints(){
  try{
    const j=await torn("https://api.torn.com/market/?selections=pointsmarket");
    const raw=j.pointsmarket||j.data?.pointsmarket||{};
    const list=Array.isArray(raw)?raw:Object.values(raw);
    window.pointsMarket=list.reduce((m,x)=>{const p=+x.cost||+x.price||0; if(p)m.push(p);return m},[]);
    window.pointsMarketError=null;
  }catch(e){
    window.pointsMarket=[];
    window.pointsMarketError=e.message||"Unknown error fetching points market";
    logProblem("Points market price unavailable. Point-valued benefits can't be priced",e);
  }
}
async function fetchStocks(){
  // Share prices come from tornsy.com, a third-party mirror, so failures here
  // are separate from the Torn API being unavailable.
  let r;
  try{ r=await fetch("https://tornsy.com/api/stocks"); }
  catch{ throw new Error("Can't reach tornsy.com for share prices · the service may be down."); }
  if(!r.ok) throw new Error(`tornsy.com returned an error (HTTP ${r.status}) · share prices unavailable.`);
  let j;
  try{ j=await r.json(); }
  catch{ throw new Error("tornsy.com sent an unreadable response · share prices unavailable."); }
  const data=j.data||[];
  if(!data.length) throw new Error("tornsy.com returned no share prices.");
  prices={};data.forEach(x=>prices[x.stock]=+x.price);
  lastUpdated.stocks=(j.timestamp?j.timestamp*1000:Date.now());
}

// ======================================================================
// USER DATA  ·  Faction gate, personal pulls, and preconfiguration
// ======================================================================
// Only members of this faction can load data at all.
const REQUIRED_FACTION="The ZOO - Night Shift";
// Star ratings at which an Oil Rig unlocks each of the two specials this app
// cares about.
const OIL_RIG_SPECIALS={taxHaven:7,fatCat:10,oilMogul:5};
// Torn's company_type ids. Only the four with specials this app cares about
// are listed; a company can be renamed by its director, so the name is not
// safe to match on. Names are kept purely for the status line.
const COMPANY_TYPE={HAIR_SALON:1,PROPERTY_BROKER:20,OIL_RIG:28,FITNESS_CENTER:29};
// Specials that pay job points toward a timer. Job points per day equal the
// company's star rating, so the star count is the dropdown value.
const JP_SPECIAL_COMPANIES=[
  {type:COMPANY_TYPE.FITNESS_CENTER, minStars:1, label:"Fitness Centre"},
  {type:COMPANY_TYPE.HAIR_SALON,     minStars:7, label:"Hair Salon"}
];
// Reads the company name and stars once, then sets whichever specials apply.
// A company with no matching special clears the field rather than leaving a
// stale value from a previous employer.
function applyJobSpecials(d,ok,miss){
  const job=d.job||{};
  const name=String(job.company_name||d.company?.name||"").trim();
  const type=+(job.company_type||d.company?.company_type||0)||0;
  const stars=+(d.company?.rating||d.company?.stars||job.company_rating||0)||0;
  if(!type){
    miss("Job point specials","no relevant company reported");
    return;
  }
  if(!stars){
    miss("Job point specials",`${name} · star rating not reported`);
    return;
  }
  const notes=[];
  const setSel=(id,val)=>{ const el=$(id); if(el&&+el.value!==val){ el.value=String(val); return true } return false };
  let changed=false;
  // Oil Mogul: bank time.
  const oilJp=(type===COMPANY_TYPE.OIL_RIG&&stars>=OIL_RIG_SPECIALS.oilMogul)?stars:0;
  changed=setSel("oilMogulJp",oilJp)||changed;
  if(oilJp) notes.push(`Oil Mogul ${oilJp} JP/day`);
  // Healthy Mind / Cutting Corners: education time.
  const eduHit=JP_SPECIAL_COMPANIES.find(c=>c.type===type&&stars>=c.minStars);
  const eduJp=eduHit?stars:0;
  changed=setSel("companyJp",eduJp)||changed;
  if(eduJp) notes.push(`${eduHit.label} ${eduJp} JP/day`);
  // Interior Connections: property upgrade cost.
  const broker=type===COMPANY_TYPE.PROPERTY_BROKER&&stars>=10;
  const bcb=$("propertyBroker");
  if(bcb&&bcb.checked!==broker){ bcb.checked=broker; changed=true }
  if(broker) notes.push("Interior Connections");
  if(changed){ updateJobPointHelp(); markPlanStale() }
  ok("Job point specials",notes.length?`${name||"company"} ${stars}★ · ${notes.join(", ")}`
    :`${name||"company"} ${stars}★ · none apply`);
}
// Everything the customised key asks for, in one request.
// Fetched one at a time on purpose. Torn fails a whole request if the key
// lacks any one selection in it, so batching these would mean a single
// missing permission wiped out every setting instead of just its own.
// "job" is absent here on purpose: API v1 answers it with "This selection is
// only available in API v2", so asking for it in this loop only ever produced
// a failed request. It is fetched from v2 separately below, because the app
// does need it — it carries the company type, star rating and the user's
// position, which decide the company stock ticks and the job point specials.
const USER_SELECTION_LIST=["stocks","education","merits","money","properties","perks"];
// A request that reports failure instead of throwing, so one missing
// permission can't take down the whole refresh.
// `label` false suppresses the log entirely, for a failure that is expected
// and already handled somewhere else. Anything else is used as the message.
async function tornTry(url,label){
  try{ return await torn(url) }
  catch(e){
    if(label!==false){
      logProblem(label||("API request failed. That section was skipped ("+url.split("?")[0]+")"),e);
    }
    return {__error:e.message||String(e)};
  }
}
function factionNameOf(profile){
  return (profile?.faction?.faction_name||profile?.faction?.name||"").trim();
}
// Torn staff get in whatever faction they are in, so they can look at the app
// without joining. The profile selection already reports a role for everyone,
// "Civilian" for ordinary players, so this costs no extra request.
//
// Listed explicitly rather than treated as "anything but Civilian". Plenty of
// roles aren't Civilian without being staff: NPCs, tester and development
// accounts, and the "mini staff" positions (Committee, Reporter, Wiki
// Contributor). None of those are meant to get in.
const STAFF_ROLES=["admin","officer","moderator","helper"];
function staffRoleOf(profile){
  const role=String(profile?.role||"").trim();
  return STAFF_ROLES.includes(role.toLowerCase())?role:null;
}
// The gate: everything else is only fetched once this passes.
async function verifyFaction(){
  const j=await torn("https://api.torn.com/user/?selections=profile");
  // Both are needed by Feedback & Reporting, and the gate runs before anything
  // else, so this is the earliest they are known.
  window.userId=+(j?.player_id||j?.playerId||0)||0;
  window.userName=String(j?.name||"").trim();
  // The Scripts page's edit chrome keys off the id, so it is refreshed the
  // moment the id is known rather than waiting for the page to be reopened.
  if(typeof syncScriptsOwner==="function") syncScriptsOwner();
  const name=factionNameOf(j);
  const staff=staffRoleOf(j);
  const ok=name.toLowerCase()===REQUIRED_FACTION.toLowerCase()||!!staff;
  return {ok,name,staff,profile:j};
}
// Pulls everything a customised key allows. Anything refused is simply left
// out, and the caller reports it rather than failing.
async function fetchUserData(profile){
  const data={profile,parts:{},errors:{}};
  window.userId=+(profile?.player_id||profile?.playerId||0)||0;
  await Promise.all(USER_SELECTION_LIST.map(async sel=>{
    const j=await tornTry(`https://api.torn.com/user/?selections=${sel}`);
    if(j.__error){ data.errors[sel]=j.__error; return }
    data.parts[sel]=j;
    Object.assign(data,j);
  }));
  // Job details, v2 only. Normalised onto the same shape the rest of the app
  // reads (company_name / company_type / position), so nothing downstream has
  // to care which API version it came from.
  {
    const j=await tornTry("https://api.torn.com/v2/user/job");
    if(j.__error) data.errors.job=j.__error;
    else {
      const src=j.job||j.data?.job||j;
      const company=src.company||src;
      const job={
        company_id:company.id??company.ID??company.company_id??src.company_id,
        company_name:company.name??src.company_name,
        company_type:company.company_type??company.type??src.company_type,
        company_rating:company.rating??company.stars??src.company_rating,
        position:src.position??src.job_position??company.position
      };
      data.job=job;
      data.parts.job=job;
    }
  }
  // API v2 carries the same money payload under a different shape. Probed only
  // so the Diagnostics panel can say, from a real key, whether Torn exposes any
  // more of the bank there than v1 does. Nothing here feeds the calculations.
  {
    const j=await tornTry("https://api.torn.com/v2/user/money");
    data.v2Money=j.__error?{__error:j.__error}
      :(j.money||j.data?.money||j);
  }
  // Nothing personal came back at all: that's an access-only key.
  if(!Object.keys(data.parts).length){
    data.limited=true;
    data.limitedReason=Object.values(data.errors)[0]||"no personal selections on this key";
    return data;
  }
  // The company's star rating is a fallback for the Oil Rig specials when
  // the perks list doesn't spell them out.
  const companyId=data.job?.company_id;
  if(companyId){
    const c=await tornTry(`https://api.torn.com/company/${companyId}?selections=profile`,
      "Company profile unavailable. Needs director access. Oil Rig specials fall back to your perks list.");
    if(!c.__error) data.company=c.company||c;
    else data.errors.company=c.__error;
  }
  // The faction Cayman bonus is read from the perks list, which every key
  // already carries. Faction -> upgrades would be a second route to it, but it
  // needs "API Access" (AA) permission most members don't have, so asking for
  // it only ever produced a refusal to swallow. Not requested at all now.
  return data;
}
// Every perk line Torn reports, from every source, as one flat list. These
// read like "+ 10% Cayman Island bank interest", so they're the most direct
// answer for the job and faction bonuses this app cares about.
function allPerks(d){
  const out=[];
  ["job_perks","faction_perks","property_perks","education_perks","merit_perks",
   "book_perks","stock_perks","enhancer_perks","company_perks"].forEach(k=>{
    const v=d?.[k];
    if(Array.isArray(v)) v.forEach(x=>out.push({source:k,text:String(x)}));
  });
  return out;
}
// First of several candidates that is actually a number.
function firstNumber(...vals){
  for(const v of vals){ const n=+v; if(v!=null&&v!==""&&isFinite(n)) return n }
  return null;
}
function perkPercent(text){
  const m=String(text).match(/(\d+(?:\.\d+)?)\s*%/);
  return m?+m[1]:null;
}
// Snaps a measured percentage to the options the Cayman dropdown offers.
function snapCayman(pct){
  return [0,5,10,15,20,25].reduce((a,b)=>Math.abs(b-pct)<Math.abs(a-pct)?b:a,0);
}
// Torn's education IDs are numbers; the checkboxes here are named after the
// course, so completed courses are matched up by name.
function markEducationCourses(completedIds,courseIndex){
  let hits=0;
  const wanted=new Set((completedIds||[]).map(String));
  Object.entries(courseIndex||{}).forEach(([id,name])=>{
    if(!wanted.has(String(id))) return;
    const el=$(educationIdFor(name));
    if(el){ el.checked=true; hits++ }
  });
  return hits;
}
// "Introduction to Computing" -> edu_computer_science_introduction_to_computing
// is not derivable from the name alone, so match against the labels shown.
function educationIdFor(name){
  const want=String(name||"").trim().toLowerCase();
  const el=[...document.querySelectorAll(".education-course-check")]
    .find(cb=>(cb.dataset.course||"").trim().toLowerCase()===want);
  return el?el.id:"";
}
// Finds the Private Islands in a properties payload: the ones being rented
// from someone else, and the ones being rented out.
// A Private Island counts as fully upgraded once it has every upgrade the
// app prices, the yacht included. The yacht is not a special case anywhere.
const PI_FULL_UPGRADES=Object.keys(PI_UPGRADE_COSTS).length;
function privateIslandsFrom(props){
  const all=Object.values(props||{});
  const list=all.filter(p=>{
    const name=String(p?.property||p?.property_name||"").toLowerCase();
    return name.includes("private island")||+p?.property_type===13;
  });
  // Torn calls these "modifications" on the properties selection; "upgrades"
  // is kept as a fallback in case that ever changes back.
  const upgradeCount=p=>Array.isArray(p?.modifications)?p.modifications.length
                       :(Array.isArray(p?.upgrades)?p.upgrades.length:0);
  const perDay=p=>+(p?.rented?.cost_per_day??p?.rented?.cost_per_day_total??p?.rented?.cost??0)||0;
  const full=p=>upgradeCount(p)>=PI_FULL_UPGRADES;
  // Which upgrades Torn didn't report for this island. Names are matched
  // loosely because the properties selection has used both "modifications"
  // and "upgrades", and has not always spelled them identically.
  const upgradeNames=p=>{
    const raw=Array.isArray(p?.modifications)?p.modifications
             :(Array.isArray(p?.upgrades)?p.upgrades:[]);
    return raw.map(u=>String(typeof u==="string"?u:(u?.name||u?.title||"")).toLowerCase().trim())
              .filter(Boolean);
  };
  const missingUpgrades=p=>{
    const have=upgradeNames(p);
    if(!have.length) return null;          // nothing named, so nothing to list
    return Object.keys(PI_UPGRADE_COSTS)
      .filter(name=>!have.some(h=>h.includes(name.toLowerCase())||name.toLowerCase().includes(h)));
  };
  // Both sides show a status of "Rented", so ownership is what separates
  // them: an island you own with a tenant is income, anyone else's is rent
  // you pay. Without a player id to compare against, fall back to status.
  const me=+(window.userId||0);
  const mine=p=>me?+p?.owner_id===me:!/rent(ed|ing) from/i.test(String(p?.status||""));
  const rentedIn=list.filter(p=>p?.rented&&perDay(p)>0&&!mine(p));
  const rentedOut=list.filter(p=>p?.rented&&perDay(p)>0&&mine(p));
  const dearest=arr=>arr.slice().sort((a,b)=>perDay(b)-perDay(a))[0]||null;
  // For your own islands, a fully upgraded one is the fair comparison; fall
  // back to the dearest if none qualify.
  const pick=arr=>{
    const fully=arr.filter(full);
    return dearest(fully.length?fully:arr);
  };
  // Torn reports modifications only to the owner, so an island you rent in
  // always comes back with an empty list however upgraded it actually is.
  // Choosing on price is the only honest option, and the upgrade state is
  // simply not reported rather than reported as missing.
  const payFor=dearest(rentedIn), chargeFor=pick(rentedOut);
  return {
    paying:payFor?perDay(payFor):0,
    charging:chargeFor?perDay(chargeFor):0,
    chargingFull:chargeFor?full(chargeFor):false,
    chargingMissing:chargeFor?missingUpgrades(chargeFor):null,
    chargingCount:chargeFor?upgradeCount(chargeFor):0,
    islands:list.length,
    properties:all.length
  };
}
// "not fully upgraded" on its own leaves you guessing which upgrade is
// absent, and the commonest cause is Torn simply not listing them rather than
// the island lacking anything. Say which of the two it is.
function piUpgradeNote(full,missing,count){
  if(full) return "";
  if(missing&&missing.length) return ` · missing ${missing.join(", ")}`;
  return ` · ${count} of ${PI_FULL_UPGRADES} upgrades reported by Torn`;
}
// Writes what was pulled into the settings, leaving anything missing alone.
// Returns a line-by-line account of what happened, which the panel shows.
function applyUserData(d){
  const rep=[];
  const ok=(label,detail)=>rep.push({ok:true,label,detail});
  const miss=(label,detail)=>rep.push({ok:false,label,detail});

  const failed=sel=>d.errors&&d.errors[sel];
  // Perks first, even though they're reported further down: Fat Cat raises the
  // City Bank cap, and applying the balance before knowing about it truncated
  // anyone holding more than $2bn.
  const perks=allPerks(d);
  const jobPerks=perks.filter(p=>p.source==="job_perks");
  const bankLimitPerk=perks.find(p=>/bank/i.test(p.text)&&/(investment|limit|maximum)/i.test(p.text));
  const caymanJobPerk=jobPerks.find(p=>/cayman/i.test(p.text));
  const companyType=+(d.job?.company_type||d.company?.company_type||0);
  const stars=+(d.company?.rating||d.company?.stars||0);
  const isOilRig=companyType===COMPANY_TYPE.OIL_RIG;
  let perkReport=null;
  if(perks.length){
    if(bankLimitPerk!==undefined||caymanJobPerk!==undefined){
      setBool("fatCat",!!bankLimitPerk);
      setBool("oilRig",!!caymanJobPerk);
      perkReport=[true,[bankLimitPerk?"Fat Cat (bank limit)":null,caymanJobPerk?"Tax Haven (Cayman)":null]
        .filter(Boolean).join(", ")];
    } else {
      setBool("fatCat",false); setBool("oilRig",false);
      perkReport=[true,jobPerks.length?`${jobPerks.length} found, none affect banking`:"non relevant"];
    }
  } else if(isOilRig&&stars>0){
    setBool("oilRig",stars>=OIL_RIG_SPECIALS.taxHaven);
    setBool("fatCat",stars>=OIL_RIG_SPECIALS.fatCat);
    perkReport=[true,`Oil Rig ${stars}★ · Tax Haven ${stars>=OIL_RIG_SPECIALS.taxHaven?"on":"off"}, Fat Cat ${stars>=OIL_RIG_SPECIALS.fatCat?"on":"off"}`];
  } else {
    perkReport=[false,failed("perks")?`needs User → perks (${failed("perks")})`:"no perks reported · job details need API v2"];
  }

  // --- cash, banks ---
  const onHand=firstNumber(d.money_onhand);
  if(onHand!=null&&onHand>=0){ setMoneyInput("capital",onHand); ok("Cash on hand",money(onHand)) }
  else miss("Cash on hand",failed("money")?`needs User → money (${failed("money")})`:"not reported");

  const cityBank=firstNumber(d.city_bank?.amount,d.city_bank);
  if(cityBank!=null&&cityBank>0){ setMoneyInput("bankDeposit",Math.min(cityBank,bankDepositCap())); clampBankDeposit(); ok("City Bank",money(cityBank)) }
  else if(cityBank===0){ setMoneyInput("bankDeposit",0); clampBankDeposit(); ok("City Bank","nothing banked") }
  else miss("City Bank",failed("money")?`needs User → money (${failed("money")})`:"not reported");

  const term=bankTermLeftFrom(d);
  if(term){
    const left=Math.ceil(term.days);
    const seen=Math.ceil(noteBankTermSeen(term.days));
    $("planBankDays").value=String(Math.min(365,left));
    setBankPayout(cityBank!=null&&cityBank>0?cityBank:0);
    ok("City Bank term",left>0
      ? `${left} day${left===1?"":"s"} left · best guessing a ${planBankTerm()}-day term`
        +(seen>left?` (longest seen ${seen} days)`:"")
      : "nothing locked");
  } else {
    $("planBankDays").value="0";
    setBankPayout(0);
    miss("City Bank term",failed("money")?`needs User → money (${failed("money")})`:"no time remaining reported");
  }

  const cayman=firstNumber(d.cayman_bank);
  if(cayman!=null&&cayman>0){ setMoneyInput("cayman",cayman); ok("Cayman Islands Bank",money(cayman)) }
  else if(cayman===0){ setMoneyInput("cayman",0); ok("Cayman Islands Bank","nothing deposited") }
  else miss("Cayman Islands Bank",failed("money")?`needs User → money (${failed("money")})`:"not reported");

  // --- merits ---
  const edJobPerk=perks.find(p=>p.source==="job_perks"
                                &&/education|course/i.test(p.text)&&/%/.test(p.text));
  if(perks.length){
    setBool("edJobPerk",!!edJobPerk);
    ok("Education job perk",edJobPerk?edJobPerk.text.trim():"none");
  } else miss("Education job perk",failed("perks")?`needs User → perks (${failed("perks")})`:"not reported");

  const eduMeritKey=Object.keys(d.merits||{}).find(k=>/education\s*length/i.test(k));
  if(eduMeritKey!=null&&isFinite(+d.merits[eduMeritKey])){
    $("educationMerits").value=String(Math.max(0,Math.min(10,+d.merits[eduMeritKey])));
    ok("Education merits",`${+d.merits[eduMeritKey]}/10`);
  } else miss("Education merits",failed("merits")?`needs User → merits (${failed("merits")})`:"no Education Length merit reported");

  const meritKey=Object.keys(d.merits||{}).find(k=>/bank\s*interest/i.test(k));
  const bankMerit=meritKey!=null?+d.merits[meritKey]:NaN;
  if(isFinite(bankMerit)){ $("merits").value=String(Math.max(0,Math.min(10,bankMerit))); ok("Bank merits",`${bankMerit}/10`) }
  else miss("Bank merits",failed("merits")?`needs User → merits (${failed("merits")})`:"no Bank Interest merit reported");

  // --- education ---
  const eduIds=d.education_completed||d.education?.complete;
  if(Array.isArray(eduIds)&&eduIds.length&&window.educationIndex){
    const hits=markEducationCourses(eduIds,window.educationIndex);
    // The WSU default depends on how much study is left, which isn't known
    // until this point on a first run.
    applyDefaultPins();
    ok("Courses studied",`${hits} of ${eduIds.length} matched to the course list`);
  } else miss("Courses studied",Array.isArray(eduIds)
      ?(eduIds.length?(window.educationIndexError?`course name list unavailable · ${window.educationIndexError}`:"course name list didn't load. Refresh again"):"none completed yet")
      :(failed("education")?`needs User → education (${failed("education")})`:"not reported"));

  // --- stocks owned ---
  if(d.stocks&&window.stockMeta){
    const owned=[];
    Object.values(d.stocks).forEach(s=>{
      const meta=window.stockMeta[String(s.stock_id)];
      const shares=+(s.total_shares||s.shares||0);
      if(!meta||!shares) return;
      const row=STOCKS.find(x=>x[0]===meta.acronym);
      if(row&&shares>=blockShares(meta.acronym,row[2])) owned.push(meta.acronym);
    });
    window.pendingOwnedTickers=owned;
    // WSU's course-time discount is a setting elsewhere in the app, so the
    // holding has to be reflected there as well as marked owned.
    setBool("wsuOwned",owned.includes("WSU"));
    if(owned.length) ok("Stocks owned",`${owned.length} marked · ${owned.join(", ")}`);
    else miss("Stocks owned","no holdings big enough for a benefit block");
  } else miss("Stocks owned",failed("stocks")?`needs User → stocks (${failed("stocks")})`
      :(window.stockMetaError?`stock name list unavailable · ${window.stockMetaError}`:"stock list didn't load. Refresh again"));

  // --- job perks (applied above, reported here) ---
  (perkReport[0]?ok:miss)("Job perks",perkReport[1]);

  // --- faction Cayman bonus (0 when the faction has none) ---
  const factionCaymanPerk=perks.find(p=>p.source==="faction_perks"&&/cayman/i.test(p.text));
  const fromPerk=factionCaymanPerk?perkPercent(factionCaymanPerk.text):null;
  // No perk line means no bonus, as long as the perks list itself arrived.
  const cay=fromPerk!=null?snapCayman(fromPerk):(perks.length?0:null);
  if(cay!=null){
    $("cayFaction").value=String(cay);
    ok("Faction Cayman bonus",cay?`+${cay}%`:"none · set to 0%");
  } else miss("Faction Cayman bonus","needs User → perks on the key");
  applyCompanyStocks(d,ok,miss);
  applyJobSpecials(d,ok,miss);

  // --- private islands ---
  const pi=privateIslandsFrom(d.properties);
  const piMiss=failed("properties")?`needs User → properties (${failed("properties")})`:null;
  if(pi.paying>0){ setMoneyInput("piRent",pi.paying);
    ok("PI rent you pay",`${money(pi.paying)} per day`) }
  else miss("PI rent you pay",piMiss||(pi.islands?"none rented from anyone":"no Private Island on your account"));
  if(pi.charging>0){ setMoneyInput("piIncome",pi.charging);
    ok("PI rent you charge",`${money(pi.charging)} per day · your best of ${pi.islands} island${pi.islands===1?"":"s"}${piUpgradeNote(pi.chargingFull,pi.chargingMissing,pi.chargingCount)}`) }
  else miss("PI rent you charge",piMiss||"you own no PI or none of yours are rented out");

  updateMeritsHelp();
  syncBasicControls();
  return rep;
}
// Torn reports the time left on a City Bank investment, but not what unit it
// is in, and it isn't worth guessing wrong: a City Bank term maxes out at 90
// days, so anything up to about 90 can only be days, up to about 2,160 can
// only be hours, and beyond that it has to be seconds. The reading is reported
// alongside the raw number so a wrong call is visible rather than silent.
function bankTermLeftFrom(d){
  const raw=d?.city_bank?.time_left ?? d?.city_bank?.timeleft ?? d?.city_bank?.time ?? null;
  const v=+raw;
  if(raw==null||raw===""||!isFinite(v)||v<0) return null;
  if(v===0) return {raw:v,unit:"days",days:0};
  if(v<=95) return {raw:v,unit:"days",days:v};
  if(v<=2400) return {raw:v,unit:"hours",days:v/24};
  return {raw:v,unit:"seconds",days:v/86400};
}
// Torn reports the time left on a deposit but never which term was taken, and
// a 90-day term with 5 days to run looks exactly like a 7-day one. Terms are
// only ever 7, 14, 30, 60 or 90 days though, so the longest time-left ever seen
// on the current deposit is a lower bound on it: refresh anywhere near the
// start of a term and the answer is exact. A value that has gone UP since last
// time can only mean a new deposit, which starts the record again.
function noteBankTermSeen(days){
  let st={max:0,last:0};
  try{ st=JSON.parse(localStorage.getItem("tornInvBankTerm")||"null")||st }
  catch(e){ logProblem("Bank term history could not be read. Term length restarts from this refresh",e) }
  if(!(days>0)) st={max:0,last:0};
  else if(days>st.last+0.5) st={max:days,last:days};
  else st={max:Math.max(st.max,days),last:days};
  try{ localStorage.setItem("tornInvBankTerm",JSON.stringify(st)) }
  catch(e){ logProblem("Bank term history could not be saved",e) }
  return st.max;
}
function bankTermSeenMax(){
  try{ return (JSON.parse(localStorage.getItem("tornInvBankTerm")||"null")||{}).max||0 }
  catch(e){ logProblem("Bank term history could not be read",e); return 0 }
}
// The shortest term that fits everything known about this deposit. Torn never
// reports the term a deposit was taken out on, only the time left, so this
// is the best that can be inferred, and the dropdown lets it be overridden.
function planBankTermGuess(){
  const box=Math.max(0,Math.ceil(numVal("planBankDays")));
  const seen=box>0?Math.ceil(bankTermSeenMax()):0;
  const days=Math.max(box,seen);
  const terms=Object.keys(BANK_TERMS).map(Number).sort((a,b)=>a-b);
  return terms.find(t=>t>=days)||terms[terms.length-1];
}
function planBankTerm(){
  const v=+($("planBankTermSel")?.value||0);
  return v>0?v:planBankTermGuess();
}
// Fills the dropdown once. There is no "auto" entry: the inferred term is
// simply pre-selected, so the box always shows a real term and the user can
// overrule it by picking another.
function buildBankTermOptions(){
  const sel=$("planBankTermSel");
  if(!sel||sel.options.length) return;
  Object.keys(BANK_TERMS).map(Number).sort((a,b)=>a-b).forEach(d=>{
    const o=document.createElement("option");
    o.value=String(d); o.textContent=bankTermLabel(d);
    sel.appendChild(o);
  });
  sel.value=String(planBankTermGuess());
}
// Snaps the dropdown back to what the days remaining imply. Called whenever
// that figure changes (from the API or by hand) and not otherwise, so a
// deliberate choice survives until the deposit itself changes.
function applyBankTermGuess(){
  const sel=$("planBankTermSel");
  if(sel) sel.value=String(planBankTermGuess());
}
// Which of the two bank boxes is held fixed while the other is recomputed.
let bankEntry="payout";
// Puts what a running term will pay out into the payout box.
// Do not re-apply interest to this: Torn already reports the matured figure.
function setBankPayout(p){
  bankEntry="payout";
  applyBankTermGuess();
  setMoneyInput("planBankAmount",p>0?p:0);
  syncBankBoxes();
}
// Holds the invested box to the deposit cap set on the Investments page.
function clampBankInvested(){
  const cap=bankDepositCap();
  const help=$("planBankInvestedHelp");
  if(help) help.textContent="Max $"+cap.toLocaleString("en-US");
  const raw=numVal("planBankInvested");
  if(raw>cap){ setMoneyInput("planBankInvested",cap); return true }
  return false;
}
// Rewrites whichever of the two bank boxes is not being held, and the help line.
function syncBankBoxes(){
  const grow=1+planBankApr()*planBankTerm()/365;
  if(bankEntry==="invested"){
    clampBankInvested();
    const inv=numVal("planBankInvested");
    setMoneyInput("planBankAmount",inv>0?inv*grow:0);
  } else {
    const payout=numVal("planBankAmount");
    setMoneyInput("planBankInvested",payout>0?payout/grow:0);
    // A payout over the cap can only mean the deposit behind it was too big.
    if(clampBankInvested()) setMoneyInput("planBankAmount",bankDepositCap()*grow);
  }
  updatePlanBankHelp();
}
// Notes which bank box was typed in, then brings the other into line.
function bankBoxEdited(id){
  bankEntry=id==="planBankInvested"?"invested":"payout";
  syncBankBoxes();
}
function planBankApr(){
  const t=planBankTerm();
  const row=bankRows().find(r=>r.days===t);
  return row?row.roi:0;
}
// Says what the number in the box is made of. Written from the box itself, so
// it stays honest if the figure is typed in by hand.
function updatePlanBankHelp(){
  const el=$("planBankHelp");
  if(!el) return;
  const payout=numVal("planBankAmount");
  if(!(payout>0)){ el.textContent=""; return }
  const term=planBankTerm(), apr=planBankApr();
  const principal=numVal("planBankInvested");
  el.textContent=`${money(principal)} invested${bankEntry==="payout"?" at a guess":""}`
    +` | ${term} days at ${(apr*100).toFixed(2)}% APR`
    +` | ${money(payout-principal)} interest`
    // The term is a best guess from the longest time-left seen, but it sits
    // among a dozen other hand-adjustable defaults, so it's presented the
    // same way rather than explaining the inference.
    +` | Term length is set manually`;
}
// The faction upgrade that raises Cayman interest, as a percentage.
// TCP, TGP and SYS all buff a company you work at, so they are worth nothing
// to the unemployed. Employment is the switch: ticked when in a company,
// unticked when not. Only ever applied when the job data actually arrived,
// so a refused selection leaves the user's own choice alone.
const COMPANY_TICKERS=["TCP","TGP","SYS"];
function applyCompanyStocks(d,ok,miss){
  const job=d.job||{};
  const name=String(job.company_name||d.company?.name||"").trim();
  // Ownership, not employment. Torn reports the director's position as
  // "Director"; every other position is an employee, for whom these stocks
  // are no use. Position is the only reliable signal — the company profile
  // endpoint answers for employees as well, so its presence proves nothing.
  const position=String(job.position||"").trim();
  const owns=/^director$/i.test(position);
  if(!d.parts||!d.parts.job){
    const err=d.errors&&d.errors.job;
    miss("Company stocks",err?`needs User → job (${err})`:"not reported");
    return;
  }
  let changed=0;
  COMPANY_TICKERS.forEach(t=>{
    const cb=document.querySelector(`.plan-prio[data-ticker="${t}"]`);
    if(cb&&cb.checked!==owns){ cb.checked=owns; changed++ }
  });
  if(changed){ syncPlanPrioAll(); markPlanStale() }
  ok("Company stocks",owns
    ? `director of ${name||"a company"} · ${COMPANY_TICKERS.join(", ")} ticked`
    : `${position?position+", not a director":"no company"} · ${COMPANY_TICKERS.join(", ")} unticked`);
}
// Racing has no "do you hold a licence" field, so a race history stands in for
// one: having raced at all proves the licence was bought. Only the single most
// recent race is requested, which is all the proof needed. A failed or refused
// call leaves the tick exactly as the user left it.
const RACING_TICKER="TCM";
async function applyRacingStock(ok,miss){
  const j=await tornTry("https://api.torn.com/v2/user/races?limit=1&sort=DESC",false);
  if(j.__error){
    miss("Racing stock",`needs User → races (${j.__error})`);
    return;
  }
  const races=Array.isArray(j.races)?j.races:(Array.isArray(j.data)?j.data:[]);
  const hasRaced=races.length>0;
  const cb=document.querySelector(`.plan-prio[data-ticker="${RACING_TICKER}"]`);
  if(cb&&cb.checked!==hasRaced){ cb.checked=hasRaced; syncPlanPrioAll(); markPlanStale() }
  ok("Racing stock",hasRaced
    ? `race history found · ${RACING_TICKER} ticked`
    : `no races on record · ${RACING_TICKER} unticked`);
}
// Renders the per-field account of the last user refresh.
function renderUserStatus(rep,headline,cls,diag){
  const el=$("userStatus");
  if(!el) return;
  el.hidden=false;
  el.className="status user-status "+(cls||"");
  const lines=(rep||[]).map(r=>
    `<span class="us-line ${r.ok?"us-ok":"us-miss"}">${r.ok?"✓":"·"} ${esc(r.label)}: ${esc(r.detail)}</span>`).join("");
  const body=lines+(diag?renderDiagnostics(diag):"");
  // Folded away by default: the headline is the part worth seeing at a glance.
  el.innerHTML=body
    ? `<details class="us-wrap"><summary><strong>${esc(headline)}</strong></summary>${body}</details>`
    : `<strong>${esc(headline)}</strong>`;
  addUserStatusCopy(el);
}
// The whole report, including anything the debug log has collected, as plain
// text for a bug report. Built from the rendered text rather than the source
// data so what is copied is exactly what is on screen.
function userStatusText(){
  const el=$("userStatus");
  if(!el) return "";
  const wrap=el.querySelector(".us-wrap")||el;
  const parts=[];
  wrap.querySelectorAll("summary").forEach(s=>parts.push(s.textContent.trim()));
  wrap.querySelectorAll(".us-line").forEach(l=>parts.push(l.textContent.trim()));
  const log=$("debugLogBody");
  if(log&&log.children.length){
    parts.push("");
    parts.push("Problems logged:");
    // The timestamp is its own span spaced by CSS, so textContent would run it
    // straight into the message.
    [...log.children].forEach(d=>parts.push(
      [...d.childNodes].map(n=>n.textContent.trim()).filter(Boolean).join(" ")));
  }
  parts.push("");
  parts.push("Version "+APP_VERSION);
  return parts.filter((v,i,a)=>!(v===""&&a[i-1]==="")).join("\n");
}
const COPY_ICON=`<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M11 8H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7z"/><polyline points="11 8 11 12 15 12"/><path d="M7 8V5a2 2 0 0 1 2-2h6l4 4v7a2 2 0 0 1-2 2h-2"/></svg>`;
// Rebuilt with the panel, because renderUserStatus replaces its innerHTML.
function addUserStatusCopy(el){
  const wrap=el.querySelector(".us-wrap");
  if(!wrap) return;
  const btn=document.createElement("button");
  btn.type="button";
  btn.id="userStatusCopy";
  btn.className="btn btn-icon us-copy";
  btn.title="Copy this report";
  btn.setAttribute("aria-label","Copy this report");
  btn.innerHTML=COPY_ICON;
  btn.hidden=!wrap.open;
  btn.addEventListener("click",e=>{
    e.preventDefault();
    const text=userStatusText();
    const done=()=>{ btn.title="Copied"; setTimeout(()=>{btn.title="Copy this report"},1500) };
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done,()=>copyFallback(text,done));
    else copyFallback(text,done);
  });
  wrap.addEventListener("toggle",()=>{ btn.hidden=!wrap.open });
  el.appendChild(btn);
}
// Clipboard access is refused on an insecure origin and in some embedded
// browsers, so a hidden textarea is kept as the way out.
function copyFallback(text,done){
  try{
    const ta=document.createElement("textarea");
    ta.value=text; ta.setAttribute("readonly","");
    ta.style.cssText="position:fixed;top:-1000px;left:-1000px";
    document.body.appendChild(ta); ta.select();
    document.execCommand("copy");
    ta.remove();
    if(done) done();
  }catch(e){ logProblem("Report could not be copied to the clipboard",e) }
}
// What each selection actually returned, by name only, never a value. This
// is here so a field the API names differently can be spotted and fixed.
function renderDiagnostics(d){
  const rows=[];
  USER_SELECTION_LIST.forEach(sel=>{
    if(d.errors&&d.errors[sel]) rows.push(`${sel}: refused · ${d.errors[sel]}`);
    else if(d.parts&&d.parts[sel]) rows.push(`${sel}: ${Object.keys(d.parts[sel]).join(", ")||"(empty)"}`);
    else rows.push(`${sel}: not fetched`);
  });
  if(d.errors&&d.errors.company) rows.push(`company: refused · ${d.errors.company}`);
  else if(d.company) rows.push(`company: ${Object.keys(d.company).slice(0,12).join(", ")}`);
  const live=window.live||{};
  rows.push(`live reference data: ${[
    live.benefitReq?`${Object.keys(live.benefitReq).length} benefit requirements`:`benefit requirements from the built-in table${window.stockMetaError?" · "+window.stockMetaError:""}`,
    live.propertyPrices?`${Object.keys(live.propertyPrices).length} property prices`:`property prices from the built-in table${window.propertyPricesError?" · "+window.propertyPricesError:""}`,
    live.courseDays?`${Object.keys(live.courseDays).length} course lengths`:"course lengths from the built-in table",
    live.courseCosts?`${Object.keys(live.courseCosts).length} course prices`:"course prices from the built-in table",
    ...(live.notes||[])
  ].join(" · ")}`);
  const perks=allPerks(d);
  rows.push(`perk lines: ${perks.length?perks.map(x=>`${x.source}=${x.text}`).join(" | "):"none"}`);
  const bt=bankTermLeftFrom(d);
  rows.push(`city bank: ${d.city_bank&&typeof d.city_bank==="object"
    ?`fields ${Object.keys(d.city_bank).join(", ")}`:"not an object"} · term ${bt
    ?`raw ${bt.raw} read as ${bt.unit} = ${Math.ceil(bt.days)} days`:"not reported"}`);
  const v2=d.v2Money;
  rows.push(`api v2 money: ${!v2?"not probed"
    :v2.__error?`refused · ${v2.__error}`
    :`fields ${Object.keys(v2).join(", ")||"(empty)"}`
      +(v2.city_bank&&typeof v2.city_bank==="object"
        ?` · city_bank ${Object.keys(v2.city_bank).join(", ")}`:" · no city_bank object")}`);
  // The raw bank payload, so a suspicious interest figure can be traced back to
  // what Torn actually sent rather than to what the app made of it.
  rows.push(`bank rates (raw): ${Object.keys(rates).length
    ?Object.entries(rates).map(([k,v])=>`${k}=${v}`).join(" · "):"none loaded"}`);
  rows.push(`bank rates (used): ${bankRows().map(r=>`${r.days}d ${(r.roi*100).toFixed(2)}%`).join(" · ")}`);
  const props=Object.values(d.properties||{});
  rows.push(`properties: ${props.length} · fields ${props.length?Object.keys(props[0]).join(", "):"—"}`);
  return `<details class="us-diag"><summary>Diagnostics · what your key returned</summary>${
    rows.map(r=>`<span class="us-line">${esc(r)}</span>`).join("")}</details>`;
}

const REFILLABLE_ITEMS = {
  happy: [
    ["Bag of Bon Bons",25],["Bag of Chocolate Kisses",25],["Box of Bon Bons",25],
    ["Box of Extra Strong Mints",25],["Box of Sweet Hearts",25],["Lollipop",25],
    ["Box of Chocolate Bars",25],["Big Box of Chocolate Bars",35],["Bag of Candy Kisses",50],
    ["Chocolate Egg",50],["Bag of Bloody Eyeballs",75],["Bag of Tootsie Rolls",75],
    ["Bag of Chocolate Truffles",100],["Bag of Reindeer Droppings",100],["Bag of Humbugs",150],
    ["Bag of Sherbet",150],["Jawbreaker",150],["Pixie Sticks",150],["Birthday Cupcake",250],
    ["Xanax",75],["LSD",200,500],["PCP",250],["Shrooms",500],["Vicodin",75],["Speed",50],
    ["Erotic DVD",2500],["Feathery Hotel Coupon",500]
  ],
  nerve: [
    ["Bottle of Beer",1],["Bottle of Champagne",1],["Bottle of Saké",1],["Bottle of Tequila",1],
    ["Bottle of Kandy Kane",2],["Bottle of Pumpkin Brew",2],["Bottle of Christmas Cocktail",3],
    ["Bottle of Minty Mayhem",3],["Bottle of Wicked Witch",3],["Bottle of Mistletoe Madness",4],
    ["Bottle of Stinky Swamp Punch",4],["Bottle of Christmas Spirit",5],["Bottle of Green Stout",5],
    ["Bottle of Moonshine",5],["Cannabis",8,12],["LSD",5]
  ],
  energy: [
    ["Can of Goose Juice",5],["Can of Damp Valley",10],["Can of Crocozade",15],
    ["Can of Munster",20],["Can of Santa Shooters",20],["Can of Red Cow",25],
    ["Can of Rockstar Rudolph",25],["Can of Taurine Elite",30],["Can of X-MASS",30],
    ["Xanax",250],["LSD",50]
  ]
};

function refillableEffect(entry){
  const min=Number(entry[1]), max=entry.length>2?Number(entry[2]):min;
  return {min,max,avg:(min+max)/2};
}

function refillableDisplay(effect){
  return effect.min===effect.max
    ? `+${effect.min.toLocaleString()}`
    : `+${effect.min.toLocaleString()}–${effect.max.toLocaleString()}`;
}

// Fills the happy/energy/nerve pickers from the fetched item list.
function populateStatItems(){
  const lists={happy:[],energy:[],nerve:[]};

  for(const stat of Object.keys(REFILLABLE_ITEMS)){
    for(const entry of REFILLABLE_ITEMS[stat]){
      const [name]=entry;
      const effect=refillableEffect(entry);
      const it=items.find(x=>x.name.trim().toLowerCase()===name.trim().toLowerCase());
      if(!it) continue;
      lists[stat].push({...it,name,effect});
    }
  }

  [["happyItem",lists.happy],["energyItem",lists.energy],["nerveItem",lists.nerve]].forEach(([id,list])=>{
    const el=$(id);
    el.innerHTML='<option value="">Select an item</option>'+
      list.sort((a,b)=>a.name.localeCompare(b.name))
        .map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${refillableDisplay(x.effect)} · ${money(x.market)}</option>`)
        .join("");
  });
}
// Total remaining course time (days) across every course not yet ticked.
function remainingCourseDays(){
  return Object.keys(COURSE_WEEKS).reduce((sum,id)=>sum+($(id)?.checked?0:courseDaysFor(id)),0);
}
// Course time is cut by 2% per Education Length merit, 10% for a WSU block and
// 10% for topping out the education job, and those stack on the base time
// rather than compounding, which is also why WSU saves the same 10% whatever
// your merits are. All three together are the most there is, at 40%. They only
// apply to a course started after you have them: one already running is set.
const EDU_MERIT_REDUCTION=0.02;
// ======================================================================
// JOB POINT SPECIALS
// Two company specials spend job points to shorten a timer that is already
// running. Both are self-referential: points accrue per day, so how long the
// timer runs decides how many points you get, which decides how much it is
// shortened, which decides how long it runs.
//
// Solving it is a one-liner rather than a loop. For the bank, with a nominal
// term of T days, p job points a day and 3 points buying one hour:
//
//   D = T - (p * D / 3) / 24      hours bought, converted to days
//   D * (1 + p/72) = T
//   D = 72T / (72 + p)
//
// So the term finishes in D days but pays the full T days of interest. The
// effective APR is therefore scaled by T/D = (72 + p)/72, which is the only
// number the rest of the app needs.
//
// Education uses the same shape with 1 point buying half an hour:
//
//   D = R - (q * D / 2) / 24  ->  D = 48R / (48 + q)
//
// Both hold for fractional points because leftover points roll to the next
// day rather than being lost, so the average rate is what matters.
// ======================================================================
const JP_PER_BANK_HOUR=3;             // 3 job points buy one hour off the bank
const EDU_HOURS_PER_JP=0.5;           // 1 job point buys 30 minutes off a course
function oilMogulJp(){ return Math.max(0,Math.min(10,+($("oilMogulJp")?.value||0))) }
function companyJp(){ return Math.max(0,Math.min(10,+($("companyJp")?.value||0))) }
// Hours per day each special buys, which is what the help lines quote.
function oilMogulHoursPerDay(){ return oilMogulJp()/JP_PER_BANK_HOUR }
function companyHoursPerDay(){ return companyJp()*EDU_HOURS_PER_JP }
// Days a nominal bank term actually takes once points are being spent.
function bankTermRealDays(termDays){
  const p=oilMogulJp();
  return p>0 ? termDays*72/(72+p) : termDays;
}
// The factor an APR is multiplied by because the same interest arrives sooner.
function bankTimeFactor(){
  const p=oilMogulJp();
  return p>0 ? (72+p)/72 : 1;
}
// The factor remaining course time is multiplied by for the same reason.
function educationJpFactor(){
  const q=companyJp();
  return q>0 ? 48/(48+q) : 1;
}
// "2 hours p/day", or "1 hour 30 minutes p/day" when it lands on a half hour.
function hoursPerDayLabel(hours){
  if(!(hours>0)) return "none";
  const whole=Math.floor(hours+1e-9);
  const mins=Math.round((hours-whole)*60);
  const h=whole===1?"1 hour":`${whole} hours`;
  if(!mins) return `${h} p/day`;
  const m=`${mins} minutes`;
  return whole?`${h} ${m} p/day`:`${m} p/day`;
}
function updateJobPointHelp(){
  const oil=$("oilMogulHelp");
  if(oil) oil.textContent="Oil Rig 5★ special: Oil Mogul reduces bank investment time by one hour"
    +` for 3 job points. Time Saved: ${hoursPerDayLabel(oilMogulHoursPerDay())}`;
  const co=$("companyJpHelp");
  if(co) co.textContent="Fitness Centre 1★ special: Healthy Mind and Hair Salon 7★: Cutting Corners"
    +" reduce education course time by 30 minutes for 1 job point."
    +` Time saved: ${hoursPerDayLabel(companyHoursPerDay())}`;
}
function educationTimeReduction(){
  const merits=Math.max(0,Math.min(10,+($("educationMerits")?.value||0)));
  return Math.min(0.9,merits*EDU_MERIT_REDUCTION
                     +(boolVal("wsuOwned")?0.10:0)
                     +(boolVal("edJobPerk")?0.10:0));
}
// Days until every remaining course is finished, studying them back to back.
function educationRemainingDays(){
  return Math.max(0,remainingCourseDays()*(1-educationTimeReduction())*educationJpFactor());
}
/** Splits a day count into calendar years, months and days from today, or null past a century. */
function durationParts(totalDays){
  const days=Math.round(totalDays);
  if(!isFinite(days)||days<=0) return {years:0,months:0,days:0};
  if(days>36500) return null;
  const addMonths=(date,n)=>{
    const d=new Date(date), day=d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth()+n);
    // Clamp to the last valid day so e.g. Jan 31 + 1 month lands on Feb 28/29.
    d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
    return d;
  };
  const start=new Date();
  start.setHours(0,0,0,0);
  const target=new Date(start);
  target.setDate(target.getDate()+days);

  let cur=new Date(start), years=0, months=0;
  while(addMonths(cur,12)<=target){cur=addMonths(cur,12);years++}
  while(addMonths(cur,1)<=target){cur=addMonths(cur,1);months++}
  return {years,months,days:Math.round((target-cur)/86400000)};
}
/** Formats a day count as a calendar-accurate duration from today, like "2 years 3 months 4 days". */
function formatDuration(totalDays){
  const p=durationParts(totalDays);
  if(!p) return "100+ years";
  const unit=(n,word)=>`${n} ${word}${n===1?"":"s"}`;
  const parts=[];
  if(p.years) parts.push(unit(p.years,"year"));
  if(p.years||p.months) parts.push(unit(p.months,"month"));
  parts.push(unit(p.days,"day"));
  return parts.join(" ");
}
// Plain-language summary of what a stock pays, used for the basic-view tooltip.
function periodWord(days){
  const d=+days;
  if(d===1) return "day";
  if(d===7) return "week";
  if(d>=28&&d<=31) return "month";
  if(d===365) return "year";
  return `${d} days`;
}
function selectedBoosterName(stat){
  const el=$(`${stat}Item`);
  // Before the first refresh the only option is the "load item data" prompt,
  // and quoting that back reads as gibberish, so nothing is quoted until an
  // item has actually been picked.
  const txt=el&&el.value&&el.selectedIndex>=0?el.options[el.selectedIndex].textContent:"";
  return txt.split("·")[0].trim()||"your chosen item";
}
function tooltipFor(ticker,type,label,qty,days){
  const per=periodWord(days);
  if(BOOSTER_TYPES.includes(type))
    return `Equivalent to ${(+qty).toLocaleString()} ${type} using ${selectedBoosterName(type)}. Item is set in advanced view > Money Stuff.`;
  if(type==="item"){
    if(ticker==="TCC") return `1 random cosmetics cache per ${per}.`;
    const it=items.find(x=>x.name.toLowerCase()===String(label).toLowerCase())
           ||items.find(x=>x.name.toLowerCase().includes(String(label).toLowerCase()));
    return `${qty} × ${it?it.name:label} per ${per}.`;
  }
  if(type==="points") return `${(+qty).toLocaleString()} points per ${per}.`;
  if(type==="cash"){
    if(ticker==="MSG") return `Free classified advertising, saving ${moneyShort(250000*Math.max(0,+($("adsPerMonth")?.value||0)))} per month. Set in advanced view > Miscellaneous Stuff.`;
    if(ticker==="YAZ") return `Free banner advertising for ${Math.max(0,+($("bannerDays")?.value||0))} days a year. Set in advanced view > Miscellaneous Stuff.`;
    return `${moneyShort(qty)} per ${per}.`;
  }
  return null;
}

function itemById(id){return items.find(x=>x.id===+id)}

// Builds the "Benefit / Interest" cell content for a stock.
// Returns [mainLine, secondLine]. The second line renders smaller and muted.
function stockBenefitText(ticker,type,label,qty){
  if(SPECIAL_BENEFITS[ticker]){
    if(ticker==="MSG"){
      const ads=Math.max(0,+($("adsPerMonth")?.value||0));
      return ["Free Classified Advertising",`ad costs -${money(250000*ads)} p/month`];
    }
    if(ticker==="ELT"){
      const total=PI_UPGRADE_TOTAL;
      return ["10% Property Upgrade Discount",`saves ${money(total*0.10)} per PI`];
    }
    if(ticker==="YAZ"){
      const d=Math.max(0,Math.min(365,+($("bannerDays")?.value||0)));
      return ["Free Banner Advertising",`ad costs -${money(500000*d)} p/year`];
    }
    return SPECIAL_BENEFITS[ticker];
  }
  if(type==="item"){
    const it=items.find(x=>x.name.toLowerCase()===String(label).toLowerCase())
           ||items.find(x=>x.name.toLowerCase().includes(String(label).toLowerCase()));
    return [`${qty} x ${it?it.name:label}`, it?`MV: ${money(it.market)}`:""];
  }
  if(type==="cash") return [money(qty)];
  if(BOOSTER_TYPES.includes(type)) return [`${qty.toLocaleString()} ${type}`];
  if(type==="points") return [`${qty.toLocaleString()} points`];
  return [label||""];
}

// Total cost of every education course the user has NOT yet ticked:
// the money IST's free-courses benefit would save them from here.
function remainingCourseCost(){
  return Object.keys(COURSE_COSTS).reduce((sum,id)=>sum+($(id)?.checked?0:courseCostFor(id)),0);
}

// Returns the best (highest daily-value) virus the user can currently code,
// using education-adjusted coding times. IIL halves that time, so the extra
// value the block provides per day equals this base daily rate.
function bestVirusPerDay(forceAssumeAll){
  // Advanced always uses the actual course selections. Basic has no course
  // checkboxes, so it assumes full training, unless the user has ticked
  // courses in Advanced, in which case those take precedence. A caller can
  // also force the assumption (the Total Newbie planner pathway, which
  // assumes Computer Science courses complete from month 12).
  const basic=document.body.classList.contains("basic");
  const anyChecked=VIRUSES.some(v=>$(v.unlock)?.checked)
                || CODING_TIME_REDUCTIONS.some(r=>$(r.id)?.checked);
  const assumeAll=forceAssumeAll||(basic&&!anyChecked);
  const reduction=assumeAll
    ? CODING_TIME_REDUCTIONS.reduce((sum,r)=>sum+r.pct,0)
    : CODING_TIME_REDUCTIONS.reduce((sum,r)=>sum+($(r.id)?.checked?r.pct:0),0);
  let best=null;
  for(const v of VIRUSES){
    if(!assumeAll&&!$(v.unlock)?.checked) continue;
    const it=items.find(x=>x.name.trim().toLowerCase()===v.name.trim().toLowerCase());
    if(!it||!it.market) continue;
    const days=v.baseDays*(1-reduction);
    const perDay=it.market/days;
    if(!best||perDay>best.perDay) best={name:v.name,market:it.market,days,perDay,reduction};
  }
  return best;
}
// The chosen refill item for a stat, with its averaged effect and price.
function selectedStat(kind){
  const id=$(`${kind}Item`).value;
  const it=itemById(id);
  if(!it) return null;
  const entry=REFILLABLE_ITEMS[kind].find(x=>x[0].trim().toLowerCase()===it.name.trim().toLowerCase());
  if(!entry) return null;
  return {...it,effect:refillableEffect(entry)};
}

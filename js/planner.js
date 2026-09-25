// ======================================================================
// PLANNER  ·  Goal selection, purchase simulation and the plan table
// ======================================================================

// The plan is built on demand, not on every keystroke. simulatePlan() walks
// years of purchases and was previously re-run by every input on the page,
// which is what made the settings crawl. The result is cached here and only
// replaced when the "Show Me The Money" button is pressed; everything else
// (ticking a step, folding a group, paging) redraws from this cache.
window.planResult=window.planResult||null;
window.planStale=false;
// Builds (or rebuilds) the plan from whatever the settings currently say.
function buildPlan(){
  const btn=$("planGo");
  if(btn) btn.disabled=true;
  try{
    window.planResult=simulatePlan();
    window.planStale=false;
    renderStaleNote();
    window.planPage=1;
    renderPlan();
  } finally {
    if(btn) btn.disabled=false;
  }
}
// A setting changed, so the plan on screen no longer matches the settings.
// It stays visible, it just says so.
function markPlanStale(){
  if(window.planResult) window.planStale=true;
  renderStaleNote();
}
// The warning only makes sense once a plan exists to be out of date. Dismissal
// is permanent and per-browser: someone who knows to press the button again
// doesn't need telling every time.
window.staleNoteDismissed=false;
function renderStaleNote(){
  const el=$("planStaleNote");
  if(!el) return;
  el.hidden=window.staleNoteDismissed||!window.planStale||!window.planResult;
}
function dismissStaleNote(){
  window.staleNoteDismissed=true;
  renderStaleNote();
  try{ localStorage.setItem("tornInvStaleNote","off") }
  catch(e){ logProblem("Warning dismissal could not be saved",e) }
}

// Stocks the planner can't rank on ROI alone: boosters, situational benefits
// and anything with no measurable return. Built from the tag lists so it stays
// in step if a stock is retagged.
function plannableStocks(){
  const set=new Set([...SITUATIONAL_TICKERS,...UNDEFINED_ROI_TICKERS,...BOOSTER_TICKERS()]);
  return STOCKS.filter(x=>set.has(x[0])).sort((a,b)=>a[1].localeCompare(b[1]));
}
function BOOSTER_TICKERS(){
  return STOCKS.filter(x=>BOOSTER_TYPES.includes(x[3])).map(x=>x[0]);
}
// Tickers the user has ticked to plan for properly.
function prioritisedTickers(){
  const set=new Set();
  document.querySelectorAll(".plan-prio").forEach(cb=>{if(cb.checked)set.add(cb.dataset.ticker)});
  return set;
}
// ----------------------------------------------------------------------
// PINNED NO-ROI STOCKS
// A no-ROI stock has no return to rank it by, so the only way to say "I want
// this one" is to name it. Pinning moves it to the front of the plan; the one
// exception refuses and goes to the back instead.
// ----------------------------------------------------------------------
const DUD_TICKER="IST";
const DUD_MESSAGE="Why would you -.-";
// WSU shortens education courses, so it's worth prioritising by default,
// but only for someone with study left to shorten. One course remaining or
// none isn't enough to be worth reordering a plan around.
const DEFAULT_PIN="WSU";
window.pinnedStocks=window.pinnedStocks||new Set();
window.dudPinned=window.dudPinned||false;
// Courses still unticked. Counted rather than measured in days, because the
// rule is about how much studying is left, not how long it takes.
function coursesRemaining(){
  return Object.keys(COURSE_WEEKS).reduce((n,id)=>n+($(id)?.checked?0:1),0);
}
// Applied once on first run, and again after an API refresh fills in courses,
// but never over a choice the user has already made and saved.
function applyDefaultPins(){
  if(window.pinsUserSet) return;
  const cb=document.querySelector(`.plan-prio[data-ticker="${DUD_TICKER}"]`);
  if(cb&&cb.checked){ cb.checked=false; syncPlanPrioAll() }
  const want=coursesRemaining()>1;
  if(want) window.pinnedStocks.add(DEFAULT_PIN);
  else window.pinnedStocks.delete(DEFAULT_PIN);
  syncPinnedButtons();
}
// Pinned stocks, cheapest first: with no ROI to separate them, price is the
// only ordering left that means anything.
function pinnedOrder(){
  const costs=new Map();
  rows.filter(r=>r.kind==="stock"&&(r.block||1)===1&&window.pinnedStocks.has(r.ticker))
      .forEach(r=>costs.set(r.ticker,r.cost));
  return [...window.pinnedStocks].sort((a,b)=>(costs.get(a)??Infinity)-(costs.get(b)??Infinity));
}
function syncPinnedButtons(){
  document.querySelectorAll(".pin-stock").forEach(b=>{
    const t=b.dataset.ticker;
    const on=t===DUD_TICKER?window.dudPinned:window.pinnedStocks.has(t);
    b.classList.toggle("pinned",on);
    b.setAttribute("aria-pressed",String(on));
  });
}
function togglePinnedStock(btn){
  const t=btn.dataset.ticker;
  const cb=document.querySelector(`.plan-prio[data-ticker="${t}"]`);
  if(t===DUD_TICKER){
    // The dud is never pinned. Clicking it either way unticks it, so the
    // outline going red means "removed from the plan", not "prioritised".
    window.dudPinned=!window.dudPinned;
    if(window.dudPinned) floatOverElement(btn,DUD_MESSAGE);
    if(cb&&cb.checked){ cb.checked=false; syncPlanPrioAll() }
    syncPinnedButtons();
    savePinned();
    markPlanStale();
    return;
  }
  if(window.pinnedStocks.has(t)) window.pinnedStocks.delete(t);
  else window.pinnedStocks.add(t);
  // Pinning something the plan was set to skip would contradict itself, so a
  // pin ticks the box too. Unpinning leaves the tick alone, since wanting it
  // planned but not first is a perfectly ordinary thing to want.
  if(window.pinnedStocks.has(t)&&cb&&!cb.checked){ cb.checked=true; syncPlanPrioAll() }
  syncPinnedButtons();
  savePinned();
  markPlanStale();
}
// A stock that is no longer planned for can't also be the thing planned first.
// The dud is exempt: being unticked is its normal state, not a contradiction.
function dropPinIfUnticked(ticker){
  if(ticker===DUD_TICKER) return;
  const cb=document.querySelector(`.plan-prio[data-ticker="${ticker}"]`);
  if(cb&&!cb.checked&&window.pinnedStocks.delete(ticker)){
    syncPinnedButtons(); savePinned();
  }
}
function savePinned(){
  window.pinsUserSet=true;
  try{
    localStorage.setItem("tornInvPinned",JSON.stringify({
      pinned:[...window.pinnedStocks],dud:window.dudPinned,user:true}));
  }catch(e){ logProblem("Pinned stocks could not be saved",e) }
}
// What each goal actually plans for, shown under the two dropdowns.
const PLAN_GOAL_DESC={
  everything:"The path to owning a single stock block of every stock.",
  stock:"The path to a chosen investment.",
  selected:"The path to owning everything you ticked in the Plan column of the Investments Tables.",
  energy1000:"The route to owning 10 Mc Smoogle Corp increments and 1000 bonus energy every week.",
  money:"Just gives you lots of money",
  increments:"Don't know why you'd want 10 of everything, but hey, it's here if you want it.",
  newbie:"A specially tailored pathway for brand new players to go from zero to multi-billionaire. Simulates bank term unlocks, gradual merit upgrades, study completion, and aims to reach the Monopoly merit in the most profitable way possible."
};
function updateGoalDesc(){
  const el=$("planGoalDesc");
  if(el) el.textContent=PLAN_GOAL_DESC[$("planGoal")?.value||"everything"]||"";
}
// Which situational stocks the goal in front of you actually needs. These are
// only ever bought when ticked, so the goal ticks the ones it depends on and
// clears the rest. Switch back to one of everything and they all return.
function situationalForGoal(){
  const goal=$("planGoal")?.value||"everything";
  const all=plannableStocks().map(x=>x[0]);
  // Mc Smoogle Corp is the energy stock, so that path needs it ticked and
  // nothing else by default. Tick more back on and the plan will buy them.
  if(goal==="energy1000") return new Set(all.filter(t=>t==="MCS"));
  if(goal==="money") return new Set();          // profit only, nothing situational
  if(goal==="stock"){
    const t=$("planTarget")?.value;
    return new Set(all.filter(x=>x===t));
  }
  if(goal==="selected"){
    const picked=new Set(rows.filter(r=>window.selectedRows.has(rowKey(r))).map(r=>r.ticker));
    return new Set(all.filter(t=>picked.has(t)));
  }
  return new Set(all);        // one of everything, and the newbie path
}
function syncPlanPrioritiseToGoal(){
  const want=situationalForGoal();
  document.querySelectorAll(".plan-prio").forEach(cb=>{cb.checked=want.has(cb.dataset.ticker)});
  syncPlanPrioAll();
}
// Which of the extra pickers a path needs. The increment picker is shared:
// "a certain investment" uses it to say how deep to go on that one stock,
// "increment amount" to say how deep to go on all of them. A stock with no
// increments leaves it dimmed rather than hidden, like every other setting
// that doesn't apply.
function syncPlanFields(){
  const goal=$("planGoal")?.value||"everything";
  const tf=$("planTargetField"), bf=$("planBlockField"), bs=$("planTargetBlock");
  if(tf) tf.hidden=goal!=="stock";
  if(bf) bf.hidden=!(goal==="stock"||goal==="increments");
  if(bs) bs.disabled=goal==="stock"&&SINGLE_BLOCK_TICKERS.includes($("planTarget")?.value);
}
// Every planner control runs through here: the goal picker shows or hides the
// fields it needs, re-ticks the situational stocks the goal needs, and the plan
// on screen is flagged as out of date.
function planSettingChanged(){
  syncPlanFields();
  updateGoalDesc();
  syncPlanPrioritiseToGoal();
  markPlanStale();
}
// The Other Investments header checkbox, matching the Situational one below it.
function syncPlanExtraAll(){
  const boxes=[...document.querySelectorAll(".plan-extra")];
  const all=$("planExtraAll");
  if(!all||!boxes.length) return;
  const on=boxes.filter(b=>b.checked).length;
  all.checked=on===boxes.length;
  all.indeterminate=on>0&&on<boxes.length;
}
// Header checkbox ticks or clears the whole list, and reflects a mixed state.
function syncPlanPrioAll(){
  const boxes=[...document.querySelectorAll(".plan-prio")];
  const all=$("planPrioAll");
  if(!all||!boxes.length) return;
  const on=boxes.filter(b=>b.checked).length;
  all.checked=on===boxes.length;
  all.indeterminate=on>0&&on<boxes.length;
}
// Stocks whose benefit isn't a plain payout have no tooltip to fall back on,
// so the planner list carries its own wording, and says where the setting
// behind each number lives.
const PLAN_STOCK_DESC={
  ELT:"10% Property Upgrade Discount. Amount of PI's upgraded per year set in advanced view > Miscellaneous Stuff.",
  IIL:"Reduces virus coding time by 50%. Virus courses completed set in advanced view > Education Stuff.",
  IST:"Free education courses. Courses remaining set in advanced view > Education Stuff.",
  LOS:"25% mission credits & money boost.",
  SYS:"Advanced Firewall",
  TCP:"Company sales boost.",
  TGP:"Company advertising boost.",
  TCM:"10% Racing skill boost.",
  WSU:"10% education course time reduction. Courses remaining set in advanced view > Education Stuff.",
  WLT:"Private Jet Access"
};
function planStockDesc(ticker,type,label,qty,days){
  return PLAN_STOCK_DESC[ticker]||tooltipFor(ticker,type,label,qty,days)||"";
}
// The booster lines quote the item you picked, which isn't known until the
// first refresh, so they are rewritten whenever the figures are.
function refreshPlanPrioritiseText(){
  document.querySelectorAll("#planPrioritise .plan-prio").forEach(cb=>{
    const s=STOCKS.find(x=>x[0]===cb.dataset.ticker);
    const sub=cb.closest(".pref-row")?.querySelector(".sub");
    if(s&&sub) sub.textContent=planStockDesc(s[0],s[3],s[5],s[6],s[4]);
  });
}
function buildPlanPrioritise(){
  const el=$("planPrioritise");
  if(!el) return;
  const all=plannableStocks();
  const noRoi=all.filter(x=>UNDEFINED_ROI_TICKERS.includes(x[0]));
  const withRoi=all.filter(x=>!UNDEFINED_ROI_TICKERS.includes(x[0]));
  const row=([ticker,name,,type,days,label,qty])=>{
    const tip=planStockDesc(ticker,type,label,qty,days);
    return `<label class="pref-row"><input type="checkbox" class="plan-prio" data-ticker="${ticker}" checked> <span class="ticker">${ticker}</span> <strong>${name}</strong><div class="sub">${esc(tip)}</div></label>`;
  };
  // No-ROI stocks can't be ranked on return, so instead of a tick they get a
  // pin: clicking the name promotes that stock to the goal the plan works
  // toward first. The checkbox still governs whether it's planned for at all.
  const pinRow=([ticker,name,,type,days,label,qty])=>{
    const tip=planStockDesc(ticker,type,label,qty,days);
    const dud=DUD_TICKER===ticker;
    return `<label class="pref-row"><input type="checkbox" class="plan-prio" data-ticker="${ticker}" checked> <button type="button" class="pin-stock${dud?" pin-dud":""}" data-ticker="${ticker}" aria-pressed="false"><span class="ticker">${ticker}</span> <strong>${name}</strong></button><div class="sub">${esc(tip)}</div></label>`;
  };
  el.innerHTML=withRoi.map(row).join("")
    +(noRoi.length?`<div class="plan-grid-rule"></div>`+noRoi.map(pinRow).join(""):"");
  el.querySelectorAll(".plan-prio").forEach(cb=>cb.addEventListener("change",()=>{
    dropPinIfUnticked(cb.dataset.ticker);
    syncPlanPrioAll();markPlanStale();
  }));
  syncPinnedButtons();
  syncPlanPrioAll();
}
// Populate the "a certain investment" picker.
function buildPlanTargets(){
  const el=$("planTarget");
  if(!el) return;
  const cur=el.value;
  el.innerHTML=STOCKS.slice().sort((a,b)=>a[1].localeCompare(b[1]))
    .map(([t,n])=>`<option value="${t}">${t} · ${n}</option>`).join("");
  if(cur) el.value=cur;
}

// ---- the simulation -------------------------------------------------

const SELL_FEE=0.001;          // 0.1% of the purchase price
const DAYS_PER_MONTH=30;

// Cayman pays monthly on the LOWEST balance held that month, so money added
// during a month earns nothing until the next one. Saving therefore grows as
//   balance -> balance x (1+rate) + a month of income
// rather than compounding on the running total.
function caymanMonthlyRate(){
  const c=rows.find(r=>r.kind==="cayman");
  if(!c||c.roi==null||!isFinite(c.roi)) return 0;
  return Math.pow(1+c.roi,1/12)-1;          // the row carries an annual yield
}
function caymanEnabled(){ return !!$("planCayman")?.checked }
function cityBankEnabled(){ return !!$("planCityBank")?.checked }

// ---- Total Newbie pathway -------------------------------------------
// A brand-new player starts with 0 bank merits, no perks (TCI, Oil Rig,
// faction bonuses) and no education, and only unlocks City Bank terms and
// merits by actually banking over time. Rather than reading the fixed
// settings from the Investments page, the functions below re-derive the
// bank (and Cayman) rate at the simulated day of each decision.
function newbieActive(){ return ($("planGoal")?.value||"")==="newbie" }
// Cumulative day at which each term length unlocks, assuming the forced
// sequence the game requires: 1 week immediately, then each longer term
// once one full term of the next-shortest length has run to completion.
function newbieTermUnlockDays(){
  const lengths=Object.keys(BANK_TERMS).map(Number).sort((a,b)=>a-b);
  // A term already running says everything up to its length is unlocked
  // already, and the next one up can only be started once it finishes, so no
  // point making someone re-earn the terms they plainly have.
  const held=numVal("planBankAmount")>0?planBankTerm():0;
  let cum=held?Math.max(0,Math.ceil(numVal("planBankDays"))):0;
  const map={};
  for(const d of lengths){
    if(held&&d<=held){ map[d]=0; continue }
    map[d]=cum; cum+=d;
  }
  return map;
}
// The newbie merit schedule: 0 until a week's been banked, then 6/8/10 at
// the one/two/three week marks.
function newbieMeritsAt(day){
  if(day>=21) return 10;
  if(day>=14) return 8;
  if(day>=7) return 6;
  return 0;
}
function newbieBankAprAt(termDays,day){
  const key=BANK_TERMS[termDays];
  const base=+(rates[key]||0)/100;
  const meritBonus=newbieMeritsAt(day)*0.05;
  return base*(1+meritBonus);           // no TCI/Fat Cat bonuses for a newbie
}
// City Bank terms available at simulated `day`, with their APR at that day.
// Off the newbie pathway this just mirrors the fixed rows already built.
function bankOptionsAt(day){
  if(newbieActive()){
    const unlock=newbieTermUnlockDays();
    return Object.keys(BANK_TERMS).map(Number)
      .filter(d=>day>=unlock[d] && +(rates[BANK_TERMS[d]]||0)>0)
      .map(d=>({days:d,roi:newbieBankAprAt(d,day)}));
  }
  return rows.filter(r=>r.kind==="bank"&&r.roi!=null&&isFinite(r.roi)&&r.days>0)
             .map(r=>({days:r.days,roi:r.roi}));
}
function bestBankOptionAt(day){
  const opts=bankOptionsAt(day);
  return opts.length?opts.reduce((a,b)=>b.roi>a.roi?b:a):null;
}
// A newbie has no faction or Oil Rig bonus on Cayman either, so base rate only.
function newbieCaymanMonthlyRate(){ return 0.005 }
function newbieCaymanAnnualRoi(){ return Math.pow(1.005,12)-1 }
// Computer Science courses (and so I Industries Ltd.) are assumed complete
// from this many simulated days in, on the Total Newbie pathway only.
const NEWBIE_IIL_UNLOCK_DAY=360;
// Property Law (10% off a property's purchase price) is assumed studied two
// years in, so a Private Island is planned at the discounted price and not
// bought before then.
const NEWBIE_PROPERTY_LAW_DAY=720;
function cityBankTerms(){
  return rows.filter(r=>r.kind==="bank"&&r.roi!=null&&isFinite(r.roi)&&r.days>0);
}
// Highest rate: what to sit on once the deposit is maxed out.
function bestCityBankTerm(){
  const t=cityBankTerms();
  return t.length?t.reduce((a,b)=>b.roi>a.roi?b:a):null;
}
const FILL_HORIZON_DAYS=365;
const PARK_CHECK_DAYS=7;
/** Returns the term that leaves the most money after a year of filling the bank. */
function richestFillOption(opts,cash,income,held,cap,idleRate=()=>0){
  let best=null,bestWorth=-Infinity;
  for(const o of opts){
    const idle=Math.max(0,idleRate(o)||0);
    let h=held,c=cash,d=0;
    while(d<FILL_HORIZON_DAYS){
      const dep=Math.min(cap,h+c); c-=dep-h; h=dep;
      const span=Math.min(o.days,FILL_HORIZON_DAYS-d);
      c+=span*income*(1+idle*span/2/365)+h*o.roi*span/365;
      d+=span;
    }
    if(h+c>bestWorth){bestWorth=h+c;best=o}
  }
  return best;
}
// Days to save `target` from `cash` at `income` per day, with spare cash held
// in Cayman at `m` per month.
function daysToSave(target,cash,income,m){
  if(cash>=target) return 0;
  if(income<=0&&m<=0) return Infinity;
  let bal=cash,days=0;
  for(let month=0;month<1200;month++){
    // A month's interest can clear the target on its own, and the boundary is
    // when it lands. Without this the day returned is the boundary less the
    // overshoot, which is before the interest exists.
    if(bal>=target) return days;
    const end=bal+DAYS_PER_MONTH*income;
    if(end>=target){
      return days+(income>0?(target-bal)/income:DAYS_PER_MONTH);
    }
    bal=end+bal*m;                          // interest on the month's low point
    days+=DAYS_PER_MONTH;
  }
  return Infinity;
}
// A safety ceiling rather than a display limit: the plan is paged, so it can
// run as long as it needs to, but it must still terminate.
// The mirror of daysToSave: what a balance is worth after `days`, on the same
// monthly-low-balance model. Used instead of assuming the target price was
// somehow reached, which invented money whenever something was also sold.
function caymanBalance(days,start,income,m){
  let bal=start,d=0;
  while(d+DAYS_PER_MONTH<=days){ bal=bal+DAYS_PER_MONTH*income+bal*m; d+=DAYS_PER_MONTH }
  return bal+Math.max(0,days-d)*income;
}
// Where a purchase's money came from, in the order the Paid With column
// lists them.
const PAID_SOURCES=["bank","cayman","invest","input","sale"];
const PAID_LABELS={
  bank:"City Bank payouts",
  cayman:"Cayman payouts",
  invest:"Investment payouts",
  input:"Capital and budget",
  sale:"Sold investments"
};
const PLAN_MAX_ACTIONS=2000;
const PLAN_MAX_DAYS=365*100;

// A first block is bought because the goal wants one of everything, however
// thin its return. An increment is optional, so it competes with the obvious
// alternative for that money: leaving it in Cayman, which takes any amount at
// a fixed rate. City Bank deliberately isn't the comparison: it pays more but
// it is capped and locks for a term, so it can't absorb what's left over.
function passiveFloor(){
  if(!caymanEnabled()) return -Infinity;
  const c=rows.find(r=>r.kind==="cayman");
  return (c&&c.roi!=null&&isFinite(c.roi))?c.roi:-Infinity;
}
// One first-block row per stock, keyed for ownership lookups.
function planCandidates(){
  // TCI has two rows for the same block, so the planner uses whichever
  // strategy is selected and ignores the other.
  const wantActive=$("planTci")?.value==="active";
  const base=rows.filter(r=>{
    // Private Islands are opt-in and are never sold once bought, so they only
    // ever appear as acquisitions, never as parking.
    if(r.kind==="island") return r.ticker==="PI OWN"?$("planPiOwn")?.checked:$("planPiRent")?.checked;
    if(r.kind!=="stock"||r.block!==1) return false;
    if(r.ticker==="TCI") return wantActive?/ - Active$/.test(r.name):/ - Passive$/.test(r.name);
    return true;
  }).map(r=>{
    // TCI pays a share of the interest on your City Bank deposit, so the
    // Investments page values it against whatever is in there today. The plan
    // is going to fill that bank, and once it is full the block is worth many
    // times more. Valuing it at today's balance had the planner buying it
    // last, or not rating it at all. Here it is valued against the cap the
    // plan is heading for.
    if(r.ticker==="TCI"&&r.kind==="stock"){
      const term=cityBankEnabled()?bestCityBankTerm():null;
      if(!term) return {...r,annual:null,roi:null};   // no bank, no bonus to earn
      const cap=newbieActive()?2e9:bankDepositCap();
      const base=(!newbieActive()&&boolVal("tciOwned"))?term.roi/1.10:term.roi;
      const annual=cap*base*0.10;
      const cost=/ - Active$/.test(r.name)?r.cost*(7*(365/term.days)/365):r.cost;
      return {...r,annual,roi:annual/cost};
    }
    if(!newbieActive()) return r;
    // Total Newbie: I Industries Ltd. is valued as if every relevant
    // Computer Science course were already complete, since that's assumed
    // true from month 12 on this pathway. simulatePlan() is what actually
    // holds the purchase back until then (NEWBIE_IIL_UNLOCK_DAY).
    if(r.ticker==="IIL"){
      const best=bestVirusPerDay(true);
      if(!best) return r;
      const annual=best.perDay*365/r.days;
      return {...r,annual,roi:annual/r.cost};
    }
    // Same idea for a Private Island: Property Law is assumed studied at two
    // years, so it's priced with that discount and gated to match. A newbie
    // owns no ELT block, so the upgrade discount doesn't apply.
    if(r.kind==="island"){
      const pi=privateIslandCost({propertyLaw:true,elt:false});
      if(!(pi.total>0)) return r;
      return {...r,cost:pi.total,roi:(r.annual!=null&&isFinite(r.annual))?r.annual/pi.total:r.roi};
    }
    return r;
  });
  // Increments are generated here rather than reused from the tables, so the
  // planner's own setting governs them. Bn costs 2^(n-1) x B1 and pays the same
  // benefit, exactly as in the investment tables.
  const sel=$("planIncMax")?.value||"optimum";
  const maxBlock=sel==="optimum"?12:Math.max(1,Math.min(10,+sel));
  // Each increment costs twice the last, so an unchecked ladder reaches B12 at
  // 2,048x the first block, hundreds of billions, which the simulation then
  // spends its whole horizon failing to save for. Anything past what the money
  // could ever reach is not generated at all. Tripled to leave room for
  // interest and for the returns of everything bought along the way; a count
  // the user asked for explicitly is never pruned.
  const reach=(numVal("capital")+Math.max(0,numVal("dailyBudget"))*PLAN_MAX_DAYS)*3;
  const positives=base.filter(r=>r.roi!=null&&isFinite(r.roi)&&r.roi>0).map(r=>r.roi);
  const floor=Math.max(positives.length?Math.min(...positives):Infinity,passiveFloor());
  const deferred=deferredTickers();
  // A block ticked in the Plan column has to exist here whatever the increment
  // setting says, or the goal would quietly drop the very thing it was asked
  // for. Only the ticked depth is forced; anything past it obeys the setting.
  const wantDepth={};
  const idOf=r=>`${r.ticker}|${r.name}`;
  const goalNow=$("planGoal")?.value||"everything";
  const pickedBlock=Math.max(1,Math.min(10,+($("planTargetBlock")?.value||1)));
  if(goalNow==="selected") rows.forEach(r=>{
    if(r.kind!=="stock"||!r.block||!window.selectedRows.has(rowKey(r))) return;
    wantDepth[idOf(r)]=Math.max(wantDepth[idOf(r)]||0,r.block);
  });
  // A depth the path itself asks for is not up for pruning either.
  else if(goalNow==="stock"){
    const t=$("planTarget")?.value;
    base.forEach(r=>{ if(r.ticker===t&&r.kind==="stock") wantDepth[idOf(r)]=pickedBlock });
  }
  else if(goalNow==="increments") base.forEach(r=>{
    if(r.kind==="stock"&&!SINGLE_BLOCK_TICKERS.includes(r.ticker)) wantDepth[idOf(r)]=pickedBlock;
  });
  else if(goalNow==="energy1000") base.forEach(r=>{
    if(r.ticker==="MCS") wantDepth[idOf(r)]=10;    // ten blocks is 1,000 energy
  });
  const out=[];
  for(const r of base){
    out.push(r);
    const need=(r.kind==="stock"&&wantDepth[idOf(r)])||0;
    if(r.kind!=="stock"||(maxBlock<2&&need<2)) continue;
    if(SINGLE_BLOCK_TICKERS.includes(r.ticker)) continue;   // no increments exist
    if(deferred.has(r.ticker)&&!need) continue;             // unticked: first block only
    if(r.depri&&!need) continue;                            // deprioritised: first block only
    if(!(r.annual>0)||!isFinite(r.cost)||r.cost<=0) continue;
    for(let n=2;n<=Math.max(maxBlock,need);n++){
      const cost=r.cost*Math.pow(2,n-1);
      const roi=r.annual/cost;
      // The increment setting is a ceiling on how deep to go, not an
      // instruction to buy weak blocks: whatever the number, a block still has
      // to clear the floor and be something the money can reach. Only a depth
      // ticked in the Plan column overrides that.
      if((roi<floor||(reach>0&&cost>reach))&&n>need) break;
      out.push({...r,block:n,cost,roi,ret7:r.annual*7/365,ret31:r.annual*31/365});
    }
  }
  return out;
}
// Daily cash a row contributes once owned. No-ROI stocks contribute nothing.
function dailyReturn(r){
  return (r.annual!=null&&isFinite(r.annual)&&r.annual>0)?r.annual/365:0;
}
// The order things should be acquired in.
// Situational, no-ROI and booster stocks are only planned for if ticked.
function isFlexibleStock(r){
  return SITUATIONAL_TICKERS.includes(r.ticker)
      ||UNDEFINED_ROI_TICKERS.includes(r.ticker)
      ||!!r.booster;
}
// Unticked flexible stocks: acquired last, never used as parking.
function deferredTickers(){
  const prio=prioritisedTickers();
  // Reads first blocks straight from `rows`, not planCandidates, which depends
  // on this and would recurse.
  return new Set(rows.filter(r=>r.kind==="stock"&&r.block===1
                              &&isFlexibleStock(r)&&!prio.has(r.ticker))
                     .map(r=>r.ticker));
}
function planOrder(){
  const prio=prioritisedTickers();
  const cands=planCandidates();
  const isFlexible=isFlexibleStock;
  // TCI Active earns nothing without a City Bank deposit to bonus, so with
  // the bank switched off it is demoted to an unticked no-ROI stock.
  const tciIdle=$("planTci")?.value==="active"&&!cityBankEnabled();
  const deferred=[],ranked=[],priced=[];
  for(const r of cands){
    if(tciIdle&&r.ticker==="TCI"){ deferred.push({...r,roi:null,annual:null}); continue; }
    const flexible=isFlexible(r);
    if(flexible&&!prio.has(r.ticker)){ deferred.push(r); continue; }
    if(r.roi!=null&&isFinite(r.roi)&&r.roi>0) ranked.push(r);
    else priced.push(r);
  }
  ranked.sort((a,b)=>b.roi-a.roi);          // by return
  priced.sort((a,b)=>a.cost-b.cost);        // no ROI: cheapest first
  deferred.sort((a,b)=>a.cost-b.cost);      // last, cheapest first
  // A prioritised stock with no measurable ROI is judged on price instead: it
  // moves ahead of the next ranked investment as soon as it costs less than it.
  const merged=[];
  let i=0,j=0;
  while(i<ranked.length||j<priced.length){
    if(i>=ranked.length){merged.push(priced[j++]);continue}
    if(j>=priced.length){merged.push(ranked[i++]);continue}
    merged.push(priced[j].cost<ranked[i].cost?priced[j++]:ranked[i++]);
  }
  let order=[...merged,...deferred];
  // Pinned no-ROI stocks jump the whole queue, cheapest first, because the
  // user has said outright that these are what the plan is for. The dud goes
  // to the very back instead, behind even the unticked stocks.
  const pinRank=new Map(pinnedOrder().map((t,idx)=>[t,idx]));
  if(pinRank.size||window.dudPinned){
    const rankOf=r=>{
      if(window.dudPinned&&r.ticker===DUD_TICKER) return Infinity;
      return pinRank.has(r.ticker)?pinRank.get(r.ticker):pinRank.size;
    };
    // Stable: everything not pinned keeps the order worked out above.
    order=order.map((r,idx)=>({r,idx}))
               .sort((a,b)=>(rankOf(a.r)-rankOf(b.r))||(a.idx-b.idx))
               .map(x=>x.r);
  }
  return order;
}
// Which stocks the goal actually requires.
function goalTargets(order){
  const goal=$("planGoal")?.value||"everything";
  // Everything that beats Cayman is worth owning on any path; below that line
  // money is better left in the bank, and only a path with a reason of its own
  // goes further.
  const cay=passiveFloor();
  const beatsCayman=r=>r.roi!=null&&isFinite(r.roi)&&r.roi>cay;
  if(goal==="stock"){
    const t=$("planTarget")?.value;
    const want=Math.max(1,Math.min(10,+($("planTargetBlock")?.value||1)));
    let idx=order.findIndex(r=>r.ticker===t&&(r.block||1)===want);
    if(idx<0) idx=order.findIndex(r=>r.ticker===t);
    return idx<0?order:order.slice(0,idx+1);
  }
  if(goal==="money"){
    // Profit and nothing else. Situational and booster stocks are out entirely,
    // whatever their ROI: that figure is the cash value of a benefit, not cash,
    // and this path is for people who only want the money.
    return order.filter(r=>beatsCayman(r)&&!isFlexibleStock(r));
  }
  if(goal==="energy1000"){
    // Best value first until Cayman wins, then the ten Mc Smoogle blocks that
    // make 1,000 energy, plus a block of whatever situational stocks are ticked.
    const prio=prioritisedTickers();
    return order.filter(r=>(r.ticker==="MCS"&&(r.block||1)<=10)
                         ||beatsCayman(r)
                         ||(r.kind==="stock"&&isFlexibleStock(r)&&prio.has(r.ticker)&&(r.block||1)===1));
  }
  if(goal==="selected"){
    // Only what is ticked in the Plan column. A ticked increment brings the
    // blocks under it along: each one is its own purchase, so B3 means buying
    // B1 and B2 too. Everything else the plan buys is parking, bought to earn
    // while saving, then sold on, which acquire() handles as it always has.
    const deepest={};
    const idOf=r=>r.kind==="stock"?`${r.ticker}|${r.name}`:rowKey(r);
    order.forEach(r=>{
      if(!window.selectedRows.has(rowKey(r))) return;
      const id=idOf(r);
      deepest[id]=Math.max(deepest[id]||0,r.block||1);
    });
    return order.filter(r=>deepest[idOf(r)]!=null&&(r.block||1)<=deepest[idOf(r)]);
  }
  return order;
}

// Walk forward from today, buying what the order calls for. While saving for
// the next target, park spare cash in something cheaper, but only if it will
// complete at least one payout cycle before we sell, and that payout beats the
// 0.1% we lose on the sale.
// TCI only has to be held while a deposit is made, and it takes this long to
// come into effect after buying.
const TCI_ACTIVATION_DAYS=7;
function simulatePlan(){
  const order=planOrder();
  const deferred=deferredTickers();
  // TCI Active is managed by the bank routine rather than bought outright:
  // its only value is the deposit bonus, so it is acquired for the week
  // before a deposit and sold once the rate is locked in.
  const tciActive=$("planTci")?.value==="active";
  // With City Bank in play the bank routine borrows TCI itself, so it isn't
  // bought outright. Without it, TCI Active has no measurable return at all
  // and is treated like any other unticked no-ROI stock (see planOrder).
  const tciManaged=tciActive&&cityBankEnabled();
  const targets=goalTargets(order).filter(t=>!(tciManaged&&t.ticker==="TCI"));
  const prio=prioritisedTickers();
  // WSU only shortens courses, so once there are none left it stops being
  // worth prioritising and drops back with the other no-ROI stocks.
  const eduDoneDay=educationRemainingDays();
  // The plan starts from what is already held, as marked on the Investments
  // page, which includes anything a personal API refresh detected. Ticking a
  // plan step still doesn't feed back into this; progress and position stay
  // separate, which is what stopped the plan reshuffling underfoot.
  const owned=new Set();
  const seeded=rows.filter(r=>(r.kind==="stock"||r.kind==="island")
                            &&window.ownedRows.has(rowKey(r)));
  seeded.forEach(r=>owned.add(rowKey(r)));
  let cash=numVal("capital");
  // Where the cash in hand came from, so every purchase can say what paid for
  // it. Kept in step with `cash` by potCredit, potSpend and accrue.
  const pot={bank:0,cayman:0,invest:0,input:0,sale:0};
  pot.input=Math.max(0,cash);
  const potTotal=()=>PAID_SOURCES.reduce((a,k)=>a+pot[k],0);
  const potCredit=(src,amt)=>{ if(amt>0) pot[src]+=amt };
  // Spends `amt`, taking from each source in proportion to what it holds,
  // and reports the split so the step can show it.
  const potSpend=amt=>{
    const split={};
    if(!(amt>0)) return split;
    const total=potTotal();
    if(!(total>0)) return {input:amt};
    const take=Math.min(amt,total);
    PAID_SOURCES.forEach(k=>{
      const cut=pot[k]/total*take;
      if(cut>0){ pot[k]-=cut; split[k]=cut }
    });
    return split;
  };
  const baseIncome=numVal("dailyBudget");
  let day=0;
  const steps=[];
  // Two different endings: outOfRoom means the simulation itself ran out of
  // steps and everything after is unknown, while a single target being out of
  // reach only rules out that one. The rest of the list still gets planned.
  let outOfRoom=false;
  const useCayman=caymanEnabled();
  const isNewbie=newbieActive();
  const caymanRowActual=rows.find(r=>r.kind==="cayman");
  const caymanM=useCayman?(isNewbie?newbieCaymanMonthlyRate():caymanMonthlyRate()):0;
  const caymanRoi=useCayman
    ?(isNewbie?newbieCaymanAnnualRoi():(caymanRowActual?caymanRowActual.roi:-Infinity))
    :-Infinity;
  // Total Newbie: no faction or Oil Rig bonus on Cayman either.
  const caymanRow=isNewbie&&caymanRowActual
    ?{...caymanRowActual,roi:caymanRoi,annual:caymanRowActual.cost*caymanRoi,
      desc:"+0.50% monthly base · no faction or Oil Rig bonus (Total Newbie)"}
    :caymanRowActual;
  const useCityBank=cityBankEnabled();
  const bankCap=isNewbie?2e9:bankDepositCap();   // no Fat Cat perk for a newbie
  // A term already running: the money is untouchable until it matures, and no
  // new deposit can be made before then. It arrives as cash on the day it ends.
  const lockedPayout=numVal("planBankAmount");
  let pendingBank=lockedPayout>0?{payout:lockedPayout,day:Math.max(0,Math.ceil(numVal("planBankDays")))}:null;
  let bankHeld=0;                       // currently locked in City Bank
  // Once the deposit is capped nothing more can go in, so the interest comes
  // out as cash instead. runCityBank only credits interest while filling, so
  // this is what keeps it paying afterwards.
  const bankFull=()=>bankHeld>=bankCap;
  // The TCI block the bank routine borrows, and whether it's currently held.
  const tciRow=tciActive?rows.find(r=>r.kind==="stock"&&r.ticker==="TCI"&&/ - Active$/.test(r.name)):null;
  let tciHeld=false;
  // The passive block is simply kept, so from the moment it is bought every
  // deposit earns the bonus rate. Its worth is counted there rather than as
  // income of its own, which would be the same money twice.
  let tciPassiveHeld=seeded.some(r=>r.ticker==="TCI"&&/ - Passive$/.test(r.name||""));
  // With TCI managed here, the rate has to start from its pre-bonus value,
  // otherwise the Investments-page checkbox would apply the 10% a second time.
  const bankRoiFor=row=>{
    const base=(!isNewbie&&boolVal("tciOwned"))?row.roi/1.10:row.roi;
    return base*((tciActive?tciHeld:tciPassiveHeld)?1.10:1);
  };
  // Best City Bank term available right now. Off the newbie pathway this is
  // a fixed lookup; on it, terms and merits unlock as simulated days pass.
  const bankRowAt=day=>{
    if(!useCityBank) return null;
    return isNewbie?bestBankOptionAt(day):bestCityBankTerm();
  };

  // Everything currently held, whether kept or waiting to be sold on.
  const held=[];                       // {row, forOcc}
  seeded.forEach(r=>held.push({row:r,forOcc:null,net:0}));
  // A held TCI block earns through the bank rate above, not on its own, so it
  // contributes nothing here, otherwise the bonus would be counted twice.
  const returnOf=row=>(row.kind==="stock"&&row.ticker==="TCI")?0:dailyReturn(row);
  const income=()=>{
    const term=bankFull()?bankRowAt(day):null;
    return baseIncome+held.reduce((a,h)=>a+returnOf(h.row),0)
           +(term?bankHeld*bankRoiFor(term)/365:0);
  };
  // Moves `days` of income into cash, crediting each source for its share.
  // `compound` mirrors whether the call site ran the Cayman compounding.
  const accrue=(days,compound)=>{
    if(!(days>0)) return;
    const inc=income();
    const before=cash;
    cash=(compound&&useCayman)?caymanBalance(days,cash,inc,caymanM):cash+days*inc;
    const gained=cash-before;
    if(!(gained>0)) return;
    const term=bankFull()?bankRowAt(day):null;
    const fromBank=days*(term?bankHeld*bankRoiFor(term)/365:0);
    const fromInvest=days*held.reduce((a,h)=>a+returnOf(h.row),0);
    const fromInput=days*baseIncome;
    potCredit("bank",fromBank);
    potCredit("invest",fromInvest);
    potCredit("input",fromInput);
    potCredit("cayman",gained-fromBank-fromInvest-fromInput);
  };
  const heldFor=occ=>held.filter(h=>h.forOcc===occ);
  const resaleOf=list=>list.reduce((a,h)=>a+h.row.cost*(1-SELL_FEE),0);
  // Called wherever the clock moves on: once the term is up the money is in
  // hand, and the plan is free to bank again.
  const creditMaturedBank=()=>{
    if(!pendingBank||day<pendingBank.day) return;
    const p=pendingBank; pendingBank=null;
    cash+=p.payout;
    potCredit("bank",p.payout);
    steps.push({row:{kind:"bank",ticker:"BANK",name:"City Bank – term matures",bank:true,
                     days:0,cost:p.payout,roi:null,annual:null},
                day,sold:[],unreachable:false,parking:false,depth:0,parentOcc:null,
                occId:`mature${steps.length}`,cityBank:true,
                bankNote:`Term ends · ${moneyShort(p.payout)} released`});
  };
  const saveTime=(need,from)=>from>=need?0:(useCayman
    ? daysToSave(need,from,income(),caymanM)
    : (income()>0?(need-from)/income():Infinity));

  // Days until `target` is affordable, counting what we would sell to buy it.
  const waitFor=(target,forOcc)=>{
    // What cash itself has to reach: the price less whatever we'll sell to
    // help pay for it. Counting the resale here and again at purchase time
    // was handing out the parked stock's value twice.
    const needed=target.cost-resaleOf(heldFor(forOcc));
    let wait=saveTime(needed,cash);
    // Waiting for the bank term to end can beat saving the whole sum.
    if(pendingBank&&day<pendingBank.day){
      const until=pendingBank.day-day;
      if(wait>until){
        const atMaturity=(useCayman?caymanBalance(until,cash,income(),caymanM):cash+until*income())
                         +pendingBank.payout;
        wait=Math.min(wait,until+saveTime(needed,atMaturity));
      }
    }
    // Total Newbie: Computer Science courses aren't assumed complete until
    // month 12, so I Industries Ltd. can't actually be bought before then.
    if(isNewbie&&target.ticker==="IIL") wait=Math.max(wait,NEWBIE_IIL_UNLOCK_DAY-day);
    // Likewise Property Law at two years, which is the price a Private
    // Island is planned at on this pathway.
    if(isNewbie&&target.kind==="island") wait=Math.max(wait,NEWBIE_PROPERTY_LAW_DAY-day);
    return wait;
  };

  // Best thing to park in while saving for `target`: affordable in time, and
  // paying out enough before we sell it to beat the 0.1% fee.
  const bestParking=(target,wait,forOcc)=>{
    const inc=income();
    return planCandidates()
      .filter(r=>!owned.has(rowKey(r))&&rowKey(r)!==rowKey(target)
               &&!held.some(h=>rowKey(h.row)===rowKey(r))
               &&!deferred.has(r.ticker)
               &&r.kind==="stock"          // islands are never sold, so never parked
               &&(!useCayman||r.roi>caymanRoi)   // Cayman beats a weak park, with no fee
               &&r.days>0&&dailyReturn(r)>0&&r.cost<target.cost)
      .map(r=>{
        const need=Math.max(0,r.cost-cash);
        const tAfford=need<=0?0:(inc>0?need/inc:Infinity);
        if(!isFinite(tAfford)||tAfford>=wait) return null;
        const hold=wait-tAfford;
        const perCycle=r.annual*r.days/365;
        const cycles=Math.floor(hold/r.days);
        return {row:r,net:cycles*perCycle-r.cost*SELL_FEE};
      })
      .filter(c=>c&&c.net>0)
      .sort((a,b)=>b.net-a.net)[0];
  };

  // Dead capital goes first. Anything already held that earns less than the
  // weakest investment the plan would still choose to buy is worth less than
  // what that money could be doing, so it is sold up front to fund the rest.
  // Holdings with no measurable return are left alone (their worth isn't in
  // this model) and islands are never sold.
  function sellDeadWeight(){
    // Judged against the first blocks the plan means to buy, not their
    // increments: a deep increment's thin return would drag the bar so low
    // that nothing ever looked inefficient.
    const wanted=targets.filter(t=>!owned.has(rowKey(t))&&(t.block||1)===1
                                 &&t.roi!=null&&isFinite(t.roi)&&t.roi>0)
                        .map(t=>t.roi);
    let bar=wanted.length?Math.min(...wanted):0;
    // Cayman is the only rate that can raise the bar, for the same reason it
    // is the only passive floor: it takes any amount, at any time. The City
    // Bank is capped and locks for a term, so it cannot absorb the proceeds of
    // a sale on demand and must not be used to judge a holding as dead weight.
    if(useCayman&&isFinite(caymanRoi)) bar=Math.max(bar,caymanRoi);
    seeded.filter(r=>r.kind==="stock"&&r.roi!=null&&isFinite(r.roi)&&r.roi<bar)
          .forEach(r=>{
      const proceeds=r.cost*(1-SELL_FEE);
      cash+=proceeds;
      potCredit("sale",proceeds);
      owned.delete(rowKey(r));
      const i=held.findIndex(h=>rowKey(h.row)===rowKey(r));
      if(i>=0) held.splice(i,1);
      steps.push({row:r,day:0,sold:[],unreachable:false,parking:false,depth:0,
                  parentOcc:null,occId:`sell${steps.length}`,sellHolding:true,sellFirst:true,
                  bankNote:`Sell · frees ${moneyShort(proceeds)} toward better investments`});
    });
  }

  // Buy `target`, parking spare capital along the way. Parking purchases are
  // acquired by this same routine, so a stock bought to fund a parking buy is
  // planned exactly like any other purchase. Nesting falls out of that.
  let acquireId=0;
  function acquire(target,parentOcc,depth){
    if(steps.length>=PLAN_MAX_ACTIONS){outOfRoom=true;return false}
    const occ=`acq${acquireId++}`;
    let guard=0;
    while(guard++<8){
      const wait=waitFor(target,occ);
      if(!isFinite(wait)||wait<=0) break;
      const pick=bestParking(target,wait,occ);
      if(!pick) break;
      // Buying the parking stock is itself a purchase, so plan it the same way.
      // It lands in `held` unassigned; claim it for this target.
      if(!acquire(pick.row,occ,depth+1)) return false;
      const h=held[held.length-1];
      if(h&&rowKey(h.row)===rowKey(pick.row)){h.forOcc=occ;h.net=pick.net}
    }
    const wait=waitFor(target,occ);
    if(!isFinite(wait)||day+wait>PLAN_MAX_DAYS){
      // Anything bought to fund this one is kept rather than left promised to
      // a purchase that will never happen.
      heldFor(occ).forEach(h=>{h.forOcc=null});
      steps.push({row:target,day:null,unreachable:true,sold:[],parking:depth>0,parentOcc,depth});
      return false;
    }
    const advance=span=>{ day+=span; accrue(span,true); creditMaturedBank() };
    advance(wait);
    // A projection that lands short would buy on money that isn't there, so
    // the difference is waited out before anything is spent.
    let top=0;
    while(top++<4){
      const need=target.cost-resaleOf(heldFor(occ));
      if(cash>=need-1) break;
      const extra=saveTime(need,cash);
      if(!isFinite(extra)||extra<=0) break;
      if(day+extra>PLAN_MAX_DAYS){
        heldFor(occ).forEach(h=>{h.forOcc=null});
        steps.push({row:target,day:null,unreachable:true,sold:[],parking:depth>0,parentOcc,depth});
        return false;
      }
      advance(extra);
    }
    // Liquidate what was bought to fund this, then buy it. The payouts it
    // made while held are already in `cash`: a parked stock sits in `held`,
    // so income() has been counting its return every day it was there.
    const sold=heldFor(occ);
    sold.forEach(h=>{
      cash+=h.row.cost*(1-SELL_FEE);
      potCredit("sale",h.row.cost*(1-SELL_FEE));
      held.splice(held.indexOf(h),1);
      owned.delete(rowKey(h.row));
    });
    const paidWith=potSpend(target.cost);
    cash-=target.cost;
    owned.add(rowKey(target));
    if(target.ticker==="TCI"&&/ - Passive$/.test(target.name||"")) tciPassiveHeld=true;
    held.push({row:target,forOcc:null,net:0});
    steps.push({row:target,day,sold:sold.map(h=>h.row),unreachable:false,
                parking:depth>0,occId:occ,parentOcc,depth,paidWith});
    return true;
  }

  /** Sells `h` from what is held and returns what the sale raised. */
  const sellHeld=h=>{
    const proceeds=h.row.cost*(1-SELL_FEE);
    cash+=proceeds;
    potCredit("sale",proceeds);
    held.splice(held.indexOf(h),1);
    owned.delete(rowKey(h.row));
    return proceeds;
  };
  let parkPool=null;
  /** Returns the stocks that can be parked in while the bank is locked. */
  const bankParkPool=()=>parkPool||(parkPool=planCandidates()
    .filter(r=>r.kind==="stock"&&r.ticker!=="TCI"&&!isFlexibleStock(r)
             &&r.days>0&&dailyReturn(r)>0&&(!useCayman||r.roi>caymanRoi)));
  /** Returns the best rate the income from one term of `o` could be parked at. */
  const idleParkRate=o=>{
    const inc=income(),fits=bankParkPool()
      .filter(r=>!owned.has(rowKey(r))&&r.cost<=inc*o.days/2&&r.days<=o.days/2);
    return fits.length?Math.max(...fits.map(r=>r.roi)):0;
  };
  /** Buys stocks that pay out within `span` days, to be sold into the bank when it opens. */
  let parkSeq=0;
  const parkUntilBank=(span,fund)=>{
    const cands=bankParkPool()
      .filter(r=>r.kind==="stock"&&r.ticker!=="TCI"&&!isFlexibleStock(r)
               &&!owned.has(rowKey(r))&&r.days>0&&r.days<=span&&dailyReturn(r)>0
               &&(!useCayman||r.roi>caymanRoi))
      .map(r=>({row:r,net:Math.floor(span/r.days)*r.annual*r.days/365-r.cost*SELL_FEE}))
      .filter(c=>c.net>0);
    const pick=list=>{
      const keys=new Set(owned),out=[];
      let left=cash,net=0;
      for(const c of list){
        const r=c.row;
        if(r.cost>left||keys.has(rowKey(r))) continue;
        if((r.block||1)>1&&!keys.has(rowKey({...r,block:r.block-1}))) continue;
        keys.add(rowKey(r)); out.push(c); left-=r.cost; net+=c.net;
      }
      return {out,net};
    };
    const byRate=pick([...cands].sort((x,y)=>y.net/y.row.cost-x.net/x.row.cost));
    const byNet=pick([...cands].sort((x,y)=>y.net-x.net));
    for(const c of (byNet.net>byRate.net?byNet:byRate).out){
      const r=c.row;
      if(steps.length>=PLAN_MAX_ACTIONS){outOfRoom=true;return false}
      const paidWith=potSpend(r.cost);
      cash-=r.cost;
      owned.add(rowKey(r));
      const step={row:r,day,sold:[],unreachable:false,parking:true,depth:1,parentOcc:fund,
                  occId:`bankpark${parkSeq++}`,paidWith,parkForBank:true};
      held.push({row:r,forOcc:fund,net:c.net,step});
      steps.push(step);
    }
    return true;
  };
  /** Turns a stock parked for the bank into an ordinary holding. */
  const keepParked=h=>{
    h.forOcc=null;
    if(h.step){ h.step.parking=false; h.step.parentOcc=null; h.step.depth=0; h.step.parkForBank=false }
  };
  /** Sells what was parked for `fund`, weakest first, until the bank's free room is covered. */
  const settleParking=fund=>{
    const room=Math.max(0,bankCap-bankHeld);
    const sold=[];
    held.filter(h=>h.forOcc===fund).sort((x,y)=>x.row.roi-y.row.roi).forEach(h=>{
      if(cash<room){ sellHeld(h); sold.push(h.row) }
      else keepParked(h);
    });
    return sold;
  };
  /** Sells holdings that earn less than `rate`, weakest first, until the bank's free room is covered. */
  const sellIntoBank=rate=>{
    const room=Math.max(0,bankCap-bankHeld);
    const sold=[];
    held.filter(h=>!h.forOcc&&h.row.kind==="stock"&&h.row.ticker!=="TCI"&&!isFlexibleStock(h.row)
                   &&h.row.roi!=null&&isFinite(h.row.roi)&&h.row.roi<rate)
        .sort((x,y)=>x.row.roi-y.row.roi)
        .forEach(h=>{ if(cash<room){ sellHeld(h); sold.push(h.row) } });
    return sold;
  };

  /** Fills City Bank to its cap, choosing each term by what it leaves after a year. */
  let fundSeq=0;
  function runCityBank(){
    if(!bankRowAt(day)||bankHeld>=bankCap) return true;
    const waitOut=(days,interest)=>{
      if(!(days>0)) days=1;
      if(day+days>PLAN_MAX_DAYS){outOfRoom=true;return false}
      day+=days;
      accrue(days,false);
      cash+=interest||0;
      potCredit("bank",interest||0);
      creditMaturedBank();
      return true;
    };
    let fundOcc=null,soldForDeposit=[];
    // Do not lower: a fill runs for as many terms as the cap takes.
    let guard=0;
    while(bankHeld<bankCap&&guard++<PLAN_MAX_ACTIONS){
      if(steps.length>=PLAN_MAX_ACTIONS){outOfRoom=true;return false}
      const bankRow=bankRowAt(day);
      if(!bankRow) break;
      creditMaturedBank();
      if(pendingBank){
        const until=pendingBank.day-day;
        fundOcc=`bankfund${fundSeq++}`;
        if(!parkUntilBank(until,fundOcc)) return false;
        if(!waitOut(until,0)) return false;
        soldForDeposit=settleParking(fundOcc);
        continue;
      }
      soldForDeposit=soldForDeposit.concat(sellIntoBank(bankRow.roi));
      const fillRow=richestFillOption(isNewbie?bankOptionsAt(day):cityBankTerms(),
                                      cash,income(),bankHeld,bankCap,idleParkRate)||bankRow;
      // TCI Active: worth a week of the deposit sitting out of the bank only
      // when the 10% it adds over the term beats that wait plus the sale fee.
      if(tciActive&&tciRow&&!tciHeld&&cash>tciRow.cost){
        const projected=Math.min(bankCap,bankHeld+cash-tciRow.cost);
        const willCap=projected>=bankCap;
        const termRow=willCap?bankRow:fillRow;
        const base=(!isNewbie&&boolVal("tciOwned"))?termRow.roi/1.10:termRow.roi;
        // A capped deposit keeps its rate indefinitely, so value the bonus
        // over a year there, and over a single term while still filling.
        const horizon=willCap?365:termRow.days;
        const gain=projected*base*0.10*(horizon/365);
        const waitCost=projected*base*(TCI_ACTIVATION_DAYS/365);
        if(projected>bankHeld&&gain>waitCost+tciRow.cost*SELL_FEE){
          if(day+TCI_ACTIVATION_DAYS>PLAN_MAX_DAYS){outOfRoom=true;return false}
          const paidWith=potSpend(tciRow.cost);
          cash-=tciRow.cost;
          tciHeld=true;
          steps.push({row:tciRow,day,sold:[],unreachable:false,parking:false,depth:0,
                      parentOcc:null,occId:`tci${steps.length}`,tciWindow:true,paidWith,
                      bankNote:`Held ${TCI_ACTIVATION_DAYS} days to lock in the bonus rate`});
          day+=TCI_ACTIVATION_DAYS;
          accrue(TCI_ACTIVATION_DAYS,false);
          creditMaturedBank();
        }
      }
      const deposit=Math.min(bankCap,bankHeld+cash);
      const added=deposit-bankHeld;
      // Nothing to put in yet: let income build rather than abandoning the fill.
      if(added<=0){
        if(income()<=0) break;
        if(!waitOut(1,0)) return false;
        continue;
      }
      const paidWith=potSpend(added);
      cash-=added;
      bankHeld=deposit;
      const usingRow=deposit>=bankCap?bankRow:fillRow;
      // The newbie helpers return plain {days,roi} options rather than full
      // rows off `rows`, so build the row shape the renderer expects.
      const usingRoi=bankRoiFor(usingRow);
      const usingRowFull=usingRow.name?usingRow:{
        kind:"bank",ticker:"BANK",name:`City Bank – ${bankTermLabel(usingRow.days)}`,bank:true,
        days:usingRow.days,roi:usingRoi,annual:bankDepositValue()*usingRoi};
      // Return on everything the deposit now holds, not just this top-up:
      // the whole balance earns the rate from here on.
      steps.push({row:{...usingRowFull,cost:added,roi:usingRoi,annual:deposit*usingRoi},day,
                  sold:soldForDeposit,unreachable:false,
                  parking:false,depth:0,parentOcc:null,paidWith,bankBalance:deposit,
                  occId:fundOcc||`bank${steps.length}`,cityBank:true,
                  bankNote:(deposit>=bankCap
                    ? `At maximum, ${moneyShort(deposit)} held on the ${bankTermLabel(bankRow.days)} term`
                    : `Locked ${bankTermLabel(fillRow.days)}, ${moneyShort(deposit)} held`)
                    +(tciHeld?" · TCI bonus rate":"")});
      fundOcc=null; soldForDeposit=[];
      // The rate is locked in now, so the block has done its job.
      if(tciHeld&&tciRow){
        const proceeds=tciRow.cost*(1-SELL_FEE);
        cash+=proceeds;
        potCredit("sale",proceeds);
        tciHeld=false;
        steps.push({row:tciRow,day,sold:[],unreachable:false,parking:false,depth:0,
                    parentOcc:null,occId:`tcisell${steps.length}`,sellHolding:true,
                    bankNote:`Sold · rate locked, ${moneyShort(proceeds)} freed up`});
      }
      if(deposit>=bankCap) break;
      fundOcc=`bankfund${fundSeq++}`;
      let left=fillRow.days;
      while(left>0){
        const span=Math.min(PARK_CHECK_DAYS,left);
        if(!waitOut(span,0)) return false;
        left-=span;
        if(left>0&&!parkUntilBank(left,fundOcc)) return false;
      }
      const interest=deposit*usingRoi*fillRow.days/365;
      cash+=interest;
      potCredit("bank",interest);
      soldForDeposit=settleParking(fundOcc);
    }
    if(fundOcc) held.filter(h=>h.forOcc===fundOcc).forEach(keepParked);
    return true;
  }

  creditMaturedBank();          // a term that is already up pays out at once
  sellDeadWeight();
  // A stock pinned as the highest priority is what the plan is for, so it goes
  // ahead of the bank. The dud is pinned to the back and never counts.
  const pinnedGoal=row=>row.kind==="stock"&&row.ticker!==DUD_TICKER
                      &&!!window.pinnedStocks?.has(row.ticker);
  const runTarget=target=>{
    if(steps.length>=PLAN_MAX_ACTIONS){outOfRoom=true;return false}
    if(owned.has(rowKey(target))) return true;
    // Once this target no longer beats the bank, the bank comes first.
    const curBankRow=bankRowAt(day);
    if(curBankRow&&bankHeld<bankCap&&!pinnedGoal(target)
       &&(target.roi==null||target.roi<=curBankRow.roi)){
      if(!runCityBank()) return false;
      // Do not remove: a stock parked for the bank can be kept as this target.
      if(owned.has(rowKey(target))) return true;
    }
    return acquire(target,null,0);
  };
  // A prioritised WSU keeps its place only while it still has courses to
  // shorten. Reached after that, it goes to the back of the queue instead.
  const tail=[];
  for(const target of targets){
    if(target.ticker==="WSU"&&prio.has("WSU")&&day>=eduDoneDay){ tail.push(target); continue }
    // A target that can't be reached is noted and stepped over; only running
    // out of simulation stops the plan.
    if(!runTarget(target)&&outOfRoom) break;
  }
  // Demoted targets are bought last, cheapest first, exactly like the no-ROI
  // stocks that were never ticked.
  if(!outOfRoom) for(const target of tail.sort((a,b)=>a.cost-b.cost)){
    if(!runTarget(target)&&outOfRoom) break;
  }
  // With the buying done, wait out any term still running so the money it
  // returns can be put to work rather than being left off the end of the plan.
  if(pendingBank&&!outOfRoom){ day=Math.max(day,pendingBank.day); creditMaturedBank(); }
  // Anything still uninvested belongs in the bank.
  if(bankRowAt(day)&&bankHeld<bankCap&&!outOfRoom) runCityBank();
  // A "sell this first" step exists only to fund the next purchase, so it
  // hangs off that purchase: it indents underneath and folds away once that
  // investment is ticked off, like the parking steps do.
  const firstBuy=steps.find(x=>!x.sellFirst&&x.occId);
  if(firstBuy) steps.forEach(x=>{
    // One level deeper than whatever it's funding, which may itself be a
    // parking buy nested under something else.
    if(x.sellFirst&&!x.parentOcc){ x.parentOcc=firstBuy.occId; x.depth=(firstBuy.depth||0)+1 }
  });
  // With everything bought, spare capital has nowhere better to go.
  if(useCayman&&caymanRow&&!outOfRoom){
    steps.push({row:{...caymanRow,cost:Math.max(0,cash),annual:Math.max(0,cash)*(caymanRow.roi||0)},day,sold:[],
                unreachable:false,parking:false,depth:0,parentOcc:null,
                occId:"cayman-final",finalCayman:true});
  }
  return {steps,truncated:outOfRoom};
}

// ---- rendering ------------------------------------------------------

// Which benefit block this step buys. Stocks that only ever have one show a
// dash; anything that is not a stock has no block concept at all.
function incrementCell(r){
  if(r.kind!=="stock") return "∞";
  if(SINGLE_BLOCK_TICKERS.includes(r.ticker)) return "—";
  return r.block||1;
}
// "Torn City Times B2". Which increment is being sold matters as much as which
// stock: a plan can hold B1 and sell B2, so the name alone is ambiguous.
// Single-block stocks and non-stocks have nothing to disambiguate.
function sellLabelPlain(r){
  const suffix=(r.kind==="stock"&&!SINGLE_BLOCK_TICKERS.includes(r.ticker)&&r.block)
    ? " B"+r.block : "";
  return r.name+suffix;
}
function sellLabel(r){ return esc(sellLabelPlain(r)) }

// ---- plan paging ----------------------------------------------------
window.planPage=window.planPage||1;
function planPageSize(){
  const n=+($("planPageSize")?.value||20);
  return [20,50,100,500].includes(n)?n:20;
}
// Which page numbers to show: always the first and last, plus a window
// around the current one, with gaps marked by an ellipsis.
function pageButtons(count,cur){
  if(count<=9) return Array.from({length:count},(_,i)=>i+1);
  const want=new Set([1,count,cur]);
  for(let d=1;d<=2;d++){ want.add(cur-d); want.add(cur+d) }
  const list=[...want].filter(n=>n>=1&&n<=count).sort((a,b)=>a-b);
  const out=[];
  list.forEach((n,i)=>{
    if(i&&n-list[i-1]>1) out.push("gap");
    out.push(n);
  });
  return out;
}
function renderPlanNav(count,cur,total){
  const html=count<=1&&total<=planPageSize()
    ? `<button type="button" class="pg-current" data-action="current">Jump to current step</button>`
    : [
        `<button type="button" class="pg-arrow" data-page="${cur-1}"${cur<=1?" disabled":""} aria-label="Previous page">‹</button>`,
        ...pageButtons(count,cur).map(n=>n==="gap"
          ? `<span class="pg-gap">…</span>`
          : `<button type="button" class="pg-num${n===cur?" is-current":""}" data-page="${n}">${n}</button>`),
        `<button type="button" class="pg-arrow" data-page="${cur+1}"${cur>=count?" disabled":""} aria-label="Next page">›</button>`,
        `<span class="pg-jump">Page <input type="number" class="pg-input" min="1" max="${count}" value="${cur}" aria-label="Go to page"> of ${count}</span>`,
        `<button type="button" class="pg-current" data-action="current">Jump to current step</button>`
      ].join("");
  ["planNavTop","planNavBottom"].forEach(id=>{ const el=$(id); if(el) el.innerHTML=html });
}
function goToPlanPage(n){
  const count=window.planPageCount||1;
  const page=Math.max(1,Math.min(count,Math.round(+n||1)));
  if(page===window.planPage) return page;
  window.planPage=page;
  renderPlan();
  return page;
}
// Scrolls to a step and gives it a brief amber outline, switching pages first
// if it isn't on the one being shown.
function jumpToPlanStep(occ){
  if(!occ) return;
  const idx=(window.planStepOrder||[]).indexOf(occ);
  const target=idx>=0?(window.planPageOf||[])[idx]:null;
  if(target&&target!==window.planPage){ window.planPage=target; renderPlan(); }
  const tr=document.querySelector(`#tbodyPlan tr[data-occ="${CSS.escape(occ)}"]`);
  if(!tr) return;
  // A folded ancestor would leave the row hidden, so open the way down to it.
  if(tr.hidden){
    let guard=0;
    while(tr.hidden&&guard++<20){
      const step=(window.planStepIndex||{})[occ];
      let g=step?step.group:null, opened=false;
      while(g){
        if(window.planCollapsed.has(g)||!window.planExpanded.has(g)){
          window.planCollapsed.delete(g); window.planExpanded.add(g); opened=true;
        }
        const parent=(window.planStepIndex||{})[g];
        g=parent?parent.group:null;
      }
      if(!opened) break;
      renderPlan();
      break;
    }
  }
  const row=document.querySelector(`#tbodyPlan tr[data-occ="${CSS.escape(occ)}"]`);
  if(!row) return;
  row.scrollIntoView({behavior:"smooth",block:"center"});
  row.classList.add("plan-jump");
  setTimeout(()=>row.classList.remove("plan-jump"),1600);
}
function renderPlan(){
  if(!$("tbodyPlan")) return;
  syncPlanFields();
  updateGoalDesc();
  const body=$("tbodyPlan"), sum=$("planSummary"), note=$("planNote");
  // No plan has been built yet (or the tables have nothing to build one from),
  // so the table stays empty until the button is pressed. This is the whole
  // point of the change: nothing here re-runs the simulation on its own.
  if(!rows.length||!window.planResult){
    window.planStepOrder=[]; window.planStepIndex={};
    paintTotals("tbodyTotalsPlan","totalReturnHeaderPlan",planPeriod(),true);
    body.innerHTML=""; sum.innerHTML="";
    ["planNavTop","planNavBottom"].forEach(id=>{ const el=$(id); if(el) el.innerHTML="" });
    const fb=$("planFoldAll");
    if(fb) fb.hidden=true;
    note.textContent=rows.length
      ? ($("planGoal")?.value==="selected"&&!window.selectedRows.size
          ? "Nothing ticked yet. Tick what you are aiming for in the Plan column of the Investments table, then build the plan."
          : "Press Show Me The Money above to build a plan from your current settings")
      : "";
    return;
  }
  const {steps,truncated}=window.planResult;
  // Number each repeat of the same investment so occurrences stay distinct.
  const seen={};
  steps.forEach(s=>{
    const k=rowKey(s.row);
    seen[k]=(seen[k]||0)+1;
    s.occ=`${k}#${seen[k]}`;
    s.occIndex=seen[k];
    // Completion is read back from planDone every render, so unticking a step
    // clears it again. The steps themselves now outlive a single render.
    s.done=window.planDone.has(s.occ);
  });
  // Each step knows which acquisition it was bought to fund, so groups nest.
  const byId={};
  steps.forEach(s=>{ if(s.occId) byId[s.occId]=s; });
  steps.forEach(s=>{
    const parent=s.parentOcc?byId[s.parentOcc]:null;
    s.group=parent?parent.occ:null;
    s.depth=s.depth||0;
  });
  steps.forEach(s=>{
    s.groupSize=steps.filter(x=>x.group===s.occ).length;
    const parent=s.group?steps.find(x=>x.occ===s.group):null;
    s.parentName=parent?parent.row.name:null;
  });
  // Lookups the paging and jump controls work from.
  window.planStepOrder=steps.map(s=>s.occ);
  window.planStepIndex=Object.fromEntries(steps.map(s=>[s.occ,s]));
  const pending=steps.filter(s=>!s.done);
  const next=steps.find(s=>!s.unreachable&&!s.done);
  window.planNextOcc=next?next.occ:null;
  // The goal is what you are saving toward now: the first thing still to buy.
  // The next purchase may be something cheaper bought to earn while you save.
  // A sale isn't a goal, it's a step toward one, so it's skipped here and
  // picked up by the chain below as a child of whatever it funds.
  const goalStep=pending.find(s=>!s.parking&&!s.sellHolding&&!s.unreachable)||null;
  // Walk down from the goal through the parking that must be bought to reach
  // it, so each nesting level gets its own marker.
  const chain=new Map();
  if(goalStep){
    let node=goalStep,level=0;
    while(node){
      chain.set(node.occ,level++);
      node=steps.find(x=>!x.done&&x.group===node.occ)||null;
    }
  }
  // Something owned that ranks below the goal is only worth holding if it will
  // pay out enough before the goal to beat the fee for selling it. If it will
  // not, it is dead capital and should go now.
  const goalRow=goalStep?goalStep.row:null;
  const nextStep=pending.length?pending[0]:null;
  const nextRow=nextStep?nextStep.row:null;
  const parked=nextStep&&nextStep.parking?nextStep.row:null;
  const nextIsSell=!!(nextStep&&nextStep.sellHolding);

  sum.innerHTML=`<div class="plan-cards">
    <div class="plan-card"><div class="pc-label">Current goal</div><div class="pc-value">${goalRow?esc(goalRow.name):"—"}</div><div class="pc-sub">${goalRow?moneyShort(goalRow.cost):""}</div></div>
    <div class="plan-card${nextIsSell?" pc-sell":""}"><div class="pc-label">Next purchase</div><div class="pc-value">${nextRow?esc(nextRow.name):"—"}</div>${nextIsSell?`<div class="pc-warn">Sell this investment</div>`:""}<div class="pc-sub">${nextRow
      ?(nextIsSell
        ? `frees ${moneyShort(nextRow.cost*(1-SELL_FEE))}${next&&next.day===0?" · now":next?" · in "+formatDuration(Math.ceil(next.day)):""}`
        : moneyShort(nextRow.cost)+(parked?" · hold while saving":(next&&next.day===0?" · affordable now":next?" · in "+formatDuration(Math.ceil(next.day)):"")))
      :""}</div></div>
  </div>`;

  const doneByOcc=new Set(steps.filter(x=>x.done).map(x=>x.occ));
  // Anything ticked that sits beyond the goal you are working toward was bought
  // ahead of schedule: that capital belongs in the goal instead. Only the exact
  // occurrence is flagged, never a later repeat of the same investment.
  const sellNow=new Set();
  const goalAt=goalStep?steps.indexOf(goalStep):-1;
  if(goalAt>=0) steps.forEach((s,i)=>{ if(i>goalAt&&s.done) sellNow.add(s.occ) });
  // ---- paging ----------------------------------------------------
  // Pages are filled a chain at a time, so the parking bought to fund a
  // purchase never lands on a different page from the purchase itself.
  const pageSize=planPageSize();
  const pageOf=[];
  let pageNo=1,onPage=0,block=[];
  const placeBlock=()=>{
    if(!block.length) return;
    if(onPage&&onPage+block.length>pageSize){pageNo++;onPage=0}
    block.forEach(idx=>{pageOf[idx]=pageNo});
    onPage+=block.length;
    block=[];
  };
  steps.forEach((s,i)=>{
    block.push(i);
    if(!s.group) placeBlock();          // a root step closes its chain
  });
  placeBlock();
  const pageCount=Math.max(1,pageNo);
  if(window.planPage>pageCount) window.planPage=pageCount;
  if(!(window.planPage>=1)) window.planPage=1;
  const page=window.planPage;
  window.planPageOf=pageOf;
  window.planPageCount=pageCount;
  renderPlanNav(pageCount,page,steps.length);

  body.innerHTML=steps.map((s,i)=>({s,i})).filter(x=>pageOf[x.i]===page).map(({s,i})=>{
    // The amber outline marks the goal you are working toward, not the next
    // step, which is often just something parked along the way.
    const isNext=chain.has(s.occ);
    const nxLevel=chain.get(s.occ)||0;
    const sold=s.sold.length?s.sold.map(sellLabel).join(", "):"—";
    const when=s.done?"owned":(s.unreachable?"beyond 100 years":(s.day===0?"now":formatDuration(Math.ceil(s.day))));
    // Two different reds: a step bought out of order stays flagged, but a
    // sale that's been carried out is just a completed step like any other.
    const outOfOrder=sellNow.has(s.occ);
    const dump=outOfOrder||(!!s.sellHolding&&!s.done);
    // Groups are open by default and fold once their acquisition is done,
    // unless the user has said otherwise for that group.
    const groupOpen=k=>window.planExpanded.has(k)
      ? true
      : (window.planCollapsed.has(k) ? false : !doneByOcc.has(k));
    const open=s.groupSize?groupOpen(s.occ):false;
    // Hidden if any ancestor group is folded.
    let hidden=false;
    for(let g=s.group;g;){
      if(!groupOpen(g)){hidden=true;break}
      const parent=steps.find(x=>x.occ===g);
      g=parent?parent.group:null;
    }
    return `<tr data-key="${rowKey(s.row)}" data-occ="${s.occ}"${hidden?" hidden":""}${isNext?` style="--nx:${Math.max(0.3,1-nxLevel*0.22).toFixed(2)}"`:""} class="${isNext?"plan-next":""}${s.done&&!outOfOrder?" plan-done":""}${s.parking?" plan-parking":""}${dump?" plan-sell":""}">
<td>${s.done&&!outOfOrder?'<span class="step-tick">✓</span> ':''}${i+1}</td>
<td style="padding-left:${10+(s.depth||0)*18}px;--rails:${s.depth||1}">${s.groupSize?`<button type="button" class="grp-toggle" data-grp="${s.occ}"><span class="grp-caret">${open?"▴":"▸"}</span> ${s.groupSize} step${s.groupSize===1?"":"s"} first</button>`:""}<span class="ticker">${s.row.ticker}</span> <strong>${esc(s.row.name)}</strong>${s.sellFirst?`<div class="sub">Sell to help fund ${esc(s.parentName||"your next purchase")}</div>`
  :s.sellHolding?""
  :dump?`<div class="sub">Sell now and put it toward ${esc(goalRow?goalRow.name:"your goal")}</div>`:(s.parkForBank?`<div class="sub">Bought to earn until the bank term ends, then sold into the bank</div>`
  :s.parking?`<div class="sub">Bought to earn while saving for ${esc(s.parentName||"the next purchase")}</div>`:"")}</td>
<td>${incrementCell(s.row)}</td>
<td class="benefit-cell">${s.bankNote?esc(s.bankNote)+(s.sold.length?" · "+sold:""):sold}</td>
<td>${moneyShort(s.row.cost)}</td>
<td class="paid-cell">${paidWithCell(s.paidWith)}</td>
<td>${moneyShort(planReturnValue(s.row))}</td>
<td class="${s.row.roi!=null?(s.row.roi>=0?'good':'bad'):''}">${pct(s.row.roi)}</td>
<td>${when}</td>
</tr>`;
  }).join("");

  // The button offers whichever action affects more groups.
  // Every group in the plan, at any nesting depth, so folding covers them all.
  const groups=steps.filter(x=>x.groupSize).map(x=>x.occ);
  window.planGroups=groups;
  const openCount=groups.filter(k=>window.planExpanded.has(k)
    ||(!window.planCollapsed.has(k)&&!doneByOcc.has(k))).length;
  const foldBtn=$("planFoldAll");
  if(foldBtn){
    foldBtn.hidden=!groups.length;
    foldBtn.textContent=openCount>0?"Collapse all":"Expand all";
    foldBtn.dataset.action=openCount>0?"collapse":"expand";
  }
  const basis=`Assumes prices hold, a ${(SELL_FEE*100).toFixed(1)}% cost to sell a stock block, and that returns from what you buy are reinvested.`;
  const range=steps.length
    ? `${steps.length} step${steps.length===1?"":"s"} in this plan${pageCount>1?` · page ${page} of ${pageCount}`:""}. `
    : "";
  const missed=steps.filter(s=>s.unreachable).length;
  const skipped=missed?`${missed} investment${missed===1?" is":"s are"} further off than the 100 years the planner models, and ${missed===1?"was":"were"} stepped over. `:"";
  note.textContent=(truncated?`Plan stopped at ${steps.length} steps. It needs more than the planner will model. `:range)+skipped+basis;
  paintTotals("tbodyTotalsPlan","totalReturnHeaderPlan",planPeriod(),true);
}

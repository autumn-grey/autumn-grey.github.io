// ======================================================================
// ROW BUILDERS  ·  Turn stocks, banks and islands into table rows
// ======================================================================
// The five City Bank terms, each priced off the configured deposit.
function bankRows(){
  const meritBonus=+($("merits").value||0)*0.05;
  const tci=boolVal("tciOwned");
  const dep=bankDepositValue();
  return Object.entries(BANK_TERMS).map(([days,key])=>{
    const base=+(rates[key]||0)/100;
    // Oil Mogul doesn't raise the interest, it shortens the wait for it. The
    // same payout over fewer days is a higher annualised return, so it lands
    // as a multiplier on the APR.
    const timeFactor=bankTimeFactor();
    const aprNoTime=base*(1+meritBonus)*(tci?1.10:1);
    const apr=aprNoTime*timeFactor;
    const meritPct=base*meritBonus*100;
    const tciPct=(base*(1+meritBonus)*(tci?0.10:0))*100;
    const parts=[`${(base*100).toFixed(2)}% base APR`];
    if(meritPct>0) parts.push(`${meritPct.toFixed(2)}% from merits`);
    if(tciPct>0) parts.push(`${tciPct.toFixed(2)}% from TCI`);
    if(timeFactor>1) parts.push(`${((apr-aprNoTime)*100).toFixed(2)}% from Oil Mogul`
      +` (${(+days)} days in ${bankTermRealDays(+days).toFixed(1)})`);
    return {kind:"bank",ticker:"BANK",name:`City Bank – ${bankTermLabel(days)}`,bank:true,benefit:[`${(apr*100).toFixed(2)}% APR`,`${(apr*(+days/365)*100).toFixed(2)}% over ${days} days`],cost:dep,days:+days,annual:dep*apr,roi:apr,ret7:dep*apr*7/365,ret31:dep*apr*31/365,compareTerm:+days,bankApr:apr,desc:parts.join(" + ")};
  });
}
// Every stock row carries the same tag/benefit flags. Building them in one
// place keeps the row-creation sites below in step. Adding a new tag only
// needs changing here.
function stockFlags(ticker,name,block,type,label,qty,days){
  return {
    kind:"stock",ticker,name,block,
    singleBlock:SINGLE_BLOCK_TICKERS.includes(ticker),
    situational:SITUATIONAL_TICKERS.includes(ticker),
    awful:AWFUL_TICKERS.includes(ticker),
    payout:payoutKind(ticker,type),
    booster:BOOSTER_TYPES.includes(type),
    bank:type==="bankbonus",
    benefit:stockBenefitText(ticker,type,label,qty),
    tip:tooltipFor(ticker,type,label,qty,days),
    notes:STOCK_NOTES[ticker]||null
  };
}

// Builds one row per stock benefit block. Each stock type (item, cash,
// booster, points, bank bonus, virus, unresolved) values its benefit
// differently; increments are deferred to incrementRows() below.
function stockRows(){
  const out=[], seeds=[];
  for(const s of STOCKS){
    const [ticker,name,baseB1,type,days,label,qty]=s; const price=prices[ticker];
    const b1=blockShares(ticker,baseB1);
    if(!price) continue;
    if(type==="unresolved") {
      const unresolvedNotes = ticker==="IST"
        ? [`Saves: ${money(remainingCourseCost())}`]
        : ticker==="WSU"
        ? [`${formatDuration(remainingCourseDays()*0.10)} saved`]
        : STOCK_NOTES[ticker] || [label+" · valuation deferred"];
      if(ticker==="ELT") unresolvedNotes[0]="Calculation based on fully upgrading one new PI per year";
      const unresolvedDesc = unresolvedNotes.join(" · ");
      out.push({...stockFlags(ticker,name,1,type,label,qty,days),cost:price*b1,days:0,annual:null,roi:null,ret7:null,ret31:null,notes:unresolvedNotes,desc:unresolvedDesc});
      continue;
    }
    if(type==="bankbonus"){
      // The TCI block adds 10% to the bank rate, applied as the 0.10 factor below.
      const meritBonus=+($("merits").value||0)*0.05;
      const baseRates=Object.entries(BANK_TERMS).map(([d,k])=>({days:+d,rate:+rates[k]||0})).filter(x=>x.rate>0);
      if(!baseRates.length){out.push({...stockFlags(ticker,name,1,type,label,qty,days),cost:price*b1,roi:null,desc:"Needs City Bank rates"});continue}
      // TCI value is based on the increase caused by the block, using each term and the currently best APR.
      const best=baseRates.reduce((a,b)=>a.rate>b.rate?a:b);
      const apr=(best.rate/100)*(1+meritBonus);
      const added=bankDepositValue()*apr*0.10*(best.days/365);
      const annual=added*365/best.days;
      const blockCost=price*b1;
      const shared={...stockFlags(ticker,name,1,type,label,qty,days),days:best.days,annual,ret7:annual*7/365,ret31:annual*31/365};
      // TCI descriptions use raw day counts, since bank terms are fixed-length
      // day periods rather than calendar months.
      const termLabel=best.days+"-day";
      // Passive: block held year-round.
      out.push({...shared,name:name+" - Passive",cost:blockCost,roi:annual/blockCost,
        desc:`Block held year-round. Based on the ${termLabel} term at ${(apr*100).toFixed(2)}% APR`});
      // Active: TCI needs 7 days to activate but only has to be held while the
      // deposit is made, so capital is committed 7 days per deposit cycle.
      const depositsPerYear=365/best.days;
      const daysHeld=7*depositsPerYear;
      // Cost stays the real block price, since you still have to pay it. Only the
      // ROI reflects that the capital is tied up for part of the year.
      const activeCost=blockCost*(daysHeld/365);
      out.push({...shared,name:name+" - Active",cost:blockCost,roi:annual/activeCost,
        desc:`Held 7 days per deposit · ${daysHeld.toFixed(0)} days/year across ${depositsPerYear.toFixed(1)} × ${termLabel} terms. Capital free the rest of the year`});
      continue;
    }
    let benefit=0, desc="";
    if(type==="cash"){
      benefit=qty;
      if(ticker==="YAZ"){
        const d=Math.max(0,Math.min(365,+($("bannerDays")?.value||0)));
        benefit=qty*(d/365);
        desc=`Based on a banner running ${d} day${d===1?"":"s"} per year. Value set in Misc Stuff`;
      }
      if(ticker==="MSG"){
        const ads=Math.max(0,+($("adsPerMonth")?.value||0));
        benefit=qty*ads;
        desc=`Based on ${ads} classified advertisement${ads===1?"":"s"} per month. Value set in Misc Stuff`;
      }
    }
    else if(type==="item"){
      if(ticker==="TCC"){
        const caches=CLOTHING_CACHE_ITEMS.map(n=>items.find(x=>x.name.toLowerCase()===n.toLowerCase())).filter(Boolean);
        if(caches.length){
          const avg=caches.reduce((a,b)=>a+b.market,0)/caches.length;
          benefit=qty*avg;
          desc="";
        }
      } else {
        const it=items.find(x=>x.name.toLowerCase()===label.toLowerCase())||items.find(x=>x.name.toLowerCase().includes(label.toLowerCase()));
        if(it){benefit=qty*it.market}
      }
    }
    else if(type==="points"){
      const pm=(window.pointsMarket||[]).filter(x=>x>0);
      if(pm.length){
        const med=median(pm);
        benefit=qty*med;
        desc=`${qty} points @ median listed price ${money(med)}`;
      }else{
        desc=window.pointsMarketError ? `Needs points market price · ${window.pointsMarketError}` : "Needs points market price";
      }
    }
    else if(type==="virus"){
      const best=bestVirusPerDay();
      if(best){
        benefit=best.perDay;
        const assumed=document.body.classList.contains("basic")
          && !VIRUSES.some(v=>$(v.unlock)?.checked)
          && !CODING_TIME_REDUCTIONS.some(r=>$(r.id)?.checked);
        desc=assumed
          ? "Assumes all virus-related Computer Science courses are complete"
          : "Calculation based on virus courses marked complete in Education Stuff";
      }else{
        desc="Select the Computer Science courses that unlock viruses in Education Stuff";
      }
    }
    else if(type==="other"){
      if(ticker==="HRG"){
        // A property you're given is only worth what you can get back for it,
        // and the estate agents pay 75% of the purchase price, no upgrades.
        const prices=Object.values(propertyPriceTable());
        const avg=prices.reduce((a,b)=>a+b,0)/prices.length;
        benefit=avg*PROPERTY_SELLBACK;
        desc=`Average estate agent sale value of all purchasable properties · ${(PROPERTY_SELLBACK*100).toFixed(0)}% of purchase price, unupgraded`;
      }
      if(ticker==="ELT"){
        const pis=Math.max(0,+($("piPerYear")?.value||0));
        const upgradeTotal=PI_UPGRADE_TOTAL;
        benefit=upgradeTotal*0.10*pis;
        desc=`Calculation based on fully upgrading ${pis} PI${pis===1?"":"s"} per year. Value set in Misc Stuff`;
      }
    }
    else if(type==="happy"||type==="energy"||type==="nerve"){
      const it=selectedStat(type);
      if(it){
        // Variable effects are valued using the midpoint of the displayed range.
        const averageEffect=it.effect.avg;
        benefit=(qty/averageEffect)*it.market;
        desc=`Equivalent to ${qty.toLocaleString()} ${type} using ${it.name}. Item is set in advanced view`;
      }else{
        desc=`Select a ${type} item with a positive measurable API effect`;
      }
    }
    if(!benefit){out.push({...stockFlags(ticker,name,1,type,label,qty,days),cost:price*b1,days,annual:null,roi:null,ret7:null,ret31:null,desc:desc||"No valuation"});continue}
    const annual=benefit*365/days; out.push({...stockFlags(ticker,name,1,type,label,qty,days),cost:price*b1,days,annual,roi:annual/(price*b1),ret7:annual*7/365,ret31:annual*31/365,desc});
    // Stocks with a single benefit block have no purchasable increments.
    if(SINGLE_BLOCK_TICKERS.includes(ticker)) continue;
    // Defer increment generation until every first block is known, which
    // increments are worth showing depends on the whole ranking.
    seeds.push({ticker,name,price,b1,benefit,days,desc,type,label,qty});
  }
  return out.concat(incrementRows(out,seeds));
}

// Which increments to display, per the purchase-sequence model:
//   The sequence works down the ROI ranking. The last first-block you'd ever
//   target is the lowest-ROI one that's still profitable. Call it the final
//   target. So we show:
//     1. every increment ranked at or above the final target's ROI, and
//     2. the increments that would serve as "parking" while saving for it:
//        best ROI first, taken while their combined cost stays under its cost.
function incrementRows(firstBlocks,seeds){
  if(!seeds.length) return [];
  const path=$("incMode")?.value||"everything";
  const incSel=$("incMax")?.value||"optimum";
  // Deprioritised stocks show their first block only, with no increments.
  const depri=deprioritised();
  const capFor=s=>depri.has(s.ticker)?0:Infinity;
  const blocksFor=(s,maxBlock)=>{
    const out=[], annual=s.benefit*365/s.days;
    for(let n=2;n<=maxBlock;n++){
      const cost=s.b1*s.price*Math.pow(2,n-1);
      out.push(incrementRow(s,n,cost,annual/cost,annual));
    }
    return out;
  };

  // Path to 1000E forces Mc Smoogle Corp to B10 regardless of the increment
  // setting, since that is what reaches 1,000 energy.
  const forced=[];
  let workingSeeds=seeds;
  if(path==="path1000e"){
    const mcs=seeds.find(s=>s.ticker==="MCS");
    if(mcs){
      forced.push(...blocksFor(mcs,10));
      workingSeeds=seeds.filter(s=>s.ticker!=="MCS");
    }
  }

  // A specific increment count overrides the path's own selection rules.
  if(incSel!=="optimum"){
    const maxBlock=Math.max(1,Math.min(10,+incSel));
    const out=[...forced];
    for(const s of workingSeeds){
      if(capFor(s)===0) continue;
      out.push(...blocksFor(s,maxBlock));
    }
    return out;
  }

  // Optimum with no strategy has no ranking to work from, so first blocks only.
  if(path==="none") return forced;

  // Optimum: show increments ranked at or above the lowest profitable first
  // block, plus any that could be bought and resold to fund it.
  const positives=firstBlocks.filter(r=>r.block===1&&r.roi!=null&&r.roi>0);
  if(!positives.length) return forced;
  const finalTarget=positives.reduce((a,b)=>a.roi<b.roi?a:b);
  const budget=finalTarget.cost;
  // Cayman takes any amount at a fixed rate, so it is the honest alternative
  // for money that would otherwise sit in an increment. City Bank is not: it
  // is capped and locks for a term, so it can't absorb whatever is left over.
  // The bar is therefore whichever is higher: the weakest first block the plan
  // would still buy, or Cayman. The same bar the planner uses.
  const cayRoi=caymanRow().roi;
  const floorRoi=Math.max(finalTarget.roi,(cayRoi!=null&&isFinite(cayRoi))?cayRoi:-Infinity);

  const pool=[];
  for(const s of workingSeeds){
    if(capFor(s)===0) continue;
    const annual=s.benefit*365/s.days;
    for(let n=2;n<=30;n++){
      const cost=s.b1*s.price*Math.pow(2,n-1);
      const roi=annual/cost;
      if(roi<floorRoi&&cost>budget) break;
      pool.push({seed:s,n,cost,roi,annual});
    }
  }
  pool.sort((a,b)=>b.roi-a.roi);

  const chosen=[];
  let spent=0;
  for(const c of pool){
    if(c.roi>=floorRoi){ chosen.push(c); continue; }
    // Below the floor it has to earn its place twice over: cheap enough to be
    // sold on to fund the final target, and still better than Cayman.
    if(c.roi>cayRoi&&spent+c.cost<budget){ chosen.push(c); spent+=c.cost }
  }
  return forced.concat(chosen.map(({seed:s,n,cost,roi,annual})=>incrementRow(s,n,cost,roi,annual)));
}

function incrementRow(s,n,cost,roi,annual){
  return {
    kind:"stock",ticker:s.ticker,name:s.name,block:n,
    situational:SITUATIONAL_TICKERS.includes(s.ticker),awful:AWFUL_TICKERS.includes(s.ticker),
    payout:payoutKind(s.ticker,s.type),booster:BOOSTER_TYPES.includes(s.type),
    bank:s.type==="bankbonus",benefit:stockBenefitText(s.ticker,s.type,s.label,s.qty),tip:tooltipFor(s.ticker,s.type,s.label,s.qty,s.days),
    notes:STOCK_NOTES[s.ticker]||null,cost,days:s.days,
    annual,roi,ret7:annual*7/365,ret31:annual*31/365,
    desc:s.desc
  };
}
// Is the Law course that discounts property purchases studied?
function propertyLawStudied(){ return !!$(PROPERTY_LAW_COURSE)?.checked }
// What a fully-upgraded Private Island costs, after the two discounts that
// can apply to it: Property Law takes 10% off the purchase price only, an
// owned ELT block takes 10% off the upgrades only.
// Upgrade list price, before any discount. Every Private Island is costed
// fully upgraded, Private Yacht included, so this is simply the whole list.
// Total discount currently applied to upgrades, as a fraction. ELT and
// Interior Connections are 10% each and stack additively.
function piUpgradeDiscount(){
  return (boolVal("eltOwned")?0.10:0)+(boolVal("propertyBroker")?0.10:0);
}
function privateIslandCost(opts={}){
  const law=opts.propertyLaw!==undefined?opts.propertyLaw:propertyLawStudied();
  const elt=opts.elt!==undefined?opts.elt:boolVal("eltOwned");
  // Interior Connections is the same 10% off upgrades that ELT gives, from a
  // 10-star Property Broker instead of a stock block. Torn stacks additively,
  // so holding both is a flat 20% off rather than 19%.
  const broker=opts.broker!==undefined?opts.broker:boolVal("propertyBroker");
  const base=propertyPrice("Private Island")*(law?0.90:1);
  const upgradeDiscount=1-((elt?0.10:0)+(broker?0.10:0));
  const upgrades=PI_UPGRADE_TOTAL*upgradeDiscount;
  const parts=[`${money(base)} island${law?" (Property Law -10%)":""}`,
               `${money(upgrades)} upgrades`];
  return {base,upgrades,total:base+upgrades,note:parts.join(" + ")};
}
// Two ways to value a Private Island: rent it out, or avoid paying rent.
function islandRows(){
  const rent=numVal("piRent"), income=numVal("piIncome");
  const pi=privateIslandCost();
  const piCost=pi.total;
  const note=pi.note;
  return [
    {kind:"island",ticker:"PI OWN",name:"Private Island – owner-occupy",cost:piCost,days:1,annual:rent*365,roi:rent*365/piCost,ret7:rent*7,ret31:rent*31,desc:"Savings from not renting a PI",tip:note},
    {kind:"island",ticker:"PI RENT",name:"Private Island – rent out",cost:piCost,days:1,annual:income*365,roi:income*365/piCost,ret7:income*7,ret31:income*31,desc:"Profit from renting out a PI",tip:note}
  ];
}
// Cayman pays monthly and compounds, so its annual figure is an APY.
function caymanRow(){
  const dep=Math.max(0,numVal("cayman")), faction=1+(+$("cayFaction").value||0)/100, oil=boolVal("oilRig")?1.10:1;
  const monthly=.005*faction*oil;
  // Interest is credited monthly and compounds if left untouched, so the
  // effective annual rate is (1+monthly)^12 - 1, not monthly x 12.
  const apy=Math.pow(1+monthly,12)-1;
  const annual=dep*apy;
  const factionPct=(.005*faction-.005)*100;
  const oilPct=(.005*faction*oil-.005*faction)*100;
  // Only list bonuses the user has actually selected.
  const parts=["+0.50% monthly base"];
  if(factionPct>0) parts.push(`${factionPct.toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}% faction bonus`);
  if(oilPct>0) parts.push(`${oilPct.toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}% Oil Rig: Tax Haven bonus`);
  return {kind:"cayman",ticker:"CAYMAN",name:"Cayman Islands Bank",bank:true,benefit:[`${(apy*100).toFixed(2)}% APY`,`${(monthly*100).toFixed(4).replace(/0+$/,"").replace(/\.$/,"")}% monthly, compounded`],cost:dep,days:30,annual,roi:apy,ret7:annual*7/365,ret31:dep*monthly,desc:parts.join(" + ")};
}
// The two tables each carry their own period picker, so everything that turns
// an annual figure into a displayed one is told which to use.
const PERIOD_LABELS={daily:"Daily",weekly:"Weekly",monthly:"Monthly",annual:"Annual"};
const periodLabel=p=>PERIOD_LABELS[p]||"Weekly";
const tablePeriod=()=>$("returnPeriodTable")?.value||"weekly";
const planPeriod=()=>$("returnPeriodPlan")?.value||"weekly";
function returnPeriodLabel(){ return periodLabel(tablePeriod()) }
function planReturnPeriodLabel(){ return periodLabel(planPeriod()) }

function updateMeritsHelp(){
  const el=$("meritsHelp");
  if(el) el.textContent=`+${(+($("merits")?.value||0))*5}% interest`;
  const cf=$("cayFactionHelp");
  if(cf) cf.textContent=`+${(+($("cayFaction")?.value||0))}% interest`;
  const yh=$("piUpgradeHelp");
  if(yh){
    const list=PI_UPGRADE_TOTAL;
    const cut=piUpgradeDiscount();
    const saving=list*cut;
    // Saving only appears once something is actually taking money off it.
    yh.innerHTML=`PI upgrade cost:<br>${money(list-saving)}`
      +(saving>0?`<br>Saving:<br>${money(saving)}`:"");
  }
  updateJobPointHelp();
  const em=$("eduMeritsHelp");
  if(em) em.textContent=`-${((+($("educationMerits")?.value||0))*EDU_MERIT_REDUCTION*100).toFixed(0)}% course time`;
  const er=$("eduRemainingHelp");
  if(er){
    const left=educationRemainingDays();
    er.textContent=left>0
      ? `${formatDuration(Math.ceil(left))} of study left · WSU stays worth prioritising until then`
      : "Every course studied · WSU has nothing left to shorten";
  }
  const bd=$("bannerDays");
  if(bd&&bd.value!==""&&+bd.value>365) bd.value="365";
}
function updateColumnHeaders(){
  // Headers now carry their own dropdowns, so the selected period is already
  // visible, so there is nothing to rewrite here (rewriting would destroy the selects).
}

// A row's return for whichever period a column is showing.
function periodValue(annual,period){
  if(annual==null) return null;
  if(period==="daily") return annual/365;
  if(period==="weekly") return annual*7/365;
  if(period==="monthly") return annual*31/365;
  return annual;
}
const returnValue=r=>periodValue(r.annual,tablePeriod());
const planReturnValue=r=>periodValue(r.annual,planPeriod());
// Breaks a purchase down by where the money came from, listing only the
// sources that actually paid toward it.
function paidWithCell(split){
  if(!split) return "—";
  const total=PAID_SOURCES.reduce((a,k)=>a+(split[k]||0),0);
  if(!(total>0)) return "—";
  // Under half a percent of the bill is rounding drift, not a contribution.
  const used=PAID_SOURCES.filter(k=>(split[k]||0)/total>=0.005);
  if(!used.length) return "—";
  const shown=used.reduce((a,k)=>a+split[k],0);
  // Largest remainder, so the percentages down the cell always total 100.
  const exact=used.map(k=>split[k]/shown*100);
  const pcts=exact.map(Math.floor);
  let slack=100-pcts.reduce((a,v)=>a+v,0);
  exact.map((v,i)=>[v-pcts[i],i]).sort((a,b)=>b[0]-a[0])
       .forEach(([,i])=>{ if(slack>0){ pcts[i]++; slack-- } });
  return `<div class="paid-with">${used.map((k,i)=>
    `<div class="pw-line"><span class="pw-src pw-${k}">${PAID_LABELS[k]}</span>`
    +`<span class="pw-amt">${moneyShort(split[k])}</span>`
    +`<span class="pw-pct">${pcts[i]}%</span></div>`).join("")}</div>`;
}

const DEPRIORITISE_WEIGHT=0.0001;
// Tickers the user has chosen to rank lower. Displayed figures stay true;
// only ordering and the recommendation use the weighted value.
function prioritised(){
  const set=new Set();
  document.querySelectorAll(".pref-prio").forEach(cb=>{if(cb.checked)set.add(cb.dataset.ticker)});
  return set;
}
// The ranking penalty applies to whatever is left unticked.
function deprioritised(){
  const set=new Set();
  document.querySelectorAll(".pref-prio").forEach(cb=>{if(!cb.checked)set.add(cb.dataset.ticker)});
  return set;
}
function rankRoi(r){
  if(r.roi==null||!isFinite(r.roi)) return r.roi;
  return r.depri?r.roi*DEPRIORITISE_WEIGHT:r.roi;
}

// Rebuilds every row from the current settings, then re-renders. Called on
// any input change, so it must stay cheap.
function calculate(){
  updateColumnHeaders();
  updateMeritsHelp();
  const bank=bankRows(), stocks=stockRows(), others=[...islandRows(),caymanRow()];
  rows=[...stocks,...bank,...others];
  const depri=deprioritised();
  rows.forEach(r=>{r.depri=depri.has(r.ticker)});
  const term=+$("compareTermTable")?.value || 30, b=bank.find(x=>x.days===term);
  rows.forEach(r=>{r.compare=b&&r.cost? (r.annual!=null ? r.annual - b.roi*r.cost : null):null});
  if(window.tableSort){
    const {key,direction}=window.tableSort;
    rows.sort((a,b)=>{
      let av,bv;
      if(key==="investment"){av=String(a.name);bv=String(b.name);return direction*(av.localeCompare(bv));}
      if(key==="cost"){av=a.cost;bv=b.cost;}
      else if(key==="return"){av=returnValue(a);bv=returnValue(b);}
      else if(key==="roi"){av=rankRoi(a);bv=rankRoi(b);}
      else if(key==="breakeven"){av=breakEvenValue(a);bv=breakEvenValue(b);}
      else {av=a.compare;bv=b.compare;}
      if(av==null) av=-Infinity;
      if(bv==null) bv=-Infinity;
      return direction*(av-bv);
    });
  }
  // Anything that rebuilds the rows changes what a plan built from them would
  // say, so an existing plan is flagged as out of date rather than silently
  // rebuilt. Rebuilding is what the button is for.
  refreshPlanPrioritiseText();
  updatePlanBankHelp();       // the rate it quotes moves with the bank settings
  markPlanStale();
  render();
  // Basic Banking shadows these settings, so it follows any that it is still
  // mirroring and redraws off the rates this rebuild just used.
  syncBankingFromAdvanced();
  renderBanking();
}
// ======================================================================
// SELECTION  ·  Owned rows and checkbox selection state
// ======================================================================
// Stable identity for a row, so selections survive re-renders.
function rowKey(r){
  if(r.kind==="stock") return `stock:${r.ticker}:${r.block||1}:${r.name}`;
  if(r.kind==="bank") return `bank:${r.days}`;
  return `${r.kind}:${r.ticker||""}:${r.name||""}`;
}
// Rows that are mutually exclusive: you can only hold one City Bank term at a
// time, and only one TCI strategy (passive or active).
function exclusionGroup(r){
  if(r.kind==="bank") return "bank";
  if(r.ticker==="TCI") return "tci";
  return null;
}
window.selectedRows=window.selectedRows||new Set();
// Investments the user already owns (basic view). Excluded from recommendations.
window.ownedRows=window.ownedRows||new Set();
// Investments deliberately passed over. Kept apart from ownership because they
// answer a different question: not "do I hold this" but "stop suggesting it".
// The planner ignores this set entirely. Skipping mutes a recommendation, it
// does not rewrite your long-term plan.
window.skippedRows=window.skippedRows||new Set();
// Plan steps are tracked per occurrence, not per stock: the same investment can
// appear more than once (bought, sold to fund something, bought again later),
// and each appearance is completed independently.
window.planDone=window.planDone||new Set();
// Groups of parking steps folded away. The current goal stays open by default.
window.planCollapsed=window.planCollapsed||new Set();
window.planExpanded=window.planExpanded||new Set();
// Blocks are cumulative: owning B3 means owning B1 and B2. Marking a block
// marks everything below it; unmarking one unmarks everything above.
function rowState(key){
  if(window.ownedRows.has(key)) return "owned";
  if(window.skippedRows.has(key)) return "skipped";
  return "none";
}
// Increments are bought in order, so a click carries to the blocks that must
// follow from it. Owning B3 means owning B1 and B2, so marking one owned marks
// everything below it. Deciding against B2 rules out B3 and beyond, so both
// skipping and clearing carry upward. Clearing leaves them unbought rather
// than stranded on skip.
function blockPeers(key,dir){
  const row=rows.find(r=>rowKey(r)===key);
  if(!row||!(row.kind==="stock"&&row.block)) return [key];
  return rows.filter(r=>r.kind==="stock"&&r.ticker===row.ticker&&r.name===row.name&&r.block
                      &&(dir==="down"?r.block<=row.block:r.block>=row.block))
             .map(r=>rowKey(r));
}
function setOwned(key,on){
  if(on) blockPeers(key,"down").forEach(k=>{window.ownedRows.add(k);window.skippedRows.delete(k)});
  else blockPeers(key,"up").forEach(k=>window.ownedRows.delete(k));
}
function setSkipped(key,on){
  blockPeers(key,"up").forEach(k=>{
    if(on){ window.skippedRows.add(k); window.ownedRows.delete(k) }
    else { window.skippedRows.delete(k); window.ownedRows.delete(k) }
  });
}
// Clicking a row cycles it: nothing → owned → skipped → nothing.
function cycleRowState(key,tr){
  pushUndo();
  const row=rows.find(r=>rowKey(r)===key);
  const state=rowState(key);
  if(state==="none"){
    // You can only hold one City Bank term at a time, and only one TCI
    // strategy, so marking one owned clears whichever other one was marked.
    // Skipping carries no such rule. Passing over the 7-day term says nothing
    // about the 3-month one.
    const group=row?exclusionGroup(row):null;
    if(group) rows.filter(r=>exclusionGroup(r)===group&&rowKey(r)!==key)
                  .forEach(r=>window.ownedRows.delete(rowKey(r)));
    setOwned(key,true);
    markPlanStale();          // what you own is where a plan starts from
  }else if(state==="owned"){
    setOwned(key,false);
    setSkipped(key,true);
    markPlanStale();
  }else{
    setSkipped(key,false);    // skipping never reached the plan, so nothing to flag
  }
  render();
}

// ======================================================================
// UNDO / REDO
// Covers the four sets a click can change: owned, skipped and selected rows
// on Investments, and completed steps in the Planner. Snapshots rather than
// inverse operations, because one click can touch many keys at once (marking
// a block owned marks every block beneath it) and replaying that backwards is
// far more fragile than simply restoring what was there.
//
// The stack is in-memory only. Reloading is not something to undo.
// ======================================================================
const UNDO_LIMIT=50;
window.undoStack=window.undoStack||[];
window.redoStack=window.redoStack||[];
function snapshotRows(){
  return {
    owned:[...window.ownedRows], skipped:[...window.skippedRows],
    selected:[...window.selectedRows], planDone:[...window.planDone]
  };
}
function restoreRows(snap){
  const put=(set,list)=>{ set.clear(); list.forEach(k=>set.add(k)) };
  put(window.ownedRows,snap.owned);
  put(window.skippedRows,snap.skipped);
  put(window.selectedRows,snap.selected);
  put(window.planDone,snap.planDone);
}
// Called immediately before a change, so the stack holds the state to go back
// to. A fresh action invalidates anything that was undone.
function pushUndo(){
  window.undoStack.push(snapshotRows());
  if(window.undoStack.length>UNDO_LIMIT) window.undoStack.shift();
  window.redoStack.length=0;
}
// Both directions repaint whichever page is showing and re-save, so the change
// survives a reload the same way the original click would have.
function applyRestore(snap){
  restoreRows(snap);
  if(window.planResult) renderPlan();
  render();
  // The "Custom Plan" goal reads the Plan column, so a restored tick has to
  // feed back into it exactly as a clicked one would.
  if($("planGoal")?.value==="selected"){ syncPlanPrioritiseToGoal(); markPlanStale() }
}
function undoRows(){
  if(!window.undoStack.length) return false;
  window.redoStack.push(snapshotRows());
  applyRestore(window.undoStack.pop());
  return true;
}
function redoRows(){
  if(!window.redoStack.length) return false;
  window.undoStack.push(snapshotRows());
  applyRestore(window.redoStack.pop());
  return true;
}
function toggleRow(key,checked,group){
  pushUndo();
  if(checked){
    if(group){
      // Drop any other selection from the same group.
      for(const k of [...window.selectedRows]){
        const other=rows.find(r=>rowKey(r)===k);
        if(other&&exclusionGroup(other)===group) window.selectedRows.delete(k);
      }
    }
    window.selectedRows.add(key);
  }else window.selectedRows.delete(key);
  // The Plan column is what the "Selected investments" goal targets, so a tick
  // changes that plan, and the situational stocks it needs along with it.
  if($("planGoal")?.value==="selected"){ syncPlanPrioritiseToGoal(); markPlanStale() }
  render();
}

// Totals for any set of rows: cost, return and blended ROI. Called twice,
// once for what you own, once for what you have ticked to plan for.
function totalsFor(keys,period){
  const sel=rows.filter(r=>keys.has(rowKey(r)));
  const cost=sel.reduce((a,r)=>a+(r.cost||0),0);
  const ret=sel.reduce((a,r)=>a+(periodValue(r.annual,period||tablePeriod())||0),0);
  const annual=sel.reduce((a,r)=>a+(r.annual||0),0);
  const roi=cost>0?annual/cost:null;
  return {n:sel.length,cost,ret,roi};
}
// Both Portfolio panels are the same two lines; only the period differs.
// What the plan says you are holding right now: what you started with, plus
// everything a ticked step bought, minus everything a ticked step sold. A
// step that sells to fund a purchase takes those holdings back off the tally.
function planHeldKeys(){
  const keys=new Set(window.ownedRows);
  (window.planStepOrder||[]).forEach(occ=>{
    const s=(window.planStepIndex||{})[occ];
    if(!s||!s.done) return;
    if(s.sellHolding){ keys.delete(rowKey(s.row)); return }
    (s.sold||[]).forEach(r=>keys.delete(rowKey(r)));
    if(s.row.kind==="stock"||s.row.kind==="island") keys.add(rowKey(s.row));
  });
  return keys;
}
function paintTotals(bodyId,headerId,period,ownedOnly){
  const body=$(bodyId);
  if(!body) return;
  const rh=$(headerId);
  if(rh) rh.textContent=`Total Return – ${periodLabel(period)}`;
  const line=(label,t,cls="")=>`<tr class="totals-row${cls?" "+cls:""}">
<td>${label}</td>
<td>${t.n}</td>
<td>${money(t.cost)}</td>
<td>${money(t.ret)}</td>
<td class="${t.roi!=null?(t.roi>=0?'good':'bad'):''}">${pct(t.roi)}</td>
</tr>`;
  if(ownedOnly){ body.innerHTML=line("Owned",totalsFor(planHeldKeys(),period)); return }
  body.innerHTML=line("Owned",totalsFor(window.ownedRows,period))
                +line("Planned",totalsFor(window.selectedRows,period),"plan-total");
}

// Select or clear every row in one table. Mutually exclusive groups (City Bank
// terms, TCI variants) contribute only their highest-ROI member.
function selectAll(which,checked){
  const target=which==="main"
    ? rows.filter(r=>!(r.kind==="stock"&&UNDEFINED_ROI_TICKERS.includes(r.ticker)))
    : rows.filter(r=>r.kind==="stock"&&UNDEFINED_ROI_TICKERS.includes(r.ticker));
  if(!checked){
    target.forEach(r=>window.selectedRows.delete(rowKey(r)));
    render();
    return;
  }
  const bestOfGroup={};
  for(const r of target){
    const g=exclusionGroup(r);
    if(!g){window.selectedRows.add(rowKey(r));continue}
    const cur=bestOfGroup[g];
    if(!cur||(r.roi??-Infinity)>(cur.roi??-Infinity)) bestOfGroup[g]=r;
  }
  Object.values(bestOfGroup).forEach(r=>window.selectedRows.add(rowKey(r)));
  if($("planGoal")?.value==="selected"){ syncPlanPrioritiseToGoal(); markPlanStale() }
  render();
}

// ======================================================================
// RECOMMENDATION  ·  What to buy next, and the totals panel
// ======================================================================
// What to buy right now. The target is the best thing you don't own; while
// saving for it you can park money in cheaper investments whose combined cost
// stays under the target's. The recommendation is the cheapest of those (the
// one you can afford soonest) or the target itself when nothing qualifies.
function bestBuy(list){
  // Banks are somewhere to hold capital, not something to acquire, so they are
  // never suggested as a purchase. See bankAdviceText() for how they surface.
  const unowned=list.filter(r=>!window.ownedRows.has(rowKey(r))&&!window.skippedRows.has(rowKey(r))
                              &&r.roi!=null&&isFinite(r.roi)&&r.roi>0
                              &&r.kind!=="bank"&&r.kind!=="cayman")
                    .sort((a,b)=>rankRoi(b)-rankRoi(a));
  if(!unowned.length) return null;
  const target=unowned[0];
  // Holdings are capital that will go toward the target, so they count against
  // the budget for further parking buys.
  let spent=list.filter(r=>window.ownedRows.has(rowKey(r)))
                .reduce((a,r)=>a+(r.cost||0),0);
  const parking=[];
  for(const r of unowned.slice(1)){
    if(exclusionGroup(r)&&exclusionGroup(r)===exclusionGroup(target)) continue;
    if(spent+r.cost<target.cost){parking.push(r);spent+=r.cost}
  }
  const pick=parking.length?parking.reduce((a,b)=>b.cost<a.cost?b:a):target;
  return {pick,target,isTarget:pick===target};
}

// City Bank pays a flat rate on whatever you deposit, so anything that beats it
// is worth buying first; after that, spare capital belongs in the bank.
function bankAdviceText(list){
  const banks=list.filter(r=>r.kind==="bank");
  const bankRoi=Math.max(...banks.map(r=>r.roi??-Infinity),-Infinity);
  if(!isFinite(bankRoi)) return "";
  // Nothing left to advise once the bank is actually full: a term is marked
  // owned and the deposit is sitting at its cap.
  if(banks.some(r=>window.ownedRows.has(rowKey(r)))&&bankDepositValue()>=bankDepositCap()) return "";
  // Ranked, not raw: a deprioritised stock is pushed down here exactly as it is
  // in the sort and in "Buy this next", so unticking it drops it from this list.
  // Owned ones stay listed as a reminder not to sell them to fund the bank.
  const better=list.filter(r=>r.kind!=="bank"&&r.kind!=="cayman"&&!window.skippedRows.has(rowKey(r))
                             &&r.roi!=null&&isFinite(r.roi)&&rankRoi(r)>bankRoi);
  const names=[...new Set(better.map(r=>r.name))];
  if(!names.length) return "Capital should be invested into maxing City Bank where possible, before purchasing other investments.";
  const list3=names.length===1?names[0]
    :names.slice(0,-1).join(", ")+" and "+names[names.length-1];
  return `After buying ${list3}, capital should always be invested in City Bank when possible.`;
}

function renderBuyNext(list){
  const el=$("buyNext");
  if(!el) return;
  const res=bestBuy(list);
  if(!res){const a=bankAdviceText(list);el.innerHTML=`<div class="bn-label">Buy this next</div><div class="bn-name">—</div><div class="bn-figs">Add your API key and refresh, or you already own everything worth buying.</div>${a?`<div class="bn-bank">${esc(a)}</div>`:""}`;return}
  const {pick,target,isTarget}=res;
  const nm=r=>`${r.name}${r.block&&r.block>1?` (B${r.block})`:""}`;
  el.innerHTML=`<div class="bn-label">Buy this next</div>
<div class="bn-name">${nm(pick)}</div>
<div class="bn-figs">${moneyShort(pick.cost)} · returns <strong>${moneyShort(returnValue(pick))}</strong> ${returnPeriodLabel().toLowerCase()} · breaks even in <strong>${breakEvenText(pick)}</strong></div>
${isTarget?"":`<div class="bn-target">Hold it while you save for ${nm(target)} · ${moneyShort(target.cost)}, then sell to help fund it.</div>`}
${(()=>{const a=bankAdviceText(list);return a?`<div class="bn-bank">${esc(a)}</div>`:""})()}`;
}

// Basic view's quick settings write straight through to the advanced inputs,
// so both views always agree on the underlying values.
// Each quick setting writes only the Advanced field it mirrors. Writing all
// four every time meant editing the PI rent silently reset merits to 0 and the
// bank deposit to its default.
function applyBasicControls(which){
  if(!which||which==="bMerits") $("merits").value=$("bMerits").checked?"10":"0";
  if(!which||which==="bOilRig"){
    const oil=$("bOilRig").checked;
    setBool("oilRig",oil);
    setBool("fatCat",oil);
    // Fat Cat raises the deposit cap, so move the deposit to the new maximum.
    setMoneyInput("bankDeposit",oil?3e9:2e9);
  }
  if(!which||which==="bBankDeposit") setMoneyInput("bankDeposit",parseFloat(String($("bBankDeposit").value).replace(/[^0-9.\-]/g,""))||0);
  if(!which||which==="bPiRent") setMoneyInput("piRent",parseFloat(String($("bPiRent").value).replace(/[^0-9.\-]/g,""))||0);
  if(!which||which==="bPiIncome") setMoneyInput("piIncome",parseFloat(String($("bPiIncome").value).replace(/[^0-9.\-]/g,""))||0);
  clampBankDeposit();
  // The deposit is clamped to the cap, and the Oil Rig moves that cap, so the
  // box always shows whatever the deposit actually ended up being.
  $("bBankDeposit").value=$("bankDeposit")?.value??"";
  calculate();
}
// Reflect the advanced values back into the basic controls.
function syncBasicControls(){
  if(!$("bMerits")) return;
  $("bMerits").checked=+($("merits")?.value||0)>=10;
  $("bOilRig").checked=boolVal("oilRig")&&boolVal("fatCat");
  $("bBankDeposit").value=$("bankDeposit")?.value??"";
  $("bPiRent").value=$("piRent")?.value??"";
  $("bPiIncome").value=$("piIncome")?.value??"";
}

// ======================================================================
// VIEW MODES  ·  Basic and Advanced switching
// ======================================================================
function setView(basic){
  document.body.classList.toggle("basic",basic);
  $("viewBasic")?.classList.toggle("active",basic);
  $("viewAdvanced")?.classList.toggle("active",!basic);
  // Basic puts the API panel above Quick Settings in the main column; Advanced
  // returns it to the top of the settings column.
  const api=$("apiPanel");
  if(api&&!document.body.classList.contains("planner")){
    if(basic) $("noDataNotice")?.before(api);
    else $("collapseConfig")?.after(api);
  }
  if(basic) syncBasicControls();
  // Recalculate rather than just re-render: some values (IIL's course
  // assumption) depend on which view is active.
  calculate();
}

// ======================================================================
// RENDERING  ·  Draw the tables, totals and buy-next panel
// ======================================================================
// Basic view money format: $8.77 billion / $987.2 million / $875 thousand / $984
function moneyShort(v){
  if(v==null||!isFinite(v)) return "—";
  const neg=v<0, n=Math.abs(v);
  // Drops trailing zeros from the decimals: 1.00 -> 1, 1.10 -> 1.1
  const trim=s=>s.replace(/\.?0+$/,"");
  let out;
  if(n<1e3){
    out="$"+Math.round(n).toLocaleString("en-US");
  }else if(n<1e6){
    const t=Math.round(n/1e3);
    // Promote if rounding reaches the next tier (e.g. 999,999 -> $1 million).
    out=t>=1000?"$"+trim((n/1e6).toFixed(1))+" million":"$"+t.toLocaleString("en-US")+" thousand";
  }else if(n<1e9){
    const m=+(n/1e6).toFixed(1);
    out=m>=1000?"$"+trim((n/1e9).toFixed(2))+" billion":"$"+trim(m.toFixed(1))+" million";
  }else{
    out="$"+trim((n/1e9).toFixed(2))+" billion";
  }
  return neg?"-"+out:out;
}
// Days to recover the purchase cost. Anything that never pays for itself
// sorts to the far end rather than being treated as a blank.
function breakEvenValue(r){
  return (r.annual!=null&&isFinite(r.annual)&&r.annual>0&&r.cost>0)?r.cost/(r.annual/365):Infinity;
}
// Time to recover the purchase cost from returns, rounded up to whole days.
function breakEvenText(r){
  if(r.annual==null||!isFinite(r.annual)||r.annual<=0) return "—";
  if(!r.cost||!isFinite(r.cost)) return "—";
  return formatDuration(Math.ceil(r.cost/(r.annual/365)));
}

// Basic view drops the tags and tints the whole row instead. One category per
// row, most important first.
// Cells whose only content is an em dash read better centred.
function markEmptyCells(){
  document.querySelectorAll("#tbody td, #tbodyUndefined td, #tbodyTotals td").forEach(td=>{
    td.classList.toggle("nil",td.textContent.trim()==="—");
  });
}

function rowTint(r){
  if(r.awful) return "tint-awful";
  if(r.bank) return "tint-bank";
  if(r.booster) return "tint-booster";
  if(r.payout==="money") return "tint-money";
  if(r.payout==="items") return "tint-items";
  if(r.situational) return "tint-situational";
  return "";
}

// Draws the three tables from `rows`, applying the current view, sort order,
// ownership and selection state.
function render(){
  renderPlan();
  // Until stock prices load there's nothing to show, so swap the tables for a
  // prompt to enter an API key.
  // Nothing worth exporting until share prices have loaded, the same
  // condition that swaps the tables for the "enter a key" prompt.
  const noData=!Object.keys(prices).length;
  document.body.classList.toggle("no-data",noData);
  ["csvInvestments","csvPlan"].forEach(id=>{ const el=$(id); if(el) el.disabled=noData });
  const basic=document.body.classList.contains("basic");
  let mainRows=rows.filter(r=>!(r.kind==="stock" && UNDEFINED_ROI_TICKERS.includes(r.ticker)));
  const undefinedRows=rows.filter(r=>r.kind==="stock" && UNDEFINED_ROI_TICKERS.includes(r.ticker));
  if(basic){
    // Simplified view: first three blocks only, and TCI's passive strategy only.
    mainRows=mainRows.filter(r=>(r.block==null||r.block<=3) && !/ - Active$/.test(r.name||""));
  }
  renderBuyNext(mainRows);
  $("tbody").innerHTML=mainRows.map(r=>`<tr data-key="${rowKey(r)}" class="${window.ownedRows.has(rowKey(r))?"owned ":""}${window.skippedRows.has(rowKey(r))?"skipped ":""}${r.depri?"depri ":""}${basic?rowTint(r)+" ":""}${r.kind==="stock" && r.block===1 ? "stock-first" : ""} ${["cayman","bankbonus","pi","bank","property"].includes(r.kind) || /city bank|^pi$|private island/i.test(String(r.name||"")) ? "special-purple" : ""}">
<td class="pick"><input type="checkbox" class="row-pick" data-key="${rowKey(r)}"${window.selectedRows.has(rowKey(r))?" checked":""}></td>
<td title="${esc(r.tip||r.desc||"")}"><span class="ticker">${r.ticker}</span> <strong>${r.name}${basic&&r.block&&!r.singleBlock?` – Increment ${r.block}`:""}</strong>${basic?"":`${r.block?`<span class="tag">${r.singleBlock?"Single":"B"+r.block}</span>`:""}${window.skippedRows.has(rowKey(r))?`<span class="tag skipped">Skipped</span>`:""}${r.situational?`<span class="tag situational">Situational</span>`:""}${r.awful?`<span class="tag awful">Awful</span>`:""}${r.payout==="money"?`<span class="tag money">$$$</span>`:""}${r.payout==="items"?`<span class="tag items">Items</span>`:""}${r.bank?`<span class="tag bank">Bank</span>`:""}${r.booster?`<span class="tag booster">Booster</span>`:""}`}<div class="sub row-desc">${r.desc||""}</div></td>
<td class="benefit-cell">${r.benefit&&r.benefit[0]?r.benefit[0]:"—"}${r.benefit&&r.benefit[1]?`<div class="sub">${r.benefit[1]}</div>`:""}</td>
<td>${basic?moneyShort(r.cost):money(r.cost)}</td><td>${r.days?`${r.days}d`:"—"}</td><td>${basic?moneyShort(returnValue(r)):money(returnValue(r))}</td><td class="${r.roi!=null?(r.roi>=0?'good':'bad'):''}">${pct(r.roi)}</td><td class="basic-col">${breakEvenText(r)}</td><td class="${r.compare!=null?(r.compare>=0?'good':'bad'):''}">${money(r.compare)}</td>
</tr>`).join("");
  $("tbodyUndefined").innerHTML=undefinedRows.map(r=>`<tr data-key="${rowKey(r)}" class="${window.ownedRows.has(rowKey(r))?"owned ":""}${window.skippedRows.has(rowKey(r))?"skipped ":""}${basic&&r.awful?"tint-awful ":basic&&r.situational?"tint-situational ":""}${r.block===1?"stock-first":""}">
<td class="pick"><input type="checkbox" class="row-pick" data-key="${rowKey(r)}"${window.selectedRows.has(rowKey(r))?" checked":""}></td>
<td><span class="ticker">${r.ticker}</span> <strong>${r.name}</strong>${r.block?`<span class="tag">${r.singleBlock?"Single":"B"+r.block}</span>`:""}${window.skippedRows.has(rowKey(r))?`<span class="tag skipped">Skipped</span>`:""}${r.situational?`<span class="tag situational">Situational</span>`:""}${r.awful?`<span class="tag awful">Awful</span>`:""}${r.payout==="money"?`<span class="tag money">$$$</span>`:""}${r.payout==="items"?`<span class="tag items">Items</span>`:""}${r.bank?`<span class="tag bank">Bank</span>`:""}${r.booster?`<span class="tag booster">Booster</span>`:""}</td>
<td class="benefit-cell">${r.benefit&&r.benefit[0]?r.benefit[0]:"—"}${r.benefit&&r.benefit[1]?`<div class="sub">${r.benefit[1]}</div>`:""}</td>
<td>${basic?moneyShort(r.cost):money(r.cost)}</td><td class="benefit-cell">${r.notes&&r.notes[0]?r.notes[0]:(r.desc||"")}${r.notes&&r.notes[1]?`<div class="sub">${r.notes[1]}</div>`:""}</td>
</tr>`).join("");
  // Keep each header checkbox in step with its table's rows.
  const syncHead=(id,list)=>{
    const box=$(id);
    if(!box) return;
    const sel=list.filter(r=>window.selectedRows.has(rowKey(r))).length;
    const groups=new Set(list.map(exclusionGroup).filter(Boolean));
    const max=list.filter(r=>!exclusionGroup(r)).length+groups.size;
    box.checked=max>0&&sel>=max;
    box.indeterminate=sel>0&&sel<max;
  };
  syncHead("pickAllMain",mainRows);
  syncHead("pickAllUndefined",undefinedRows);
  paintTotals("tbodyTotals","totalReturnHeader",tablePeriod());
  markEmptyCells();
}

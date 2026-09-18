// ======================================================================
// BASIC BANKING  ·  What a year of each City Bank term is actually worth
// ----------------------------------------------------------------------
// The Investments page prices one deposit over one term. The question this
// page answers is a different one: over a whole year, does a short term's
// compounding beat a long term's higher rate? It is a read-only view with
// its own copy of the bank settings, and nothing here feeds the planner.
// ======================================================================
const BANKING_YEAR=365;
// ---- The reader's copy of the bank settings ---------------------------
function loadBankingTouched(){
  try{
    const a=JSON.parse(localStorage.getItem("tornInvBankingTouched")||"[]");
    if(Array.isArray(a)) a.forEach(k=>window.bankingTouched.add(k));
  }catch(e){ logProblem("Basic Banking overrides could not be read. Investment settings used",e) }
}
function saveBankingTouched(){
  try{ localStorage.setItem("tornInvBankingTouched",JSON.stringify([...window.bankingTouched])) }
  catch(e){ logProblem("Basic Banking overrides could not be saved",e) }
}
// Marks a field as the reader's, so it stops following the investment page.
function bankingTouch(id){
  if(window.bankingTouched.has(id)) return;
  window.bankingTouched.add(id);
  saveBankingTouched();
}
// Copies the investment settings into every field not yet taken over. Runs on
// every rebuild, so an API refresh flows through to the untouched fields.
function syncBankingFromAdvanced(){
  if(!$("bkDeposit")) return;
  Object.entries(BANKING_MIRROR).forEach(([id,src])=>{
    if(window.bankingTouched.has(id)) return;
    const from=$(src), el=$(id);
    if(!from||!el) return;
    if(el.type==="checkbox") el.checked=!!from.checked;
    else el.value=from.value;
  });
  clampBkDeposit();
}
// The one route back the other way, and only on a button press.
function applyBankingToAdvanced(){
  Object.entries(BANKING_MIRROR).forEach(([id,dst])=>{
    const to=$(dst), el=$(id);
    if(!to||!el) return;
    if(to.type==="checkbox") to.checked=!!el.checked;
    else to.value=el.value;
  });
  clampBankDeposit();
  // The two sides now agree, so the mirroring can resume from here.
  window.bankingTouched.clear();
  saveBankingTouched();
  syncBasicControls();
  syncBankBoxes();
  calculate();
  const btn=$("bkApply");
  if(btn){
    btn.textContent="Applied";
    clearTimeout(window.bkApplyTimer);
    window.bkApplyTimer=setTimeout(()=>{btn.textContent="Apply to investment settings"},1600);
  }
}
// ---- Rates, read off this page's own settings -------------------------
function bkCap(){ return boolVal("bkFatCat")?3e9:2e9 }
function clampBkDeposit(){
  if(!$("bkDeposit")) return;
  setMoneyInput("bkDeposit",Math.min(Math.max(0,numVal("bkDeposit")),bkCap()));
}
function bkOilJp(){ return Math.max(0,Math.min(10,+($("bkOilJp")?.value||0))) }
// Oil Mogul shortens the wait rather than raising the rate, so here it shows
// up as more terms fitting in the year rather than a bigger number per term.
function bkTermRealDays(days){
  const p=bkOilJp();
  return p>0 ? days*72/(72+p) : days;
}
// APR before Oil Mogul: the posted rate, plus merits, plus the TCI block.
function bkTermApr(days){
  const base=+(rates[BANK_TERMS[days]]||0)/100;
  const merits=Math.max(0,Math.min(10,+($("bkMerits")?.value||0)))*0.05;
  return base*(1+merits)*(boolVal("bkTci")?1.10:1);
}
// ---- The year ---------------------------------------------------------
// One term at a time, for as many whole terms as fit in a year. Each term
// pays its interest at the end, and that payout plus everything put aside
// while it was locked away goes straight back in, which is where the
// compounding comes from.
//
// Every term adds one term-length of the daily budget, so each row of the
// comparison puts in about the same money across the year and the difference
// between the rows is the banking, not the saving.
//
// Anything over the deposit cap cannot earn, but it is still money, so it
// stays in the amount returned and goes back round as capital next term
// rather than being added again. Interest is paid on the capped part only,
// which is why the profit flattens out once the cap is reached.
function bankingPlan(days){
  const apr=bkTermApr(days);
  const span=bkTermRealDays(days);          // real days one term takes
  const rate=apr*days/BANKING_YEAR;         // interest paid at the end of one
  const deposits=span>0?Math.floor(BANKING_YEAR/span):0;
  const cap=bkCap(), budget=Math.max(0,numVal("bkBudget"));
  const lines=[];
  let initial=Math.min(Math.max(0,numVal("bkDeposit")),cap), carry=0;
  for(let k=0;k<deposits;k++){
    const added=budget*span;
    const pool=initial+added;
    const principal=Math.min(cap,pool);
    carry=pool-principal;
    const profit=principal*rate;
    const total=principal+profit+carry;   // everything held once the term ends
    lines.push({initial,added,rate,profit,total,daily:span>0?profit/span:0});
    initial=total;
  }
  const firstInitial=lines.length?lines[0].initial:0;
  const added=lines.reduce((a,l)=>a+l.added,0);
  const profit=lines.reduce((a,l)=>a+l.profit,0);
  const capitalIn=firstInitial+added;
  return {days,apr,span,rate,lines,
          totals:{deposits,firstInitial,added,profit,
                  absolute:capitalIn+profit,
                  roi:capitalIn>0?profit/capitalIn:null}};
}
function bankingTerms(){ return Object.keys(BANK_TERMS).map(Number).sort((a,b)=>a-b) }
function buildBankingTermOptions(){
  const sel=$("bkDetailTerm");
  if(!sel) return;
  sel.innerHTML="";
  bankingTerms().forEach(d=>{
    const o=document.createElement("option");
    o.value=String(d); o.textContent=bankTermLabel(d);
    sel.appendChild(o);
  });
  sel.value="30";
}
// ---- Drawing ----------------------------------------------------------
function renderBankingSummary(){
  const body=$("tbodyBankSummary");
  if(!body) return;
  const all=bankingTerms().map(d=>({days:d,t:bankingPlan(d).totals}));
  // Best and worst by profit, which is what "return" means in this table.
  // Every term puts in much the same money across the year, so ROI and the
  // absolute total order themselves the same way in practice.
  const profits=all.map(x=>x.t.profit).filter(v=>isFinite(v));
  const best=Math.max(...profits), worst=Math.min(...profits);
  // Nothing to rank when every term pays the same, so neither colour is used.
  const spread=isFinite(best)&&isFinite(worst)&&best>worst;
  body.innerHTML=all.map(({days,t})=>{
    const mark=!spread?""
      :t.profit===best?' class="bank-best"'
      :t.profit===worst?' class="bank-worst"':"";
    return `<tr${mark}>
<td>${bankTermLabel(days)}</td>
<td>${t.deposits}</td>
<td>${money(t.profit)}</td>
<td class="${t.roi!=null&&t.roi>=0?"good":""}">${pct(t.roi)}</td>
<td>${money(t.absolute)}</td>
</tr>`;
  }).join("");
}
function renderBankingDetail(){
  const body=$("tbodyBankDetail"), totals=$("tbodyBankTotals"), sel=$("bkDetailTerm");
  if(!body||!totals||!sel) return;
  const p=bankingPlan(+sel.value||30);
  body.innerHTML=p.lines.map((l,i)=>`<tr>
<td>${i+1}</td>
<td>${money(l.initial)}</td>
<td>${money(l.added)}</td>
<td>${(l.rate*100).toFixed(2)}%</td>
<td>${money(l.profit)}</td>
<td>${money(l.total)}</td>
<td>${money(l.daily)}</td>
</tr>`).join("");
  // Its own table rather than a footer row, so the four figures get real
  // headings instead of borrowing the breakdown's columns.
  totals.innerHTML=`<tr>
<td>${money(p.totals.firstInitial)}</td>
<td>${money(p.totals.added)}</td>
<td>${money(p.totals.profit)}</td>
<td>${money(p.totals.absolute)}</td>
</tr>`;
}
function renderBanking(){ renderBankingSummary(); renderBankingDetail(); }
// ---- Wiring -----------------------------------------------------------
// The money boxes are handled with the rest of MONEY_INPUTS further up, so
// that they format as you type; these are the selects and checkboxes.
["bkMerits","bkOilJp","bkTci","bkFatCat"].forEach(id=>
  $(id)?.addEventListener("change",()=>{
    bankingTouch(id);
    if(id==="bkFatCat") clampBkDeposit();
    renderBanking();
  }));
// The breakdown picker is a view control, not a setting, so it never counts
// as taking a field over.
$("bkDetailTerm")?.addEventListener("change",renderBankingDetail);
$("bkApply")?.addEventListener("click",applyBankingToAdvanced);

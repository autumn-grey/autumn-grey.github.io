// ======================================================================
// ENTRY POINTS  ·  Refresh, sorting, and event wiring
// ======================================================================
// Market data only: prices, items, bank rates, points. Never touches a
// setting the user (or a previous personal refresh) has configured.
async function refreshMarketData(){
  const saved=window.savedBoosters||{};
  const savedRefillables={
    happy:$("happyItem")?.value||saved.happyItem||"",
    energy:$("energyItem")?.value||saved.energyItem||"",
    nerve:$("nerveItem")?.value||saved.nerveItem||""
  };
  await Promise.all([fetchStocks(),fetchRates(),fetchItems(),fetchPoints(),
                     fetchStockMeta(),fetchEducationIndex(),fetchPropertyPrices()]);
  ["happy","energy","nerve"].forEach(stat=>{
    const el=$(`${stat}Item`);
    const saved=savedRefillables[stat];
    if(el && saved && [...el.options].some(o=>o.value===saved)) el.value=saved;
  });
  applyDefaultBoosters();
  cacheMarket();
}
// Both refresh buttons run through here. `withUser` decides whether the
// personal pulls and the settings they preconfigure are refreshed too.
async function refresh(withUser){
  setStatus(withUser?"Checking your key and refreshing everything…":"Refreshing market data…");
  try{
    // The faction check gates every other request, personal or public.
    const gate=await verifyFaction();
    // Say so when the exception is what let them in, rather than leaving a
    // non-member wondering why it worked.
    if(gate.ok&&gate.staff) setStatus(`Welcome, Torn ${gate.staff}. Access granted outside ${REQUIRED_FACTION}.`,"good");
    if(!gate.ok){
      setStatus(gate.name
        ? `This app is for ${REQUIRED_FACTION} only. Your key belongs to a member of ${gate.name}.`
        : `This app is for ${REQUIRED_FACTION} only, and your key isn't in a faction.`,"bad");
      $("userStatus").hidden=true;
      calculate();
      return;
    }
    await refreshMarketData();
    if(withUser){
      const data=await fetchUserData(gate.profile);
      if(data.limited){
        renderUserStatus([],`Access-only key · settings left as they are (${data.limitedReason})`,"",data);
      }else{
        const rep=applyUserData(data);
        await applyRacingStock(
          (label,detail)=>rep.push({ok:true,label,detail}),
          (label,detail)=>rep.push({ok:false,label,detail}));
        lastUpdated.user=Date.now();
        const good=rep.filter(r=>r.ok).length;
        renderUserStatus(rep,`Preconfigured ${good} of ${rep.length} settings from your account`,"good",data);
      }
    }
    calculate();
    applyPendingOwned();
    window.freshnessLive=true;
    renderFreshness();
  }catch(e){
    setStatus(e.message,"bad");
    // Otherwise a stale "Preconfigured 9 of 10" sits under the error, reading
    // as though the personal data had just come through.
    if($("userStatus")) $("userStatus").hidden=true;
    calculate();
  }
}
// Marks the stocks a personal refresh found as owned, once the rows they
// refer to actually exist.
function applyPendingOwned(){
  const tickers=window.pendingOwnedTickers;
  if(!tickers||!tickers.length||!rows.length) return;
  const set=new Set(tickers);
  rows.filter(r=>r.kind==="stock"&&r.block===1&&set.has(r.ticker))
      .forEach(r=>{window.ownedRows.add(rowKey(r));window.skippedRows.delete(rowKey(r))});
  window.pendingOwnedTickers=null;
  markPlanStale();
  render();
}
window.tableSort={key:"roi",direction:-1};

function updateSortHeaders(){
  document.querySelectorAll(".table th.sortable").forEach(th=>{
    const active=window.tableSort && th.dataset.sort===window.tableSort.key;
    th.classList.toggle("sort-asc",!!active&&window.tableSort.direction===1);
    th.classList.toggle("sort-desc",!!active&&window.tableSort.direction===-1);
    th.setAttribute("aria-sort",active?(window.tableSort.direction===1?"ascending":"descending"):"none");
    const indicator=th.querySelector(".sort-indicator");
    if(indicator) indicator.textContent=active?(window.tableSort.direction===1?"↑":"↓"):"↕";
  });
}

// Wires the sortable headers, keyboard included, and paints their arrows.
function setupTableSorting(){
  document.querySelectorAll(".table th.sortable").forEach(th=>{
    const sortHeader=e=>{
      // Ignore clicks on a dropdown embedded in the header.
      if(e&&e.target&&e.target.closest(".th-select")) return;
      const key=th.dataset.sort;
      if(window.tableSort.key===key) window.tableSort.direction*=-1;
      else {window.tableSort.key=key;window.tableSort.direction=1;}
      updateSortHeaders();
      calculate();
    };
    th.addEventListener("click",sortHeader);
    th.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){e.preventDefault();sortHeader();}
    });
  });
  updateSortHeaders();
}

// Investment-table settings rebuild the rows. The planner's own fields are
// deliberately absent here. They are wired to markPlanStale further down, so
// that typing in the planner no longer re-runs the simulation on every key.
INVESTMENT_FIELDS.forEach(k=>$(k)?.addEventListener("input",calculate));
// Format as you type. The caret is restored by counting digits rather than
// characters, so inserting a comma does not shunt it around.
function liveFormatMoney(el){
  const before=el.value, caret=el.selectionStart??before.length;
  const digitsBefore=(before.slice(0,caret).match(/\d/g)||[]).length;
  const n=parseFloat(before.replace(/[^0-9.\-]/g,""));
  if(before.trim()===""||!isFinite(n)){el.value="";return}
  el.value="$"+Math.round(n).toLocaleString("en-US");
  let seen=0,pos=el.value.length;
  for(let i=0;i<el.value.length;i++){
    if(/\d/.test(el.value[i])) seen++;
    if(seen===digitsBefore){pos=i+1;break}
  }
  if(digitsBefore===0) pos=el.value.length;
  el.setSelectionRange(pos,pos);
}
MONEY_INPUTS.forEach(id=>{
  const el=$(id);
  if(!el) return;
  // Capital and daily budget only feed the planner, so they never rebuild the
  // investment rows, they just mark the plan as out of date.
  const bankBox=(id==="planBankAmount"||id==="planBankInvested");
  // Basic Banking keeps its own copies, so these never touch the investments.
  const bankingBox=(id==="bkDeposit"||id==="bkBudget");
  const planOnly=(id==="capital"||id==="dailyBudget"||bankBox);
  const after=()=>{
    if(bankingBox){ bankingTouch(id); renderBanking() }
    else if(planOnly){ if(bankBox) bankBoxEdited(id); markPlanStale() }
    else calculate();
  };
  const clamp=()=>{ if(id==="bankDeposit")clampBankDeposit(); if(id==="bkDeposit")clampBkDeposit() };
  el.addEventListener("input",()=>{liveFormatMoney(el);clamp();after()});
  el.addEventListener("blur",()=>{formatMoneyInput(el);clamp();after()});
  el.addEventListener("keydown",e=>{if(e.key==="Enter"){formatMoneyInput(el);clamp();after()}});
});
$("fatCat")?.addEventListener("change",()=>{clampBankDeposit();syncBankBoxes();calculate()});
clampBankDeposit();

$("clearPicks")?.addEventListener("click",()=>{
  window.selectedRows.clear();
  if($("planGoal")?.value==="selected"){ syncPlanPrioritiseToGoal(); markPlanStale() }
  render();
});
$("pickAllMain")?.addEventListener("change",e=>selectAll("main",e.target.checked));
$("pickAllUndefined")?.addEventListener("change",e=>selectAll("undefined",e.target.checked));

// Checkbox selection (delegated, so it survives table re-renders).
["tbody","tbodyUndefined"].forEach(id=>{
  $(id)?.addEventListener("change",e=>{
    const cb=e.target.closest(".row-pick");
    if(!cb) return;
    const key=cb.dataset.key;
    const row=rows.find(r=>rowKey(r)===key);
    toggleRow(key,cb.checked,row?exclusionGroup(row):null);
  });
});
// Clicking a plan row marks it bought, same store as the investments table.
// Marking a plan step complete. Occurrences of the same investment are
// independent, but they must be completed in order: clicking a later one when
// an earlier is still outstanding marks the earlier one and says so.
function planStepToggle(occ,tr){
  // Read the order off the plan itself. Reading it off the table only saw the
  // page being displayed, so an earlier occurrence on another page was
  // invisible and the in-order rule silently didn't apply. Completion is also
  // taken from planDone rather than the row's class, because a step flagged
  // "sell now" renders without the done class even when it is done.
  const key=tr.dataset.key;
  const order=window.planStepOrder||[];
  const index=window.planStepIndex||{};
  const sameStock=order.filter(o=>index[o]&&rowKey(index[o].row)===key);
  const clickedAt=sameStock.indexOf(occ);
  const isDone=o=>window.planDone.has(o);
  const firstPending=sameStock.find(o=>!isDone(o));

  if(!isDone(occ)&&firstPending&&firstPending!==occ
     &&sameStock.indexOf(firstPending)<clickedAt){
    const clickedOcc=occ;
    setPlanDone(firstPending,true);
    // render() has just rebuilt the table, so flash the new row, not the
    // detached one we were handed.
    flashEarlier(document.querySelector(`#tbodyPlan tr[data-occ="${CSS.escape(clickedOcc)}"]`));
    return;
  }
  setPlanDone(occ,!window.planDone.has(occ));
}
function setPlanDone(occ,on){
  pushUndo();
  // Progress only. Ticking a step must not change what the simulation starts
  // from, or the plan reshuffles underneath you: a parked stock would become
  // "owned", drop out of the parking pool, and hand its tick to a later entry.
  // The starting position comes from the Investments page.
  if(on) window.planDone.add(occ); else window.planDone.delete(occ);
  // Let the fold default apply again for this group.
  window.planExpanded.delete(occ);
  window.planCollapsed.delete(occ);
  renderPlan();
}
// Marks the clicked row and floats a note over it. Two flavours: the planner's
// green "done" flash, and a shake for a click that was refused.
function flashEarlier(tr){
  flashRowToast(tr,"This investment is required earlier in your plan, it is now marked as selected there instead.","plan-flash",1600);
}
function flashRowToast(tr,message,cls="row-shake",hold=600){
  if(!tr) return;
  tr.classList.add(cls);
  setTimeout(()=>tr.classList.remove(cls),hold);
  floatOverElement(tr,message);
}
// Anchored to the page rather than the element, so a re-render cannot remove
// it mid-display. Sits over the target, centred, kept inside the viewport.
function floatOverElement(el,message){
  if(!el) return;
  document.querySelectorAll(".plan-toast").forEach(t=>t.remove());
  const box=el.getBoundingClientRect();
  const toast=document.createElement("div");
  toast.className="plan-toast";
  toast.textContent=message;
  document.body.appendChild(toast);
  const w=toast.offsetWidth, h=toast.offsetHeight;
  let left=box.left+window.scrollX+(box.width-w)/2;
  left=Math.max(window.scrollX+8,Math.min(left,window.scrollX+document.documentElement.clientWidth-w-8));
  toast.style.left=left+"px";
  toast.style.top=(box.top+window.scrollY+(box.height-h)/2)+"px";
  const kill=()=>{toast.remove();document.removeEventListener("click",onDoc,true)};
  const onDoc=ev=>{if(!toast.contains(ev.target)) kill()};
  setTimeout(()=>document.addEventListener("click",onDoc,true),0);
  setTimeout(kill,5000);
}
// The button that actually builds the plan.
$("planGo")?.addEventListener("click",buildPlan);
$("planFoldAll")?.addEventListener("click",e=>{
  const collapse=e.currentTarget.dataset.action==="collapse";
  (window.planGroups||[]).forEach(k=>{
    if(collapse){window.planCollapsed.add(k);window.planExpanded.delete(k)}
    else{window.planExpanded.add(k);window.planCollapsed.delete(k)}
  });
  renderPlan();
});
// Paging controls, wired once on both copies of the navigation.
["planNavTop","planNavBottom"].forEach(id=>{
  $(id)?.addEventListener("click",e=>{
    const jump=e.target.closest(".pg-current");
    if(jump){
      if(window.planNextOcc) jumpToPlanStep(window.planNextOcc);
      return;
    }
    const btn=e.target.closest("[data-page]");
    if(btn&&!btn.disabled) goToPlanPage(btn.dataset.page);
  });
  // Typing a page number: apply on Enter, or when the box loses focus.
  $(id)?.addEventListener("keydown",e=>{
    if(e.key!=="Enter"||!e.target.classList.contains("pg-input")) return;
    e.preventDefault();
    goToPlanPage(e.target.value);
  });
  $(id)?.addEventListener("change",e=>{
    if(e.target.classList.contains("pg-input")) goToPlanPage(e.target.value);
  });
});
$("planPageSize")?.addEventListener("change",()=>{window.planPage=1;renderPlan()});
// Changing the planner's period repaints the plan and its Portfolio panel; the
// plan itself is untouched, so nothing is re-simulated.
$("returnPeriodPlan")?.addEventListener("change",render);
$("planBankDays")?.addEventListener("input",()=>{applyBankTermGuess();syncBankBoxes();markPlanStale()});
$("planBankTermSel")?.addEventListener("change",()=>{syncBankBoxes();markPlanStale()});
$("csvPlan")?.addEventListener("click",exportPlanTable);
$("csvInvestments")?.addEventListener("click",exportInvestmentsTable);
// Deselects every ticked step, without touching the plan itself. The
// simulation always starts fresh from the Investments page regardless.
$("planClear")?.addEventListener("click",()=>{
  window.planDone.clear();
  window.planExpanded.clear();
  window.planCollapsed.clear();
  renderPlan();
});
$("tbodyPlan")?.addEventListener("click",e=>{
  // The fold control is not a completion click.
  const grp=e.target.closest(".grp-toggle");
  if(grp){
    const k=grp.dataset.grp;
    if(window.planExpanded.has(k)){window.planExpanded.delete(k);window.planCollapsed.add(k)}
    else{window.planExpanded.add(k);window.planCollapsed.delete(k)}
    renderPlan();
    return;
  }
  if(e.target.closest("input,select,a,.plan-toast")) return;
  const tr=e.target.closest("tr[data-occ]");
  if(tr) planStepToggle(tr.dataset.occ,tr);
});
// Clicking a row marks it owned (both views). The checkbox column is for
// building a hypothetical total and is handled separately above.
$("tbody")?.addEventListener("click",e=>{
  if(e.target.closest("input,select,a,.pick")) return;
  const tr=e.target.closest("tr[data-key]");
  if(tr) cycleRowState(tr.dataset.key,tr);
});
document.querySelectorAll(".education-course-check").forEach(cb=>cb.addEventListener("change",calculate));
document.querySelectorAll(".pref-prio").forEach(cb=>cb.addEventListener("change",()=>{syncPrioAll();calculate()}));
// Header checkbox ticks or clears the whole list, and reflects a mixed state.
function syncPrioAll(){
  const boxes=[...document.querySelectorAll(".pref-prio")];
  const on=boxes.filter(b=>b.checked).length;
  const all=$("prioAll");
  if(!all) return;
  all.checked=on===boxes.length;
  all.indeterminate=on>0&&on<boxes.length;
}
$("prioAll")?.addEventListener("change",e=>{
  document.querySelectorAll(".pref-prio").forEach(cb=>cb.checked=e.target.checked);
  calculate();
});
$("incMode")?.addEventListener("change",calculate);
$("incMax")?.addEventListener("change",calculate);
$("refresh").onclick=()=>refresh(true);
$("refreshMarket").onclick=()=>refresh(false);$("save").onclick=saveLocal;$("clear").onclick=clearLocal;$("resetMoney").onclick=resetMoneyTab;$("resetEducation").onclick=resetEducationTab;$("resetMisc").onclick=resetMiscTab;$("resetPrefs").onclick=resetPrefsTab;
// Collapse the configuration column to a vertical tab, giving the table full width.
function setConfigCollapsed(collapsed){
  $("grid").classList.toggle("config-collapsed",collapsed);
  try{localStorage.setItem("tornInvConfigCollapsed",collapsed?"1":"0")}
  catch(e){ logProblem("Configuration panel state could not be saved",e) }
}
// Ctrl+Z undoes a row or step mark, Ctrl+Shift+Z or Ctrl+Y redoes it. Ignored
// while typing, so it can't steal undo from a text field, and only handled
// when there is actually something on the stack.
addEventListener("keydown",e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey) return;
  const t=e.target;
  if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const k=e.key.toLowerCase();
  let done=false;
  if(k==="z"&&!e.shiftKey) done=undoRows();
  else if((k==="z"&&e.shiftKey)||k==="y") done=redoRows();
  else return;
  if(done) e.preventDefault();
});
$("planStaleDismiss")?.addEventListener("click",dismissStaleNote);
$("collapseConfig")?.addEventListener("click",()=>setConfigCollapsed(true));

// The pin buttons sit inside a <label>, so a plain click would also toggle
// that label's checkbox. preventDefault stops the label association firing.
document.addEventListener("click",e=>{
  const btn=e.target.closest(".pin-stock");
  if(!btn) return;
  e.preventDefault();
  e.stopPropagation();
  togglePinnedStock(btn);
});
$("configTab")?.addEventListener("click",()=>setConfigCollapsed(false));

// Debug log wiring. Copy hands over the whole log as plain text so a bug
// report can be pasted straight into a message, and the two global handlers
// catch the failures no local try/catch was expecting.
$("debugLogClear")?.addEventListener("click",clearProblems);
$("debugLogCopy")?.addEventListener("click",()=>{
  const text=window.debugEntries.join("\n");
  if(!text) return;
  navigator.clipboard?.writeText(APP_VERSION+"\n"+text)
    .then(()=>setStatus("Debug log copied to the clipboard.","good"))
    .catch(()=>setStatus("Couldn't copy. Select the log text and copy it by hand.","bad"));
});
window.addEventListener("error",e=>{
  logProblem("Unexpected error"+(e.filename?" (line "+e.lineno+")":""),e.error||e.message);
});
window.addEventListener("unhandledrejection",e=>{
  logProblem("Unhandled background failure",e.reason);
});
try{if(localStorage.getItem("tornInvConfigCollapsed")==="1")setConfigCollapsed(true)}
catch(e){ logProblem("Configuration panel state could not be read",e) }

$("viewBasic")?.addEventListener("click",()=>setView(true));
$("viewAdvanced")?.addEventListener("click",()=>setView(false));
["bMerits","bOilRig","bBankDeposit","bPiRent","bPiIncome"].forEach(id=>{
  $(id)?.addEventListener("change",()=>applyBasicControls(id));
});
["bBankDeposit","bPiRent","bPiIncome"].forEach(id=>{
  const el=$(id);
  if(!el) return;
  el.addEventListener("blur",()=>{formatMoneyInput(el);applyBasicControls(id)});
  el.addEventListener("keydown",e=>{if(e.key==="Enter"){formatMoneyInput(el);applyBasicControls(id)}});
});

// The version now lives only in the footer, alongside the date.
// Both read from the constants above, so a publish only ever edits those two.
{
  const upEl=$("footerUpdated");
  if(upEl) upEl.textContent=APP_UPDATED;
  const fvEl=$("footerVersion");
  if(fvEl) fvEl.textContent=APP_VERSION;
  const tosEl=$("tosUpdated");
  if(tosEl) tosEl.textContent=APP_UPDATED;
}

// ======================================================================
// CSV EXPORT  ·  Both tables in one file, raw numbers for spreadsheets
// ======================================================================
// Excel opens a .csv in the machine's legacy code page unless something tells
// it otherwise, and then every byte of a UTF-8 character becomes its own
// Latin-1 character: – reads as â€“, ¯ as Â¯, ツ as ãƒ„. A UTF-8 byte-order mark
// is supposed to prevent that, but whether it works depends on the Excel
// version, the locale and how the file was opened, so the export sidesteps
// the question entirely and writes nothing but ASCII, which every code page
// on earth agrees about.
const OUT_ASCII={"–":"-","—":"-","·":"-","×":"x","¯":"-","…":"...","’":"'","‘":"'",
                 "“":'"',"”":'"',"⭐":"*","✓":"y","∞":"","°":" deg"};
function outAscii(v){
  let out=String(v).replace(/¯\\_\(ツ\)_\/¯/g,"(shrug)")
                   .replace(/[–—·×¯…’‘“”⭐✓∞°]/g,c=>OUT_ASCII[c]??c);
  // Accented letters keep their letter (Saké -> Sake); anything still outside
  // ASCII after that is dropped rather than shipped as mojibake.
  out=out.normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
  return out.replace(/[^\x20-\x7E]/g,"");
}
// Tab separated rather than comma: Excel splits a .csv on whatever the
// machine's regional settings call the list separator, which is a semicolon
// across most of comma-decimal Europe. The whole file lands in column A
// there. A tab is not a list separator in any locale, so it always splits.
// Quoting is barely needed as a result: only a tab, a newline or a quote
// inside a value forces it, and the export produces none of those.
function outCell(v){
  if(v==null) return "";
  const str=outAscii(v);
  return /["\t\r\n]/.test(str)?`"${str.replace(/"/g,'""')}"`:str;
}
function outText(lines){ return lines.map(r=>r.map(outCell).join("\t")).join("\r\n") }
function downloadTable(name,lines){
  // Pure ASCII by the time it reaches here (see outAscii), so there is nothing
  // for a byte-order mark to disambiguate, and a BOM only risks turning up as
  // a stray i>> in readers that don't know about it.
  const blob=new Blob([outText(lines)],{type:"text/tab-separated-values;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function outStamp(){
  const d=new Date();
  const p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
// Whole numbers only. A decimal point is read as a thousands separator in a
// comma-decimal locale, and in the dot-date ones (Germany, Poland, Bulgaria)
// a value like 26.07 is quietly converted to 26 July. An integer means the
// same thing everywhere. Halves round up, as Math.round does.
const outNum=v=>(v==null||!isFinite(v))?"":Math.round(v);
const outPct=v=>(v==null||!isFinite(v))?"":Math.round(v*100);
function outTags(r){
  const t=[];
  if(r.block) t.push(r.singleBlock?"Single":"B"+r.block);
  if(r.situational) t.push("Situational");
  if(r.awful) t.push("Awful");
  if(r.payout==="money") t.push("$$$");
  if(r.payout==="items") t.push("Items");
  if(r.bank) t.push("Bank");
  if(r.booster) t.push("Booster");
  return t.join(" ");
}
const outBenefit=r=>[r.benefit&&r.benefit[0],r.benefit&&r.benefit[1]].filter(Boolean).join(" · ");
// Sortable companions to the columns that are written for a human to read.
const outIncrement=r=>r.kind==="stock"?(r.block||1):"";
const outBreakEvenDays=r=>(r.annual!=null&&isFinite(r.annual)&&r.annual>0&&r.cost>0)
  ? Math.ceil(r.cost/(r.annual/365)) : "";
function outStatus(r){
  const k=rowKey(r);
  const state=window.ownedRows.has(k)?"Owned":(window.skippedRows.has(k)?"Skipped":"");
  const planned=window.selectedRows.has(k)?"Planned":"";
  return [state,planned].filter(Boolean).join(" + ");
}

// The investments table and the undefined-ROI table, stacked into one sheet
// so the whole picture travels in a single file.
// The rows, so the download and a report attachment are always the same file.
function investmentsTableRows(){
  const basic=document.body.classList.contains("basic");
  let mainRows=rows.filter(r=>!(r.kind==="stock"&&UNDEFINED_ROI_TICKERS.includes(r.ticker)));
  const undefinedRows=rows.filter(r=>r.kind==="stock"&&UNDEFINED_ROI_TICKERS.includes(r.ticker));
  if(basic) mainRows=mainRows.filter(r=>(r.block==null||r.block<=3)&&!/ - Active$/.test(r.name||""));
  const period=returnPeriodLabel();
  const out=[];
  // One header row, first line of the file, shared by both tables. A
  // spreadsheet can then sort and filter the whole thing the moment it opens,
  // which a title line and a second set of headers halfway down would break.
  // Which table a row came from is a column instead.
  out.push(["Section","Ticker","Investment","Increment","Tags","Benefit","Status","Cost*",
            `Return (${period})*`,"Payout every (days)","ROI (%)*","Break-even","Break-even (days)",
            "City Bank difference*","Notes"]);
  mainRows.forEach(r=>out.push([
    "Investments", r.ticker, r.name, outIncrement(r), outTags(r), outBenefit(r), outStatus(r),
    outNum(r.cost), outNum(returnValue(r)), r.days||"", outPct(r.roi),
    breakEvenText(r), outBreakEvenDays(r), outNum(r.compare), r.desc||""
  ]));
  undefinedRows.forEach(r=>out.push([
    "Undefined ROI", r.ticker, r.name, outIncrement(r), outTags(r), outBenefit(r), outStatus(r),
    outNum(r.cost), "", "", "", "", "", "",
    [r.notes&&r.notes[0],r.notes&&r.notes[1]].filter(Boolean).join(" · ")||r.desc||""
  ]));
  // Everything that isn't a row of the table goes after it, where it can't
  // interfere with the header.
  const owned=totalsFor(window.ownedRows), planned=totalsFor(window.selectedRows);
  out.push([]);
  out.push(["Summary","Investments","Total cost",`Total return (${period})`,"Total ROI (%)"]);
  out.push(["Owned",owned.n,outNum(owned.cost),outNum(owned.ret),outPct(owned.roi)]);
  out.push(["Planned",planned.n,outNum(planned.cost),outNum(planned.ret),outPct(planned.roi)]);
  out.push([]);
  out.push(["* Values rounded to nearest integer"]);
  out.push(["Exported",outStamp()]);
  out.push(["Version",APP_VERSION]);
  out.push(["View",basic?"Basic":"Advanced"]);
  return out;
}
function exportInvestmentsTable(){ downloadTable(`torn-investments-${outStamp()}.tsv`,investmentsTableRows()) }

// The whole plan, every page of it, not just the one on screen.
function planTableRows(){
  const order=window.planStepOrder||[], index=window.planStepIndex||{};
  const period=planReturnPeriodLabel();
  const out=[];
  out.push(["Step","Ticker","Investment","Increment","Status","Sell to acquire","Cost*",
            ...PAID_SOURCES.map(k=>`Paid with: ${PAID_LABELS[k]}*`),
            `Return (${period})*`,"ROI (%)*","Time until purchase","Day*","Nested under"]);
  order.forEach((occ,i)=>{
    const s=index[occ];
    if(!s) return;
    const status=s.unreachable?"beyond 100 years"
      :s.sellFirst?(s.done?"sold":"sell first")
      :s.sellHolding?(s.done?"sold":"sell")
      :s.done?"owned"
      :s.parking?"parking":"to buy";
    out.push([
      i+1, s.row.ticker, s.row.name, outIncrement(s.row), status,
      s.bankNote||(s.sold&&s.sold.length?s.sold.map(sellLabelPlain).join(" + "):""),
      outNum(s.row.cost),
      ...PAID_SOURCES.map(k=>outNum(s.paidWith?s.paidWith[k]:null)),
      outNum(planReturnValue(s.row)), outPct(s.row.roi),
      s.unreachable?"":(s.day===0?"now":formatDuration(Math.ceil(s.day))),
      s.unreachable?"":outNum(s.day), s.parentName||""
    ]);
  });
  out.push([]);
  out.push(["Path",$("planGoal")?.selectedOptions[0]?.textContent||""]);
  out.push(["Increments",$("planIncMax")?.value||""]);
  out.push(["Available capital",outNum(numVal("capital"))]);
  out.push(["Daily investment budget",outNum(numVal("dailyBudget"))]);
  // Enough of the configuration to rebuild the same run from the file alone,
  // which is what makes a plan export usable as a bug report.
  out.push(["City Bank",cityBankEnabled()?"on":"off"]);
  out.push(["Cayman",caymanEnabled()?"on":"off"]);
  out.push(["TCI",$("planTci")?.value||""]);
  out.push(["Bank payout",outNum(numVal("planBankAmount")),
            "days left",outNum(numVal("planBankDays")),
            "term",outNum(planBankTerm())]);
  out.push(["Situational stocks ticked",[...prioritisedTickers()].sort().join(" ")||"none"]);
  out.push(["Marked owned",[...window.ownedRows].sort().join(" ")||"none"]);
  out.push(["Marked skipped",[...window.skippedRows].sort().join(" ")||"none"]);
  out.push(["Ticked to plan",[...window.selectedRows].sort().join(" ")||"none"]);
  out.push(["* Values rounded to nearest integer"]);
  out.push(["Exported",outStamp()]);
  out.push(["Version",APP_VERSION]);
  return out;
}
function exportPlanTable(){ downloadTable(`torn-plan-${outStamp()}.tsv`,planTableRows()) }

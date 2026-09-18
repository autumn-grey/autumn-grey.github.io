/* ============================================================================
   SCRIPTS PAGE
   The list lives in scripts.json at the repo root, fetched at page open. Two
   views come out of the same render: everyone sees title-and-description
   panels, and the owner also sees the edit chrome.

   Saving writes scripts.json back through the GitHub contents API with a
   fine-grained token the owner pastes in once. The site is static, so this is
   the only way a change made in the browser reaches the repo. When there is no
   token, or the write fails, the change is held in localStorage as an
   unpublished draft rather than being thrown away, and the status line says so.
   ========================================================================= */
const SCRIPTS_OWNER_ID=4386333;
const SCRIPTS_FILE="scripts.json";
const SCRIPTS_REPO="autumn-grey/autumn-grey.github.io";
const SCRIPTS_BRANCH="main";
const SCRIPTS_DRAFT_KEY="tornInvScriptsDraft";
const SCRIPTS_TOKEN_KEY="tornInvGhToken";

window.scriptsList=[];          // the panels, in display order
window.scriptsLoaded=false;
window.scriptsEditing=false;
window.scriptsEditingId=null;   // the one panel currently showing its form
window.scriptsDirty=false;      // local changes not yet in the repo

const isScriptsOwner=()=>+(window.userId||0)===SCRIPTS_OWNER_ID;
const scriptsById=id=>window.scriptsList.find(s=>s.id===id)||null;
const newScriptId=()=>"s"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function scriptsStatus(msg,kind){
  const el=$("scriptsStatus");
  if(!el) return;
  el.textContent=msg||"";
  el.className="scripts-status"+(kind?" "+kind:"");
}

/* ---- Storage ------------------------------------------------------------ */
function scriptsToken(){
  try{ return localStorage.getItem(SCRIPTS_TOKEN_KEY)||"" }
  catch(e){ return "" }
}
function saveScriptsDraft(){
  window.scriptsDirty=true;
  try{ localStorage.setItem(SCRIPTS_DRAFT_KEY,JSON.stringify(window.scriptsList)) }
  catch(e){ logProblem("The script list draft could not be saved locally",e) }
}
function clearScriptsDraft(){
  window.scriptsDirty=false;
  try{ localStorage.removeItem(SCRIPTS_DRAFT_KEY) }
  catch(e){ /* nothing stored means nothing to clear */ }
}

/** Normalises whatever came back, so one bad entry can't take the page down. */
function normaliseScripts(raw){
  const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.scripts)?raw.scripts:[]);
  return arr.map(x=>({
    id:String(x?.id||newScriptId()),
    title:String(x?.title||"").trim(),
    url:String(x?.url||"").trim(),
    description:String(x?.description||"").trim(),
    // Anything not explicitly finished is treated as still in progress, so an
    // entry written before this existed shows orange rather than claiming to
    // be done.
    status:String(x?.status||"").toLowerCase()==="live"?"live":"wip",
    // Last known Greasy Fork answer. Baked in so the page draws straight away
    // and still reads sensibly if Greasy Fork is unreachable.
    meta:x?.meta&&typeof x.meta==="object"?{
      name:String(x.meta.name||""),version:String(x.meta.version||""),
      created:String(x.meta.created||""),updated:String(x.meta.updated||""),
    }:null,
  })).filter(x=>x.title||x.url||x.description);
}

/** Greasy Fork script id out of any of its URL shapes, including the localised
    ones (/en/scripts/…). Anything else is not a Greasy Fork link. */
function greasyForkId(url){
  const m=/greasyfork\.org\/(?:[a-z]{2}(?:-[A-Za-z]+)?\/)?scripts\/(\d+)/i.exec(String(url||""));
  return m?m[1]:null;
}

/** The bits of the Greasy Fork record this page shows. Dates are kept as
    YYYY-MM-DD because that is how they are displayed and it sorts properly. */
async function fetchGreasyForkMeta(url){
  const id=greasyForkId(url);
  if(!id) return null;
  const res=await fetch(`https://greasyfork.org/scripts/${id}.json`,{cache:"no-cache"});
  if(!res.ok) throw new Error("Greasy Fork answered "+res.status);
  const j=await res.json();
  return {
    name:String(j?.name||"").trim(),
    version:String(j?.version||"").trim(),
    created:String(j?.created_at||"").slice(0,10),
    updated:String(j?.code_updated_at||"").slice(0,10),
  };
}

/** What the panel heading reads. A title typed by hand always wins; an empty
    one falls back to the Greasy Fork name and version, and to the bare URL
    when there is nothing else to go on. */
function scriptDisplayTitle(s){
  if(s.title) return s.title;
  if(s.meta?.name) return s.meta.name+(s.meta.version?" - v "+s.meta.version:"");
  return s.url||"Untitled";
}

/** Re-reads Greasy Fork for every entry that has one, after the page has
    already drawn. Version and dates then follow a script's own releases
    without the panel being opened and saved again. Display only: the repo copy
    is refreshed the next time a panel is saved, so a failed fetch here changes
    nothing and is not worth reporting. */
async function refreshScriptsMeta(){
  const targets=window.scriptsList.filter(s=>greasyForkId(s.url));
  if(!targets.length) return;
  const results=await Promise.all(targets.map(async s=>{
    try{ return [s,await fetchGreasyForkMeta(s.url)] }
    catch(e){ return [s,null] }
  }));
  let changed=false;
  results.forEach(([s,meta])=>{
    if(!meta) return;
    if(JSON.stringify(s.meta)!==JSON.stringify(meta)){ s.meta=meta; changed=true }
  });
  if(changed) renderScripts();
}

/** Fetches scripts.json once per page load. A draft, if the owner has one,
    wins over the repo copy, because it is the newer of the two. */
async function loadScripts(){
  if(window.scriptsLoaded) return;
  window.scriptsLoaded=true;
  try{
    // cache:no-cache, or Pages serves a stale copy straight after a publish.
    const res=await fetch(SCRIPTS_FILE+"?v="+Date.now(),{cache:"no-cache"});
    if(!res.ok) throw new Error("scripts.json answered "+res.status);
    window.scriptsList=normaliseScripts(await res.json());
  }catch(e){
    window.scriptsList=[];
    logProblem("The script list could not be loaded",e);
    scriptsStatus("The script list could not be loaded.","err");
  }
  if(isScriptsOwner()){
    try{
      const draft=JSON.parse(localStorage.getItem(SCRIPTS_DRAFT_KEY)||"null");
      if(Array.isArray(draft)&&draft.length!==undefined){
        window.scriptsList=normaliseScripts(draft);
        window.scriptsDirty=true;
        scriptsStatus("Showing unpublished local changes. Press Publish to write them to the repo.");
      }
    }catch(e){ logProblem("The saved script draft could not be read",e) }
  }
  renderScripts();
  refreshScriptsMeta();
}

/* ---- Rendering ---------------------------------------------------------- */
function scriptCardHtml(s){
  const cls="script-title "+(s.status==="live"?"live":"wip");
  const shown=scriptDisplayTitle(s);
  // Escaping keeps the attribute intact, but a "javascript:" URL would still
  // run on click, so a panel only links out to the web.
  const href=/^https?:\/\//i.test(String(s.url||""))?s.url:"";
  const link=href
    ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(shown)}</a>`
    : `<span class="${cls}" style="text-decoration:none">${esc(shown)}</span>`;
  const dates=(s.meta?.created||s.meta?.updated)
    ? `<p class="script-dates">${s.meta.created?`<span>Created: ${esc(s.meta.created)}</span>`:""}${
        s.meta.updated?`<span>Updated: ${esc(s.meta.updated)}</span>`:""}</p>`
    : "";
  return `<div class="script-card" data-id="${esc(s.id)}">
    <div class="script-card-head">
      <div>${link}</div>
      <div class="script-card-tools scripts-edit-only">
        <button type="button" class="icon-btn" data-act="edit" data-id="${esc(s.id)}"
                title="Edit this script" aria-label="Edit this script">&#9998;</button>
        <button type="button" class="icon-btn danger" data-act="del" data-id="${esc(s.id)}"
                title="Delete this script" aria-label="Delete this script">&minus;</button>
      </div>
    </div>
    ${s.description?`<p class="script-desc">${esc(s.description)}</p>`:""}
    ${dates}
  </div>`;
}

function scriptFormHtml(s){
  return `<div class="script-card" data-id="${esc(s.id)}">
    <div class="script-form">
      <div>
        <label for="sfTitle">Title</label>
        <input id="sfTitle" type="text" value="${esc(s.title)}"
               placeholder="Leave empty to use the Greasy Fork name and version">
      </div>
      <div>
        <label for="sfUrl">URL</label>
        <input id="sfUrl" type="url" value="${esc(s.url)}" placeholder="https://…" spellcheck="false">
      </div>
      <div>
        <label for="sfDesc">Description</label>
        <textarea id="sfDesc" placeholder="What it does">${esc(s.description)}</textarea>
      </div>
      <div class="script-status">
        <label><input type="radio" name="sfStatus" value="wip"${s.status!=="live"?" checked":""}> WIP</label>
        <label><input type="radio" name="sfStatus" value="live"${s.status==="live"?" checked":""}> Live</label>
      </div>
      <div class="script-form-buttons">
        <button type="button" class="btn primary" data-act="save" data-id="${esc(s.id)}">Save</button>
        <button type="button" class="btn" data-act="cancel" data-id="${esc(s.id)}">Cancel</button>
      </div>
    </div>
  </div>`;
}

function renderScripts(){
  const list=$("scriptsList");
  if(!list) return;
  document.body.classList.toggle("scripts-owner",isScriptsOwner());
  document.body.classList.toggle("scripts-editing",window.scriptsEditing&&isScriptsOwner());
  const toggle=$("scriptsEditToggle");
  if(toggle) toggle.textContent=window.scriptsEditing?"Done":"Edit";
  if(!window.scriptsList.length){
    list.innerHTML=`<div class="scripts-empty">Nothing here yet.</div>`;
    return;
  }
  list.innerHTML=window.scriptsList.map(s=>
    s.id===window.scriptsEditingId?scriptFormHtml(s):scriptCardHtml(s)).join("");
  // Reordering is an edit-mode idea, and a panel being edited must stay put
  // while its fields are focused, so it is the one card left undraggable.
  if(window.scriptsEditing&&isScriptsOwner()){
    list.querySelectorAll(".script-card").forEach(card=>{
      if(card.dataset.id===window.scriptsEditingId) return;
      card.draggable=true;
      card.classList.add("draggable");
    });
  }
}

/* ---- Editing ------------------------------------------------------------ */
function setScriptsEditing(on){
  window.scriptsEditing=!!on&&isScriptsOwner();
  if(!window.scriptsEditing) window.scriptsEditingId=null;
  renderScripts();
}

function addScript(){
  if(!isScriptsOwner()) return;
  const s={id:newScriptId(),title:"",url:"",description:"",status:"wip",meta:null,isNew:true};
  window.scriptsList.push(s);
  window.scriptsEditing=true;
  window.scriptsEditingId=s.id;
  renderScripts();
  $("sfTitle")?.focus();
}

/** Save on a panel: take the fields, then push the whole list to the repo. */
async function saveScriptPanel(id){
  const s=scriptsById(id);
  if(!s) return;
  const title=$("sfTitle")?.value.trim()||"";
  const url=$("sfUrl")?.value.trim()||"";
  const desc=$("sfDesc")?.value.trim()||"";
  if(!title&&!url){ scriptsStatus("A script needs at least a title or a URL.","err"); return }
  s.title=title; s.url=url; s.description=desc;
  s.status=document.querySelector('input[name="sfStatus"]:checked')?.value==="live"?"live":"wip";
  delete s.isNew;
  // Read once here so the repo copy carries a name, version and dates of its
  // own. A link that is not a Greasy Fork one simply has none, and a title
  // typed by hand still stands whatever comes back.
  if(greasyForkId(url)){
    scriptsStatus("Reading Greasy Fork…");
    try{ s.meta=await fetchGreasyForkMeta(url) }
    catch(e){
      logProblem("Greasy Fork could not be read for "+(title||url),e);
      scriptsStatus("Greasy Fork could not be read, so the name and dates are unchanged.","err");
    }
  }else s.meta=null;
  window.scriptsEditingId=null;
  saveScriptsDraft();
  renderScripts();
  await publishScripts("Update "+(title||"script")+" in scripts.json");
}

/** Cancel: a panel that was never saved goes away entirely, rather than being
    left as an empty card nobody asked for. */
function cancelScriptPanel(id){
  const s=scriptsById(id);
  if(s&&s.isNew) window.scriptsList=window.scriptsList.filter(x=>x.id!==id);
  window.scriptsEditingId=null;
  renderScripts();
  scriptsStatus("");
}

async function deleteScript(id){
  const s=scriptsById(id);
  if(!s) return;
  window.scriptsList=window.scriptsList.filter(x=>x.id!==id);
  if(window.scriptsEditingId===id) window.scriptsEditingId=null;
  saveScriptsDraft();
  renderScripts();
  await publishScripts("Remove "+(s.title||"script")+" from scripts.json");
}

/* ---- The floating confirm ----------------------------------------------- */
let scriptsConfirmResolve=null;
function askScriptsConfirm(text){
  const box=$("scriptsConfirm");
  if(!box) return Promise.resolve(false);
  $("scriptsConfirmText").textContent=text;
  box.hidden=false;
  $("scriptsConfirmNo")?.focus();
  return new Promise(res=>{ scriptsConfirmResolve=res });
}
function closeScriptsConfirm(answer){
  const box=$("scriptsConfirm");
  if(box) box.hidden=true;
  const res=scriptsConfirmResolve;
  scriptsConfirmResolve=null;
  if(res) res(answer);
}
$("scriptsConfirmYes")?.addEventListener("click",()=>closeScriptsConfirm(true));
$("scriptsConfirmNo")?.addEventListener("click",()=>closeScriptsConfirm(false));
$("scriptsConfirm")?.addEventListener("click",e=>{
  if(e.target===$("scriptsConfirm")) closeScriptsConfirm(false);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&scriptsConfirmResolve) closeScriptsConfirm(false);
});

/* ---- Publishing to the repo --------------------------------------------- */
/** btoa only speaks latin-1, so the JSON is encoded to UTF-8 bytes first.
    Without this a single curly quote in a description breaks the commit. */
function b64utf8(str){
  const bytes=new TextEncoder().encode(str);
  let bin="";
  bytes.forEach(b=>{ bin+=String.fromCharCode(b) });
  return btoa(bin);
}

function scriptsFileBody(){
  return JSON.stringify({
    version:1,
    updated:new Date().toISOString().slice(0,10),
    scripts:window.scriptsList.map(({id,title,url,description,status,meta})=>
      ({id,title,url,description,status,meta:meta||null})),
  },null,2)+"\n";
}

async function publishScripts(message){
  if(!isScriptsOwner()) return false;
  const token=scriptsToken();
  if(!token){
    scriptsStatus("Saved in this browser. Add a GitHub token above to publish it to the repo.","err");
    return false;
  }
  scriptsStatus("Publishing…");
  const url=`https://api.github.com/repos/${SCRIPTS_REPO}/contents/${SCRIPTS_FILE}`;
  const headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json",
                 "X-GitHub-Api-Version":"2022-11-28"};
  try{
    // The sha of the copy being replaced is required, and is read fresh each
    // time so a change made elsewhere is a clean 409 rather than a silent
    // overwrite of someone else's commit.
    let sha=null;
    const cur=await fetch(url+"?ref="+SCRIPTS_BRANCH,{headers});
    if(cur.ok) sha=(await cur.json()).sha;
    else if(cur.status===401||cur.status===403) throw new Error("the token was refused ("+cur.status+")");
    else if(cur.status!==404) throw new Error("GitHub answered "+cur.status);
    const res=await fetch(url,{
      method:"PUT",headers:{...headers,"Content-Type":"application/json"},
      body:JSON.stringify({message,content:b64utf8(scriptsFileBody()),branch:SCRIPTS_BRANCH,
                           ...(sha?{sha}:{})}),
    });
    if(!res.ok){
      const detail=await res.json().catch(()=>({}));
      throw new Error((detail.message||"GitHub answered "+res.status)
        +(res.status===409?" — the file changed in the repo, reload and redo this":""));
    }
    clearScriptsDraft();
    scriptsStatus("Published. The live site updates within a minute or so.","ok");
    return true;
  }catch(e){
    logProblem("The script list could not be published",e);
    scriptsStatus("Saved in this browser but not published: "+(e.message||"the request failed")+".","err");
    return false;
  }
}

/* ---- Wiring ------------------------------------------------------------- */
$("scriptsEditToggle")?.addEventListener("click",()=>{
  setScriptsEditing(!window.scriptsEditing);
  if(window.scriptsEditing){
    const t=$("scriptsToken");
    if(t) t.value=scriptsToken();
    if(window.scriptsDirty) scriptsStatus("There are unpublished local changes.","err");
  }else scriptsStatus("");
});
$("scriptsAdd")?.addEventListener("click",addScript);
$("scriptsTokenSave")?.addEventListener("click",async()=>{
  const v=$("scriptsToken")?.value.trim()||"";
  try{
    if(v) localStorage.setItem(SCRIPTS_TOKEN_KEY,v);
    else localStorage.removeItem(SCRIPTS_TOKEN_KEY);
  }catch(e){ logProblem("The GitHub token could not be stored",e) }
  scriptsStatus(v?"Token saved in this browser.":"Token cleared.",v?"ok":null);
  // A token arriving after a failed save is almost always someone trying to
  // get an earlier change out, so push it now rather than making them redo it.
  if(v&&window.scriptsDirty) await publishScripts("Update scripts.json");
});
$("scriptsTokenForget")?.addEventListener("click",()=>{
  try{ localStorage.removeItem(SCRIPTS_TOKEN_KEY) }catch(e){ /* already gone */ }
  const t=$("scriptsToken");
  if(t) t.value="";
  scriptsStatus("Token forgotten.");
});

// One listener for every panel button, because the panels are re-rendered.
$("scriptsList")?.addEventListener("click",async e=>{
  const btn=e.target.closest("[data-act]");
  if(!btn||!isScriptsOwner()) return;
  const id=btn.dataset.id;
  if(btn.dataset.act==="edit"){ window.scriptsEditingId=id; renderScripts(); $("sfTitle")?.focus() }
  else if(btn.dataset.act==="save") await saveScriptPanel(id);
  else if(btn.dataset.act==="cancel") cancelScriptPanel(id);
  else if(btn.dataset.act==="del"){
    const s=scriptsById(id);
    const ok=await askScriptsConfirm(`Delete "${s?.title||"this script"}"? This cannot be undone.`);
    if(ok) await deleteScript(id);
  }
});

/* Drag to reorder. Plain HTML5 drag and drop: the card being dragged is
   remembered by id, and the card under the pointer shows a line on whichever
   half the drop would land in. */
let scriptsDragId=null;
const clearDropMarks=()=>document.querySelectorAll(".script-card")
  .forEach(c=>c.classList.remove("drop-before","drop-after"));
$("scriptsList")?.addEventListener("dragstart",e=>{
  const card=e.target.closest(".script-card");
  if(!card||!card.draggable) return;
  scriptsDragId=card.dataset.id;
  card.classList.add("dragging");
  e.dataTransfer.effectAllowed="move";
  // Firefox refuses to start a drag unless something is set.
  try{ e.dataTransfer.setData("text/plain",scriptsDragId) }catch(err){ /* optional */ }
});
$("scriptsList")?.addEventListener("dragover",e=>{
  if(!scriptsDragId) return;
  const card=e.target.closest(".script-card");
  if(!card||card.dataset.id===scriptsDragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect="move";
  const r=card.getBoundingClientRect();
  const after=e.clientY>r.top+r.height/2;
  clearDropMarks();
  card.classList.add(after?"drop-after":"drop-before");
});
$("scriptsList")?.addEventListener("dragleave",e=>{
  if(!e.relatedTarget||!$("scriptsList").contains(e.relatedTarget)) clearDropMarks();
});
$("scriptsList")?.addEventListener("drop",async e=>{
  if(!scriptsDragId) return;
  e.preventDefault();
  const card=e.target.closest(".script-card");
  clearDropMarks();
  if(!card||card.dataset.id===scriptsDragId) return;
  const from=window.scriptsList.findIndex(s=>s.id===scriptsDragId);
  if(from<0) return;
  const [moved]=window.scriptsList.splice(from,1);
  // The target index is read after the removal, so it is already correct for
  // the shortened list and needs no adjusting for which way the card moved.
  let to=window.scriptsList.findIndex(s=>s.id===card.dataset.id);
  const r=card.getBoundingClientRect();
  if(e.clientY>r.top+r.height/2) to+=1;
  window.scriptsList.splice(to,0,moved);
  scriptsDragId=null;
  saveScriptsDraft();
  renderScripts();
  await publishScripts("Reorder scripts.json");
});
$("scriptsList")?.addEventListener("dragend",()=>{
  scriptsDragId=null;
  clearDropMarks();
  document.querySelectorAll(".script-card.dragging").forEach(c=>c.classList.remove("dragging"));
});

/** Called once the API check knows who you are, so the Edit button appears
    without needing the page reopened. */
function syncScriptsOwner(){
  document.body.classList.toggle("scripts-owner",isScriptsOwner());
  // A draft is only ever read for the owner, and the page can have loaded
  // before the id was known, so the load is redone once rather than leaving a
  // stale repo copy on screen over the top of newer local changes.
  if(isScriptsOwner()&&window.scriptsLoaded&&!window.scriptsDirty){
    window.scriptsLoaded=false;
    loadScripts();
    return;
  }
  if($("pageScripts")&&!$("pageScripts").hidden) renderScripts();
}

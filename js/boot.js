// Basic is the default view; Advanced only sticks if it was saved.
try{setView(localStorage.getItem("tornInvView")!=="advanced")}
catch(e){ logProblem("Saved view mode could not be read. Basic used",e); setView(true) }
setPage(location.hash.replace("#","")||"investments");
syncToTop();

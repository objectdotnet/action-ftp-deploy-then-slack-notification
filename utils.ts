function empty(what : string, minlen = 1) : boolean {
  return what == undefined || what == null || what == "" || what.length < minlen;
}

function trimSlashes(what: string) {
  if (what.startsWith("/")) what = what.replace(/^\/+/, "");
  if (what.endsWith("/")) what = what.replace(/\/+$/, "");

  return what;
}

export { empty, trimSlashes };
// tpl.js：占位符扫描与替换（双大括号成对包住键名）
export function scanPlaceholders(text) {
  const source = String(text == null ? "" : text);
  const keys = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "{" && source[i + 1] === "{") {
      const end = source.indexOf("}}", i + 2);
      if (end === -1) return { keys: keys, balanced: false };
      keys.push(source.slice(i + 2, end));
      i = end + 2;
    } else {
      i += 1;
    }
  }
  return { keys: keys, balanced: true };
}

export function keysOf(text) {
  return scanPlaceholders(text).keys;
}

export function fillOf(text, pairs) {
  const source = String(text == null ? "" : text);
  const values = new Map();
  if (Array.isArray(pairs)) {
    for (const pair of pairs) {
      if (Array.isArray(pair) && pair.length >= 2) values.set(String(pair[0]), pair[1]);
    }
  }
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "{" && source[i + 1] === "{") {
      const end = source.indexOf("}}", i + 2);
      if (end === -1) {
        out += source.slice(i);
        break;
      }
      const key = source.slice(i + 2, end);
      out += values.has(key) ? String(values.get(key)) : "{{" + key + "}}";
      i = end + 2;
    } else {
      out += source[i];
      i += 1;
    }
  }
  return out;
}

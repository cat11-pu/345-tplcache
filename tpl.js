// tpl.js：双大括号占位符扫描与替换（原生实现，零依赖）
function scan(text) {
  const keys = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      const end = text.indexOf("}}", i + 2);
      if (end === -1) {
        return { keys: keys, balanced: false };
      }
      keys.push(text.slice(i + 2, end));
      i = end + 2;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      return { keys: keys, balanced: false };
    } else {
      i += 1;
    }
  }
  return { keys: keys, balanced: true };
}

export function keysOf(text) {
  if (typeof text !== "string") {
    return [];
  }
  return scan(text).keys;
}

export function fillOf(text, pairs) {
  if (typeof text !== "string") {
    return text;
  }
  const values = new Map();
  const list = Array.isArray(pairs) ? pairs : [];
  for (const pair of list) {
    if (Array.isArray(pair) && pair.length >= 1) {
      values.set(String(pair[0]), pair[1]);
    }
  }
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      const end = text.indexOf("}}", i + 2);
      if (end === -1) {
        out += text.slice(i);
        break;
      }
      const key = text.slice(i + 2, end);
      if (values.has(key)) {
        out += String(values.get(key));
      } else {
        out += text.slice(i, end + 2);
      }
      i = end + 2;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

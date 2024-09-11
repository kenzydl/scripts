// ==UserScript==
// @name         [PCSG00468] Kokuchou no Psychedelica (黒蝶のサイケデリカ)
// @version      1.00
// @author       Mansive
// @description  Vita3K
// * STING
// * Otomate & Idea Factory Co., Ltd.
// ==/UserScript==
const { setHook } = require("./libVita3k.js");

const mainHandler = trans.send(handler, "200+"); // join 200ms

setHook({
  0x80043538: mainHandler.bind_(null, 1, "text"),
});

function handler(regs, index, hookname) {
  const address = regs[index].value;

  console.log("onEnter: ", hookname);
  // console.log(hexdump(address, { header: false, ansi: false, length: 0x50 }));

  let s = address
    .readUtf8String()
    .replace(/\\n\u3000*|\\k/gu, "") // remove escape characters and fullwidth whitespace
    .replace(/\[|\*[^\]]+]/g, "") // remove furigana '災いを[齎*もたら]す' to '災いを齎す'
    .replace(/×/g, ""); // remove weird symbol appearing after player name

  return s;
}
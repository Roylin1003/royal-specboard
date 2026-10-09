/* 實況擷取器（基板配件，2026-09-15）——在任何跑著的網頁遊戲 console 貼上執行，
   把「看得到的版面」抄成工作臺 DSL。用途：把真實專案的現況帶進 spec-board
   檢視、標註、討論（Roy：「把 Eden-Defender 的版面帶進來」）。

   用法：F12 console 貼上整份 → 回傳 DSL 文字（同時 copy 到剪貼簿若環境允許）。
   參數可改：CANVAS_W/H＝該專案的設計解析度；視窗開成同尺寸擷取最準。 */
/* v4：抽成可呼叫函式 window.snapshotCapture(W,H)——Royal SpecBoard 的
   「載入工作臺目前版面」與 console 貼上共用同一份邏輯（複製可以，分岔不行）。
   檔尾保留 auto-run(2560,1440)，console 用法不變。 */
window.snapshotCapture = function(CANVAS_W, CANVAS_H){
  const sx = CANVAS_W / innerWidth, sy = CANVAS_H / innerHeight;
  const toHex = c => {
    const m = c.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
    if (!m) return null;
    if (m[4] !== undefined && +m[4] === 0) return null;           // 全透明＝沒有底色
    return '#' + [m[1],m[2],m[3]].map(v=>(+v|0).toString(16).padStart(2,'0')).join('').toUpperCase();
  };
  const esc = t => t.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r?\n/g,'\\n'); // v7.4：換行必跳脫——否則多行值把 DSL 撐斷成注入
  const seen = new Set(); let n = 1;
  const idOf = el => {
    let base = el.id || (el.className && String(el.className).split(/\s+/)[0]) || el.tagName.toLowerCase();
    base = base.replace(/[^a-zA-Z0-9_]/g,'').slice(0,18) || 'el';
    let id = base; while (seen.has(id)) id = base + (n++);
    seen.add(id); return id;
  };
  const lines = ['// 實況擷取：' + location.href + '（' + new Date().toISOString().slice(0,10) + '）',
                 `#canvas w=${CANVAS_W} h=${CANVAS_H} bg=#0E1116 grid=8`];
  const walk = (el, depth) => {
    if (depth > 8 || lines.length > 220) return; // 上限放寬：自畫像 92 件曾被 90 截斷（v5）
    for (const c of el.children){
      const cs = getComputedStyle(c);
      if (cs.display==='none' || cs.visibility==='hidden' || +cs.opacity===0) continue;
      const r = c.getBoundingClientRect();
      const w = r.width*sx, h = r.height*sy;
      const fill = toHex(cs.backgroundColor);
      /* v7：單邊框（欄位標籤的 border-right 分隔線）也算——stroke 畫全框是近似 */
      const bSide = ['Top','Right','Bottom','Left'].find(d=>parseFloat(cs['border'+d+'Width'])>0.5 && toHex(cs['border'+d+'Color']));
      const hasBorder = !!bSide;
      /* 自己直接持有的文字（不含子元素的） */
      /* v3（跨 AI 讀取實驗的修正）：混排容器（自己有字、又有帶字的子元素）的
         own 是被 span 挖走後的殘句（「船艦 ，羅勃自動採礦。」）——這種父容器
         不抄字，讓子元素各自帶字；純文字容器照抄。 */
      const kidsHaveText = [...c.children].some(k=>k.textContent.trim());
      /* v5：表單元件的「值」不是文字節點——input/textarea 讀 value（退而求其次
         placeholder），select 讀選中項的顯示文字。否則自畫像裡所有欄位都是空盒。 */
      const own = c.type==='color' ? ''  /* v5.1：色彩選擇器的值是顏色不是文字，入 fill（見下） */
                : /^(INPUT|TEXTAREA)$/.test(c.tagName) ? (c.value || c.placeholder || '').trim()
                : c.tagName==='SELECT' ? (c.selectedOptions[0]?.textContent || '').trim()
                : c.children.length===0 ? c.textContent.trim()
                : [...c.childNodes].filter(nd=>nd.nodeType===3).map(nd=>nd.textContent.trim()).join(' ').trim();
      /* v7：v3 曾在「子元素也有字」時清空父 own（治 Eden 殘句），但把「對齊與分布　
         <span>未選取</span>」這類完整前綴也殺了。照 Roy「寧多勿漏」定調恢復——
         殘句認了，漏字不行。 */
      /* 收「有面孔」的元素：有底色、有框、canvas/img/button，**或自己有字**——
         v1 漏了無底無框的純文字件（標題、說明），整類補回（Roy：並不是所有元件都抓取了） */
      /* v5：有字的元素最小高放寬到 10——10px 的小標籤（章節 lbl）曾被 16 門檻刷掉 */
      const fill2 = (c.type==='color' && c.value) ? c.value.toUpperCase() : fill; // 色塊入 fill
      const minH = own ? 10 : 16;
      /* v6.1：有底色的小色塊（色票 20×20）曾被寬 24 門檻刷掉——有面孔就放寬 */
      const minW = (fill2 || own) ? 12 : 24;
      const visible = w>=minW && h>=minH && r.bottom>0 && r.right>0 && r.top<innerHeight && r.left<innerWidth;
      if (visible && (fill2 || hasBorder || own || /^(CANVAS|IMG|BUTTON|INPUT|SELECT)$/.test(c.tagName))){
        /* v7.1：內距折入只給「靠左對齊＋無底色」的純文字標籤——v7 曾把按鈕
           （有底色、置中）也折掉 20px，盒變短、字被擠成兩行（Roy：「所有按鈕
           似乎都短了一點所以字都被擠起來啦」）。盒與字共用一顆矩形，
           折內距等於改盒——只有字貼邊的標籤值得付這個代價。 */
        const rawPadL = (parseFloat(cs.paddingLeft)||0)*sx, rawPadR = (parseFloat(cs.paddingRight)||0)*sx;
        const leftText = own && /^(left|start)$/.test(cs.textAlign);
        /* v7.3：兩件式條件擴到「有底色/框、靠左、有內距」的文字件（select「自訂」
           那族——v7.1 因有底不折，字貼死左框）。單件折入只留給無底無框的純標籤。 */
        const twoPiece = leftText && (rawPadL>0.5 || rawPadR>0.5) && (fill2 || bSide);
        const doFold = leftText && !fill2 && !bSide;
        const padL = doFold ? rawPadL : 0;
        const padR = doFold ? rawPadR : 0;
        const x = Math.round(r.left*sx + padL), y = Math.round(r.top*sy);
        /* v7.2（Roy：標籤的框其實是對齊底下輸入框的區塊線，不是緊貼字的小框）：
           「折入標籤」若帶框——拆兩件：盒歸盒（原尺寸，框線對齊鄰件）、
           字歸字（折入定位，無框無底）。一顆矩形扛不動的，就用兩顆。 */
        if (twoPiece){
          const bid = idOf(c);
          const box = `rect id=${bid} x=${Math.round(r.left*sx)} y=${y} w=${Math.round(w)} h=${Math.round(h)} fill=${fill2||'none'}` +
            (bSide ? ` stroke=${toHex(cs['border'+bSide+'Color'])}` : '') +
            ((parseFloat(cs.borderRadius)||0)>0.5 ? ` r=${Math.round(parseFloat(cs.borderRadius)*sx)}` : '');
          lines.push(box);
          const fs2 = Math.round(parseFloat(cs.fontSize)*sy);
          if (own.length<=40)  // v7.4：兩件式漏了長度上限——spec 文字框整肚子規格曾被塞進 body
          lines.push(`rect id=${bid}_t x=${Math.round(r.left*sx+rawPadL)} y=${y} w=${Math.round(w-rawPadL-rawPadR)} h=${Math.round(h)} fill=none body="${esc(own)}" size=${fs2} color=${toHex(cs.color)||'#F2F4F7'} align=left valign=middle`);
          walk(c, depth+1); continue;
        }
        let t = `rect id=${idOf(c)} x=${x} y=${y} w=${Math.round(w-padL-padR)} h=${Math.round(h)} fill=${fill2||'none'}`;
        const bc = hasBorder ? toHex(cs['border'+bSide+'Color']) : null;
        if (bc && bc !== fill2) t += ` stroke=${bc}`;   // v6：框線入譜（同色免記）
        const opv = Math.round(parseFloat(cs.opacity)*100);
        if (opv < 100) t += ` op=${opv}`;               // v6：disabled 的 35% 透明度
        const rad = parseFloat(cs.borderRadius); if (rad>0.5) t += ` r=${Math.round(rad*sx)}`;
        if (own && own.length<=40){
          const fs = Math.round(parseFloat(cs.fontSize)*sy);
          const al = {left:'left',center:'center',right:'right',start:'left',end:'right'}[cs.textAlign]||'left';
          t += ` body="${esc(own)}" size=${fs} color=${toHex(cs.color)||'#F2F4F7'} align=${al} valign=middle`;
        }
      lines.push(t);
      }
      walk(c, depth+1);
    }
  };
  walk(document.body, 0);
  return lines.join(String.fromCharCode(10));
};
(() => { const out = window.snapshotCapture(2560, 1440);
  try { navigator.clipboard.writeText(out); } catch {}
  return out; })();

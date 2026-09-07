/* =========================================================
 * ARQUIVO: js/icons.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Os ícones SVG de traço único usados em todo o app (lixeira, lápis,
 *   alfinete, engrenagem, calendário, etc). Cada ícone herda a cor do
 *   texto ao redor (currentColor), então não precisa de variação por tema.
 *
 * QUANDO É USADO
 *   Importado por qualquer módulo que renderize um ícone — ou seja,
 *   quase todos. O jeito de usar é `ICONS.trash`, `ICONS.pencil`, etc.
 *   (cada acesso gera o SVG na hora, via Proxy).
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Traços de cada ícone (ICON_SVG)
 *   2. Função que monta o <svg> completo a partir de um traço (svgIcon)
 *   3. Proxy que permite usar ICONS.nome em vez de svgIcon('nome')
 * ========================================================= */

export const ICON_SVG = {
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  pin: '<path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  utensils: '<path d="M6 2v7a2 2 0 0 0 4 0V2"/><path d="M8 9v13"/><path d="M17 2c-1.7 0-3 2-3 6s1.3 4 3 4"/><path d="M17 2v20"/>',
  bubble: '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-4a2 2 0 1 1 0-4h4a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M18 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  pill: '<rect x="2" y="8" width="20" height="8" rx="4"/><path d="M12 8v8"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
};
export function svgIcon(name){
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.14em">${ICON_SVG[name]}</svg>`;
}
export const ICONS = new Proxy({}, { get:(_,name)=> svgIcon(name) });

/* =========================================================
 * ARQUIVO: js/dates.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Funções de data e os nomes de meses/dias da semana usados em todo
 *   o app (formatar datas ISO, achar a segunda-feira de uma semana,
 *   somar dias, etc). Deliberadamente não importa nada de state.js —
 *   é a única forma de evitar uma dependência circular, já que
 *   state.js precisa dessas funções para montar os dados iniciais
 *   antes mesmo de qualquer outro módulo carregar.
 *
 * QUANDO É USADO
 *   Importado por praticamente todo módulo que lida com datas —
 *   incluindo o próprio state.js.
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Nomes de meses e dias da semana
 *   2. Conversões básicas (data → ISO, preencher com zero)
 *   3. Aritmética de datas (dia da semana de um mês, segunda-feira de
 *      uma semana, somar dias, dias em um mês)
 *   4. Formatação para exibição (rótulo de dia da semana, data por extenso)
 * ========================================================= */

/* ---------- nomes ---------- */
export const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const DOW_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
export const DOW_MINI = ['S','T','Q','Q','S','S','D'];

/* ---------- conversões básicas ---------- */
export function pad(n){ return String(n).padStart(2,'0'); }
export function isoDate(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function todayISO(){ return isoDate(new Date()); }

/* ---------- aritmética de datas ---------- */
export function mondayOf(date){
  const d = new Date(date);
  const dow = (d.getDay()+6)%7; // 0=Mon
  d.setDate(d.getDate()-dow);
  return isoDate(d);
}
export function addDays(iso, n){
  const d = new Date(iso+'T00:00:00');
  d.setDate(d.getDate()+n);
  return isoDate(d);
}
export function daysInMonth(year, month){ return new Date(year, month+1, 0).getDate(); }
export function firstWeekdayMon(year, month){
  const jsDow = new Date(year, month, 1).getDay(); // 0=Sun
  return (jsDow+6)%7; // 0=Mon
}
export function daysBetween(isoA, isoB){
  return Math.round((new Date(isoB+'T00:00:00') - new Date(isoA+'T00:00:00'))/86400000);
}

/* ---------- formatação ---------- */
export function weekdayLabel(iso){
  const d = new Date(iso+'T00:00:00');
  return DOW_SHORT[(d.getDay()+6)%7];
}
export function fmtLongDate(iso){
  const d = new Date(iso+'T00:00:00');
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}
export function timeToMinutes(hhmm){
  const parts = (hhmm||'08:00').split(':');
  return (parseInt(parts[0],10)||0)*60 + (parseInt(parts[1],10)||0);
}
export function minutesToHHMM(mins){
  mins = ((mins%1440)+1440)%1440;
  return pad(Math.floor(mins/60))+':'+pad(mins%60);
}

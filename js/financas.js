/* =========================================================
 * ARQUIVO: js/financas.js
 * ---------------------------------------------------------
 * DESCRIÇÃO
 *   Tudo relacionado a dinheiro: a seção de gastos do dia (visão Dia),
 *   e a área Financeiro inteira — Resumo, Entradas, Saídas, Cartões
 *   (lista, detalhe da fatura com compras parceladas) e Categorias
 *   (com o seletor customizado reaproveitado nos formulários).
 *
 * QUANDO É USADO
 *   renderDayFinance é chamado por calendario.js na visão Dia.
 *   renderFinance é chamado por nav.js quando
 *   state.mainSection==='financeiro' — e ela mesma decide qual sub-aba
 *   desenhar (Resumo/Entradas/Saídas/Cartões/Categorias).
 *
 * SUMÁRIO (blocos, na ordem em que aparecem abaixo)
 *   1. Seção "Gastos e recebimentos do dia" na visão Dia
 *   2. Helpers de cartão (getCard, categoryName, cálculo de fatura e
 *      parcelas)
 *   3. Modal de criar/editar cartão
 *   4. Modal de editar categoria + página de gerenciamento de
 *      categorias + o seletor customizado de categoria (usado nos
 *      formulários de lançamento e de compra no cartão)
 *   5. Modal de editar entrada/saída e modal de criar/editar compra
 *      no cartão
 *   6. Lista de cartões e detalhe da fatura de um cartão
 *   7. Roteador da área Financeiro (as 5 abas) + cálculo de totais por
 *      categoria (compartilhado entre Resumo e Entradas/Saídas)
 *   8. Aba Resumo
 *   9. Aba Entradas/Saídas (formulário de lançamento + tabela)
 * ========================================================= */

import { state, save } from './state.js';
import { todayISO, pad, MONTH_NAMES } from './dates.js';
import { ICONS } from './icons.js';
import {
  escapeHtml, fmtMoney, moneyInputFmt, moneyInputValue, attachMoneyMask,
  createCustomSelect, showInlineWarning
} from './utils.js';
import { closeDaySettingsModal } from './modal.js';
import { renderAll } from './nav.js';
import { refreshCurrentDay } from './calendario.js';

/* ---------- seção "Gastos e recebimentos do dia" (visão Dia) ---------- */
export function renderDayFinance(iso){
  const wrap = document.getElementById('dfList');
  const items = state.finance.filter(t=>t.date===iso);
  wrap.innerHTML = '';
  items.forEach(t=>{
    const row = document.createElement('div');
    row.className='df-row';
    row.innerHTML = `
      <span class="df-type-badge ${t.type}">${t.type==='in'?'+':'−'}</span>
      <span class="dfdesc-text">${escapeHtml(t.desc)}</span>
      <span class="df-value-text">${fmtMoney(t.value)}</span>
      <button class="edit" title="Editar">${ICONS.pencil}</button>
      <button class="rm" title="Excluir">${ICONS.trash}</button>
    `;
    row.querySelector('.edit').addEventListener('click', ()=> openFinanceEntryModal(t));
    row.querySelector('.rm').addEventListener('click', ()=>{
      state.finance = state.finance.filter(x=>x.id!==t.id);
      save(); refreshCurrentDay();
    });
    wrap.appendChild(row);
  });
}

/* ---------- helpers de cartão ---------- */
function getCard(id){
  return state.cards.find(c=> String(c.id)===String(id));
}
function categoryName(catId){
  const c = state.financeCategories.find(x=>String(x.id)===String(catId));
  return c ? c.name : '';
}
function cardFirstInvoiceMonth(card, purchaseDateIso){
  const d = new Date(purchaseDateIso+'T00:00:00');
  let y = d.getFullYear(), m = d.getMonth();
  if(d.getDate() > card.closingDay){ m++; if(m>11){ m=0; y++; } }
  return {year:y, month:m};
}
function getCardInvoiceItems(cardId, year, month){
  const card = getCard(cardId);
  if(!card) return [];
  const items = [];
  state.cardPurchases.filter(p=> String(p.cardId)===String(cardId)).forEach(p=>{
    const first = cardFirstInvoiceMonth(card, p.purchaseDate);
    for(let i=0;i<p.installments;i++){
      let iy=first.year, im=first.month+i;
      while(im>11){ im-=12; iy++; }
      if(iy===year && im===month){
        const val = Math.round((p.totalValue/p.installments)*100)/100;
        items.push({purchase:p, installmentIndex:i, value:val});
      }
    }
  });
  return items;
}
function getCardInvoiceTotal(cardId, year, month){
  return getCardInvoiceItems(cardId, year, month).reduce((s,it)=>s+it.value, 0);
}

/* ---------- modal de criar/editar cartão ---------- */
function openCardFormModal(editCard){
  const sheet = document.getElementById('settingsSheet');
  sheet.innerHTML = `
    <div class="modal-header"><h3>${editCard?'Editar':'Novo'} cartão</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="card-form">
      <label>Nome <input type="text" id="cardName" value="${editCard?escapeHtml(editCard.name):''}" placeholder="Ex: Nubank Roxinho"></label>
      <label>Banco <input type="text" id="cardBank" value="${editCard?escapeHtml(editCard.bank||''):''}" placeholder="Ex: Nubank"></label>
      <label>Dia de fechamento <input type="number" id="cardClosing" min="1" max="31" value="${editCard?editCard.closingDay:5}"></label>
      <label>Dia de vencimento <input type="number" id="cardDue" min="1" max="31" value="${editCard?editCard.dueDay:12}"></label>
    </div>
    <button class="btn-primary" id="cardSaveBtn" style="margin-top:14px;">${editCard?'Salvar':'Adicionar'}</button>
    ${editCard?`<button type="button" class="btn-primary" id="cardDeleteBtn" style="margin-top:8px;background:var(--rose);">Excluir cartão</button>`:''}
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  document.getElementById('cardSaveBtn').addEventListener('click', ()=>{
    const name = document.getElementById('cardName').value.trim();
    if(!name) return;
    const bank = document.getElementById('cardBank').value.trim();
    let closingDay = parseInt(document.getElementById('cardClosing').value,10); if(isNaN(closingDay)||closingDay<1) closingDay=5;
    let dueDay = parseInt(document.getElementById('cardDue').value,10); if(isNaN(dueDay)||dueDay<1) dueDay=12;
    if(editCard){
      editCard.name=name; editCard.bank=bank; editCard.closingDay=closingDay; editCard.dueDay=dueDay;
    } else {
      state.cards.push({id:Date.now()+Math.random(), name, bank, closingDay, dueDay});
    }
    save(); closeDaySettingsModal();
  });
  if(editCard){
    document.getElementById('cardDeleteBtn').addEventListener('click', ()=>{
      state.cards = state.cards.filter(c=>c.id!==editCard.id);
      state.cardPurchases = state.cardPurchases.filter(p=>String(p.cardId)!==String(editCard.id));
      state.financeSubView='cartoes';
      save(); closeDaySettingsModal();
    });
  }
}

/* ---------- categorias ---------- */
function openCategoryEditModal(cat){
  const sheet = document.getElementById('settingsSheet');
  sheet.innerHTML = `
    <div class="modal-header"><h3>Editar categoria</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="card-form">
      <label>Nome <input type="text" id="catNameInput" value="${escapeHtml(cat.name)}"></label>
    </div>
    <button class="btn-primary" id="catSaveBtn" style="margin-top:14px;">Salvar</button>
    <button type="button" class="btn-primary" id="catDeleteBtn" style="margin-top:8px;background:var(--rose);">Excluir categoria</button>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  document.getElementById('catSaveBtn').addEventListener('click', ()=>{
    const name = document.getElementById('catNameInput').value.trim();
    if(!name){ showInlineWarning(document.getElementById('catSaveBtn'), 'Digite um nome.'); return; }
    cat.name = name;
    save(); closeDaySettingsModal();
  });
  document.getElementById('catDeleteBtn').addEventListener('click', ()=>{
    state.financeCategories = state.financeCategories.filter(x=>x.id!==cat.id);
    save(); closeDaySettingsModal();
  });
}
function renderCategoriesSection(root){
  root.innerHTML = `
    <div id="catListWrap"></div>
    <div class="add-row" style="margin-top:12px;">
      <input type="text" id="newCatInput" placeholder="Nova categoria...">
      <button class="btn-primary" id="newCatAdd">Adicionar</button>
    </div>
  `;
  function renderList(){
    const wrap = document.getElementById('catListWrap');
    if(state.financeCategories.length===0){
      wrap.innerHTML = `<p class="empty-state">Nenhuma categoria cadastrada ainda.</p>`;
      return;
    }
    wrap.innerHTML = '';
    state.financeCategories.forEach(c=>{
      const row = document.createElement('div');
      row.className = 'thought-item';
      row.innerHTML = `<span class="tdot">·</span><span class="ttext">${escapeHtml(c.name)}</span><button class="edit" title="Editar">${ICONS.pencil}</button><button class="rm" title="Excluir">${ICONS.trash}</button>`;
      row.querySelector('.edit').addEventListener('click', ()=> openCategoryEditModal(c));
      row.querySelector('.rm').addEventListener('click', ()=>{
        state.financeCategories = state.financeCategories.filter(x=>x.id!==c.id);
        save(); renderList();
      });
      wrap.appendChild(row);
    });
  }
  renderList();
  document.getElementById('newCatAdd').addEventListener('click', ()=>{
    const inp = document.getElementById('newCatInput');
    const name = inp.value.trim();
    if(!name){ showInlineWarning(document.getElementById('newCatAdd'), 'Digite um nome.'); return; }
    state.financeCategories.push({id:'cat_'+Date.now()+Math.random(), name});
    inp.value='';
    save(); renderList();
  });
  document.getElementById('newCatInput').addEventListener('keydown',(e)=>{
    if(e.key==='Enter') document.getElementById('newCatAdd').click();
  });
}
function buildCategoryPicker(container, currentValue, onChange){
  container.innerHTML = '';
  const addRow = document.createElement('div');
  addRow.className='csel-add-row';
  addRow.style.display='none';
  addRow.innerHTML = `<input type="text" placeholder="Nome da categoria..."><button type="button" class="csel-add-btn">+</button>`;

  const opts = ()=> [
    {value:'',label:'—'},
    ...state.financeCategories.map(c=>({value:c.id,label:c.name})),
    {value:'__add__', label:'+ Nova categoria', action: ()=>{
      addRow.style.display='flex';
      addRow.querySelector('input').focus();
    }}
  ];
  const catSelect = createCustomSelect({ options: opts(), value: currentValue, onChange });
  container.appendChild(catSelect.el);
  container.appendChild(addRow);

  const doAdd = ()=>{
    const inp = addRow.querySelector('input');
    const name = inp.value.trim();
    if(!name) return;
    const newCat = {id:'cat_'+Date.now()+Math.random(), name};
    state.financeCategories.push(newCat);
    save();
    catSelect.setOptions(opts(), newCat.id);
    if(onChange) onChange(newCat.id);
    inp.value='';
    addRow.style.display='none';
  };
  addRow.querySelector('.csel-add-btn').addEventListener('click', doAdd);
  addRow.querySelector('input').addEventListener('keydown',(e)=>{ if(e.key==='Enter') doAdd(); });

  return catSelect;
}

/* ---------- modal de editar entrada/saída e de compra no cartão ---------- */
function openFinanceEntryModal(entry){
  const sheet = document.getElementById('settingsSheet');
  const isOut = entry.type==='out';
  const isCardPayment = !!entry.cardPayment;
  sheet.innerHTML = `
    <div class="modal-header"><h3>Editar ${isOut?'saída':'entrada'}</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="card-form">
      <label>Data <input type="date" id="feDate" value="${entry.date}"></label>
      <label>Descrição <input type="text" id="feDesc" value="${escapeHtml(entry.desc)}"></label>
      ${isOut && !isCardPayment ? `
      <label>Categoria <div id="feCategoryWrap"></div></label>
      <label class="fin-essential-label"><input type="checkbox" id="feEssential" ${entry.essential?'checked':''}> Essencial</label>` : ''}
      <label>Valor (R$) <input type="text" inputmode="decimal" id="feValue" class="money-input" value="${moneyInputFmt(entry.value)}"></label>
    </div>
    <button class="btn-primary" id="feSaveBtn" style="margin-top:14px;">Salvar</button>
    <button type="button" class="btn-primary" id="feDeleteBtn" style="margin-top:8px;background:var(--rose);">Excluir</button>
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  attachMoneyMask(document.getElementById('feValue'));
  let feCategorySel = null;
  if(isOut && !isCardPayment){
    feCategorySel = buildCategoryPicker(document.getElementById('feCategoryWrap'), entry.category, null);
  }
  document.getElementById('feSaveBtn').addEventListener('click', ()=>{
    const date = document.getElementById('feDate').value || entry.date;
    const desc = document.getElementById('feDesc').value.trim();
    const value = moneyInputValue(document.getElementById('feValue'));
    if(!desc || isNaN(value) || value<=0){ showInlineWarning(document.getElementById('feSaveBtn'), 'Preencha descrição e um valor válido.'); return; }
    entry.date = date; entry.desc = desc; entry.value = value;
    if(isOut && !isCardPayment){
      entry.category = feCategorySel.getValue();
      entry.essential = document.getElementById('feEssential').checked;
    }
    save(); closeDaySettingsModal();
  });
  document.getElementById('feDeleteBtn').addEventListener('click', ()=>{
    state.finance = state.finance.filter(x=>x.id!==entry.id);
    save(); closeDaySettingsModal();
  });
}
function openPurchaseFormModal(cardId, editPurchase, defaultDate){
  const sheet = document.getElementById('settingsSheet');
  sheet.innerHTML = `
    <div class="modal-header"><h3>${editPurchase?'Editar':'Nova'} compra</h3><button class="modal-close" id="settingsCloseBtn">✕</button></div>
    <div class="card-form">
      <label>Descrição <input type="text" id="pDesc" value="${editPurchase?escapeHtml(editPurchase.desc):''}" placeholder="Ex: Tênis"></label>
      <label>Valor total (R$) <input type="text" inputmode="decimal" id="pValue" class="money-input" value="${editPurchase?moneyInputFmt(editPurchase.totalValue):''}"></label>
      <label>Data da compra <input type="date" id="pDate" value="${editPurchase?editPurchase.purchaseDate:(defaultDate||todayISO())}"></label>
      <label>Parcelas <input type="number" id="pInstallments" min="1" max="36" value="${editPurchase?editPurchase.installments:1}"></label>
      <label>Categoria <div id="pCategoryWrap"></div></label>
      <label class="fin-essential-label"><input type="checkbox" id="pEssential" ${editPurchase&&editPurchase.essential?'checked':''}> Essencial</label>
    </div>
    <button class="btn-primary" id="pSaveBtn" style="margin-top:14px;">${editPurchase?'Salvar':'Adicionar'}</button>
    ${editPurchase?`<button type="button" class="btn-primary" id="pDeleteBtn" style="margin-top:8px;background:var(--rose);">Excluir compra</button>`:''}
  `;
  document.getElementById('settingsModalOverlay').classList.add('show');
  document.getElementById('settingsCloseBtn').addEventListener('click', closeDaySettingsModal);
  attachMoneyMask(document.getElementById('pValue'));
  const pCategorySel = buildCategoryPicker(document.getElementById('pCategoryWrap'), editPurchase?editPurchase.category:'', null);
  document.getElementById('pSaveBtn').addEventListener('click', ()=>{
    const desc = document.getElementById('pDesc').value.trim();
    const value = moneyInputValue(document.getElementById('pValue'));
    const date = document.getElementById('pDate').value || todayISO();
    let installments = parseInt(document.getElementById('pInstallments').value,10); if(isNaN(installments)||installments<1) installments=1;
    const category = pCategorySel.getValue();
    const essential = document.getElementById('pEssential').checked;
    if(!desc || isNaN(value) || value<=0){ showInlineWarning(document.getElementById('pSaveBtn'), 'Preencha descrição e um valor válido.'); return; }
    if(editPurchase){
      editPurchase.desc=desc; editPurchase.totalValue=value; editPurchase.purchaseDate=date;
      editPurchase.installments=installments; editPurchase.category=category; editPurchase.essential=essential;
    } else {
      state.cardPurchases.push({id:Date.now()+Math.random(), cardId, desc, totalValue:value, purchaseDate:date, installments, category, essential});
    }
    save(); closeDaySettingsModal();
  });
  if(editPurchase){
    document.getElementById('pDeleteBtn').addEventListener('click', ()=>{
      state.cardPurchases = state.cardPurchases.filter(x=>x.id!==editPurchase.id);
      save(); closeDaySettingsModal();
    });
  }
}

/* ---------- lista de cartões e detalhe da fatura ---------- */
function renderCardsSection(root){
  root.innerHTML = `
    <div id="cardsListWrap"></div>
    <button class="btn-primary" id="addCardBtn" style="margin-top:14px;">+ Novo cartão</button>
  `;
  const wrap = document.getElementById('cardsListWrap');
  if(state.cards.length===0){
    wrap.innerHTML = `<p class="empty-state">Nenhum cartão cadastrado ainda.</p>`;
  } else {
    wrap.innerHTML = '';
    state.cards.forEach(card=>{
      const total = getCardInvoiceTotal(card.id, state.financeYear, state.financeMonth);
      const row = document.createElement('button');
      row.type='button';
      row.className='card-list-row';
      row.innerHTML = `
        <div class="clr-main">
          <span class="clr-name">${escapeHtml(card.name)}</span>
          <span class="clr-bank">${escapeHtml(card.bank||'')} · fecha dia ${card.closingDay}</span>
        </div>
        <span class="clr-total">${fmtMoney(total)}</span>
        <span class="clr-arrow">›</span>
      `;
      row.addEventListener('click', ()=>{
        state.financeSubView='cartao-detalhe'; state.cardDetailId=card.id;
        state.cardDetailYear=state.financeYear; state.cardDetailMonth=state.financeMonth;
        save(); renderAll();
      });
      wrap.appendChild(row);
    });
  }
  document.getElementById('addCardBtn').addEventListener('click', ()=> openCardFormModal());
}
function renderCardDetail(root){
  const card = getCard(state.cardDetailId);
  if(!card){ state.financeSubView='cartoes'; save(); renderAll(); return; }
  const year = state.cardDetailYear, month = state.cardDetailMonth;
  const items = getCardInvoiceItems(card.id, year, month);
  const total = items.reduce((s,it)=>s+it.value, 0);
  const payment = state.finance.find(t=> t.cardPayment && String(t.cardPayment.cardId)===String(card.id) && t.cardPayment.year===year && t.cardPayment.month===month);

  root.innerHTML = `
    <div class="view-header">
      <button class="modal-back" id="cardBackBtn">‹ Cartões</button>
      <div class="month-nav-center">
        <button class="icon-btn" id="cdPrev">‹</button>
        <h2 class="view-title">${escapeHtml(card.name)} · ${MONTH_NAMES[month]}/${year}</h2>
        <button class="icon-btn" id="cdNext">›</button>
      </div>
      <button class="icon-btn" id="cdEditCardBtn" title="Editar cartão">${ICONS.pencil}</button>
    </div>
    <div class="card-invoice-summary">
      <div class="civ-total"><span class="civ-label">Total da fatura</span><span class="civ-value">${fmtMoney(total)}</span></div>
      ${payment
        ? `<div class="civ-payment-linked">Pagamento lançado: ${fmtMoney(payment.value)} em ${new Date(payment.date+'T00:00:00').toLocaleDateString('pt-BR')}</div>`
        : `<button class="btn-primary" id="cdLaunchPayment">Lançar pagamento desta fatura</button>`}
    </div>
    <div id="cardPurchaseList"></div>
    <button class="btn-primary" id="cdAddPurchase" style="margin-top:14px;">+ Nova compra</button>
  `;
  document.getElementById('cardBackBtn').addEventListener('click', ()=>{ state.financeSubView='cartoes'; save(); renderAll(); });
  document.getElementById('cdPrev').addEventListener('click', ()=>{
    let m=month-1,y=year; if(m<0){m=11;y--;} state.cardDetailMonth=m; state.cardDetailYear=y; save(); renderAll();
  });
  document.getElementById('cdNext').addEventListener('click', ()=>{
    let m=month+1,y=year; if(m>11){m=0;y++;} state.cardDetailMonth=m; state.cardDetailYear=y; save(); renderAll();
  });
  document.getElementById('cdEditCardBtn').addEventListener('click', ()=> openCardFormModal(card));
  const launchBtn = document.getElementById('cdLaunchPayment');
  if(launchBtn) launchBtn.addEventListener('click', ()=>{
    state.finance.push({
      id:Date.now()+Math.random(), date: todayISO(),
      desc:`Fatura ${card.name} - ${MONTH_NAMES[month]}`, type:'out', value: total,
      cardPayment:{cardId:card.id, year, month}
    });
    save(); renderAll();
  });

  const listWrap = document.getElementById('cardPurchaseList');
  if(items.length===0){
    listWrap.innerHTML = `<p class="empty-state">Nenhuma compra nesta fatura.</p>`;
  } else {
    listWrap.innerHTML = '';
    items.sort((a,b)=> a.purchase.purchaseDate.localeCompare(b.purchase.purchaseDate));
    items.forEach(it=>{
      const p = it.purchase;
      const row = document.createElement('div');
      row.className='purchase-row';
      row.innerHTML = `
        <div class="pr-main">
          <span class="pr-desc">${escapeHtml(p.desc)}</span>
          <span class="pr-meta">
            ${categoryName(p.category)?`<span class="pr-cat">${escapeHtml(categoryName(p.category))}</span>`:''}
            ${p.essential?'<span class="pr-essential">essencial</span>':''}
            ${p.installments>1?`<span class="pr-installment">${it.installmentIndex+1}/${p.installments}</span>`:''}
          </span>
        </div>
        <span class="pr-value">${fmtMoney(it.value)}</span>
        <button class="pedit" title="Editar">${ICONS.pencil}</button>
        <button class="rm" title="Excluir">${ICONS.trash}</button>
      `;
      row.querySelector('.pedit').addEventListener('click', ()=> openPurchaseFormModal(card.id, p));
      row.querySelector('.rm').addEventListener('click', ()=>{
        state.cardPurchases = state.cardPurchases.filter(x=>x.id!==p.id);
        save(); renderAll();
      });
      listWrap.appendChild(row);
    });
  }
  document.getElementById('cdAddPurchase').addEventListener('click', ()=>
    openPurchaseFormModal(card.id, null, `${year}-${pad(month+1)}-01`)
  );
}

/* ---------- roteador da área Financeiro ---------- */
export function renderFinance(root){
  const showMonthNav = state.financeSubView !== 'cartao-detalhe' && state.financeSubView !== 'categorias';
  root.innerHTML = `
    <div class="view-header centered"><h2 class="view-title">Financeiro</h2></div>
    <div class="fin-subnav">
      <button type="button" class="fin-subtab ${state.financeSubView==='resumo'?'active':''}" data-tab="resumo">Resumo</button>
      <button type="button" class="fin-subtab ${state.financeSubView==='entradas'?'active':''}" data-tab="entradas">Entradas</button>
      <button type="button" class="fin-subtab ${state.financeSubView==='saidas'?'active':''}" data-tab="saidas">Saídas</button>
      <button type="button" class="fin-subtab ${state.financeSubView==='cartoes' || state.financeSubView==='cartao-detalhe' ? 'active':''}" data-tab="cartoes">Cartões</button>
      <button type="button" class="fin-subtab ${state.financeSubView==='categorias'?'active':''}" data-tab="categorias">Categorias</button>
    </div>
    ${showMonthNav ? `
    <div class="fin-month-nav">
      <button class="icon-btn" id="finPrevMonth">‹</button>
      <span class="fin-month-label">${MONTH_NAMES[state.financeMonth]} de ${state.financeYear}</span>
      <button class="icon-btn" id="finNextMonth">›</button>
      <button class="today-btn" id="finTodayBtn">Hoje</button>
    </div>` : ''}
    <div id="finSubRoot"></div>
  `;
  root.querySelectorAll('.fin-subtab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.financeSubView = btn.dataset.tab;
      save(); renderFinance(root);
    });
  });
  const subnavEl = root.querySelector('.fin-subnav');
  if(subnavEl){
    subnavEl.addEventListener('wheel', (e)=>{
      if(subnavEl.scrollWidth > subnavEl.clientWidth){
        e.preventDefault();
        subnavEl.scrollLeft += (e.deltaY !== 0 ? e.deltaY : e.deltaX);
      }
    }, {passive:false});
  }
  if(showMonthNav){
    document.getElementById('finPrevMonth').addEventListener('click', ()=>{
      let m=state.financeMonth-1, y=state.financeYear; if(m<0){m=11;y--;}
      state.financeMonth=m; state.financeYear=y; save(); renderFinance(root);
    });
    document.getElementById('finTodayBtn').addEventListener('click', ()=>{
      const t = new Date();
      state.financeYear = t.getFullYear(); state.financeMonth = t.getMonth();
      save(); renderFinance(root);
    });
    document.getElementById('finNextMonth').addEventListener('click', ()=>{
      let m=state.financeMonth+1, y=state.financeYear; if(m>11){m=0;y++;}
      state.financeMonth=m; state.financeYear=y; save(); renderFinance(root);
    });
  }
  const sub = document.getElementById('finSubRoot');
  if(state.financeSubView==='cartoes') renderCardsSection(sub);
  else if(state.financeSubView==='cartao-detalhe') renderCardDetail(sub);
  else if(state.financeSubView==='entradas') renderFinanceByType(sub, 'in');
  else if(state.financeSubView==='saidas') renderFinanceByType(sub, 'out');
  else if(state.financeSubView==='categorias') renderCategoriesSection(sub);
  else renderFinanceResumo(sub);
}

/* ---------- categoria: cálculo compartilhado ---------- */
function computeCategoryTotals(filterMonth, filterYear){
  const totals = {};
  function add(catId, val){
    const key = catId || '__sem__';
    totals[key] = (totals[key]||0) + val;
  }
  state.finance.forEach(t=>{
    if(t.type!=='out' || t.cardPayment) return;
    const d = new Date(t.date+'T00:00:00');
    if(!(d.getMonth()===filterMonth && d.getFullYear()===filterYear)) return;
    add(t.category, t.value);
  });
  state.cards.forEach(card=>{
    getCardInvoiceItems(card.id, filterYear, filterMonth).forEach(it=>{
      add(it.purchase.category, it.value);
    });
  });
  return Object.entries(totals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
}
function renderCategoryBreakdownInto(wrapId, filterMonth, filterYear){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;
  const entries = computeCategoryTotals(filterMonth, filterYear);
  if(entries.length===0){ wrap.innerHTML=''; return; }
  const max = entries[0][1];
  wrap.innerHTML = `
    <div class="fin-cat-title">Por categoria</div>
    ${entries.map(([catId,val])=>{
      const name = catId==='__sem__' ? 'Sem categoria' : categoryName(catId);
      const pct = max>0 ? Math.round((val/max)*100) : 0;
      return `<div class="fin-cat-row">
        <span class="fcr-name">${escapeHtml(name)}</span>
        <div class="fcr-bar-wrap"><div class="fcr-bar" style="width:${pct}%"></div></div>
        <span class="fcr-value">${fmtMoney(val)}</span>
      </div>`;
    }).join('')}
  `;
}

/* ---------- aba Resumo ---------- */
function renderFinanceResumo(root){
  const items = state.finance.filter(t=>{
    const d = new Date(t.date+'T00:00:00');
    return d.getMonth()===state.financeMonth && d.getFullYear()===state.financeYear;
  });
  const totalIn = items.filter(t=>t.type==='in').reduce((s,t)=>s+t.value,0);
  const totalOut = items.filter(t=>t.type==='out').reduce((s,t)=>s+t.value,0);
  const saldo = totalIn-totalOut;
  root.innerHTML = `
    <div class="fin-summary">
      <div class="fin-card in"><div class="flabel">Entradas</div><div class="fvalue">${fmtMoney(totalIn)}</div></div>
      <div class="fin-card out"><div class="flabel">Saídas</div><div class="fvalue">${fmtMoney(totalOut)}</div></div>
      <div class="fin-card bal"><div class="flabel">Saldo</div><div class="fvalue">${fmtMoney(saldo)}</div></div>
    </div>
    <div id="finCatBreakdown"></div>
  `;
  renderCategoryBreakdownInto('finCatBreakdown', state.financeMonth, state.financeYear);
}

/* ---------- aba Entradas/Saídas ---------- */
function financeDefaultDate(){
  const t = new Date();
  if(state.financeMonth===t.getMonth() && state.financeYear===t.getFullYear()) return todayISO();
  return `${state.financeYear}-${pad(state.financeMonth+1)}-01`;
}
function renderFinanceByType(root, type){
  const isOut = type==='out';
  const cardOptions = state.cards.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const monthOptionsSel = MONTH_NAMES.map((m,i)=>`<option value="${i}" ${i===state.financeMonth?'selected':''}>${m}</option>`).join('');

  root.innerHTML = `
    <div class="fin-summary fin-summary-single" id="finTypeSummary"></div>
    ${isOut ? `<div id="finCatBreakdown"></div><button type="button" class="fin-cat-manage-link" id="finCatManageBtn">Gerenciar categorias</button>` : ''}

    ${isOut && state.cards.length>0 ? `
    <div class="fin-add-type-toggle">
      <button type="button" class="fatt-btn active" data-mode="normal">Gasto normal</button>
      <button type="button" class="fatt-btn" data-mode="cartao">Pagamento de cartão</button>
    </div>` : ''}

    <div class="fin-form" id="finFormNormal">
      <div style="flex-basis:100%;"><label>Descrição</label><input type="text" id="fDesc" placeholder="${isOut?'Ex: mercado, aluguel...':'Ex: salário, freela...'}"></div>
      <div><label>Data</label><input type="date" id="fDate" value="${financeDefaultDate()}"></div>
      ${isOut ? `
      <div><label>Categoria</label><div id="fCategoryWrap"></div></div>
      <div><label class="fin-essential-label"><input type="checkbox" id="fEssential"> Essencial</label></div>` : ''}
      <div><label>Valor (R$)</label><input type="text" inputmode="decimal" id="fValue" class="money-input" placeholder="0,00"></div>
      <div><button class="btn-primary" id="fAdd">Adicionar</button></div>
    </div>

    ${isOut && state.cards.length>0 ? `
    <div class="fin-form" id="finFormCartao" style="display:none;">
      <div><label>Cartão</label><select id="fCard">${cardOptions}</select></div>
      <div><label>Fatura</label><select id="fCardMonth">${monthOptionsSel}</select></div>
      <div><label>Data pagto.</label><input type="date" id="fCardDate" value="${financeDefaultDate()}"></div>
      <div><label>Valor (R$)</label><input type="text" inputmode="decimal" id="fCardValue" class="money-input" placeholder="0,00"></div>
      <div><button class="btn-primary" id="fCardAdd">Lançar pagamento</button></div>
    </div>` : ''}

    <div id="finTypeTableWrap"></div>
  `;

  let fCategorySel = null;
  if(isOut){
    document.getElementById('finCatManageBtn').addEventListener('click', ()=>{
      state.financeSubView='categorias'; save(); renderAll();
    });
    fCategorySel = buildCategoryPicker(document.getElementById('fCategoryWrap'), '', null);
  }
  attachMoneyMask(document.getElementById('fValue'));
  if(isOut && state.cards.length>0){
    root.querySelectorAll('.fatt-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        root.querySelectorAll('.fatt-btn').forEach(b=>b.classList.toggle('active', b===btn));
        document.getElementById('finFormNormal').style.display = btn.dataset.mode==='normal' ? '' : 'none';
        document.getElementById('finFormCartao').style.display = btn.dataset.mode==='cartao' ? '' : 'none';
      });
    });
    attachMoneyMask(document.getElementById('fCardValue'));
    function suggestCardValue(){
      const cardId = document.getElementById('fCard').value;
      const month = parseInt(document.getElementById('fCardMonth').value,10);
      const total = getCardInvoiceTotal(cardId, state.financeYear, month);
      document.getElementById('fCardValue').value = moneyInputFmt(total);
    }
    document.getElementById('fCard').addEventListener('change', suggestCardValue);
    document.getElementById('fCardMonth').addEventListener('change', suggestCardValue);
    suggestCardValue();

    document.getElementById('fCardAdd').onclick = ()=>{
      const cardId = document.getElementById('fCard').value;
      const month = parseInt(document.getElementById('fCardMonth').value,10);
      const date = document.getElementById('fCardDate').value || financeDefaultDate();
      const value = moneyInputValue(document.getElementById('fCardValue'));
      if(isNaN(value) || value<=0){ showInlineWarning(document.getElementById('fCardAdd'), 'Informe um valor válido.'); return; }
      const card = getCard(cardId);
      state.finance.push({
        id:Date.now()+Math.random(), date,
        desc:`Fatura ${card.name} - ${MONTH_NAMES[month]}`, type:'out', value,
        cardPayment:{cardId, year: state.financeYear, month}
      });
      save();
      const dt = new Date(date+'T00:00:00');
      if(dt.getMonth()!==state.financeMonth || dt.getFullYear()!==state.financeYear){
        state.financeMonth = dt.getMonth(); state.financeYear = dt.getFullYear();
        save(); renderAll(); return;
      }
      refreshTypeList();
    };
  }

  document.getElementById('fAdd').onclick = ()=>{
    const date = document.getElementById('fDate').value || financeDefaultDate();
    const desc = document.getElementById('fDesc').value.trim();
    const category = isOut ? fCategorySel.getValue() : '';
    const essential = isOut ? document.getElementById('fEssential').checked : false;
    const value = moneyInputValue(document.getElementById('fValue'));
    if(!desc || isNaN(value) || value<=0){ showInlineWarning(document.getElementById('fAdd'), 'Preencha descrição e um valor válido.'); return; }
    state.finance.push({id:Date.now()+Math.random(), date, desc, type, value, category, essential});
    save();
    const dt = new Date(date+'T00:00:00');
    if(dt.getMonth()!==state.financeMonth || dt.getFullYear()!==state.financeYear){
      state.financeMonth = dt.getMonth(); state.financeYear = dt.getFullYear();
      save(); renderAll(); return;
    }
    document.getElementById('fDesc').value='';
    document.getElementById('fValue').value='';
    if(isOut){ document.getElementById('fEssential').checked=false; fCategorySel.setValue(''); }
    refreshTypeList();
  };

  function refreshTypeList(){
    const items = state.finance.filter(t=>{
      if(t.type!==type) return false;
      const d = new Date(t.date+'T00:00:00');
      return d.getMonth()===state.financeMonth && d.getFullYear()===state.financeYear;
    }).sort((a,b)=> b.date.localeCompare(a.date));
    const total = items.reduce((s,t)=>s+t.value,0);

    document.getElementById('finTypeSummary').innerHTML = `
      <div class="fin-card ${isOut?'out':'in'}"><div class="flabel">${isOut?'Total de saídas':'Total de entradas'}</div><div class="fvalue">${fmtMoney(total)}</div></div>
    `;
    if(isOut) renderCategoryBreakdownInto('finCatBreakdown', state.financeMonth, state.financeYear);

    const wrap = document.getElementById('finTypeTableWrap');
    if(items.length===0){
      wrap.innerHTML = `<p class="empty-state">Nenhum lançamento neste mês.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table class="fin-table">
        <thead><tr><th>Data</th><th>Descrição</th>${isOut?'<th>Categoria</th>':''}<th>Valor</th><th></th></tr></thead>
        <tbody>
          ${items.map(t=>`
            <tr data-id="${t.id}">
              <td>${new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td>
                <span class="fx-desc-text">${escapeHtml(t.desc)}</span>
                ${t.cardPayment ? `<button type="button" class="fx-goto-invoice" data-card="${t.cardPayment.cardId}" data-year="${t.cardPayment.year}" data-month="${t.cardPayment.month}">Ver fatura ›</button>` : ''}
              </td>
              ${isOut ? `<td>
                ${t.cardPayment ? '<span class="fx-cat-locked">Cartão</span>' : `<span class="fx-cat-text">${categoryName(t.category) ? escapeHtml(categoryName(t.category)) : '—'}</span>`}
              </td>` : ''}
              <td>${fmtMoney(t.value)}</td>
              <td>
                <button class="fx-edit" title="Editar">${ICONS.pencil}</button>
                <button class="rm-tx" data-id="${t.id}" title="Excluir">${ICONS.trash}</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
    wrap.querySelectorAll('tr[data-id]').forEach(tr=>{
      const id = tr.dataset.id;
      const t = state.finance.find(x=>String(x.id)===id);
      if(!t) return;
      tr.querySelector('.fx-edit').addEventListener('click', ()=> openFinanceEntryModal(t));
      const gotoBtn = tr.querySelector('.fx-goto-invoice');
      if(gotoBtn) gotoBtn.addEventListener('click', ()=>{
        state.financeSubView='cartao-detalhe';
        state.cardDetailId = gotoBtn.dataset.card;
        state.cardDetailYear = parseInt(gotoBtn.dataset.year,10);
        state.cardDetailMonth = parseInt(gotoBtn.dataset.month,10);
        save(); renderAll();
      });
    });
    wrap.querySelectorAll('.rm-tx').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.id;
        state.finance = state.finance.filter(t=> String(t.id)!==id);
        save(); refreshTypeList();
      });
    });
  }
  refreshTypeList();
}

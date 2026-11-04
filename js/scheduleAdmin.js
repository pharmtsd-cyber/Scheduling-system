let currentAdminTab = 'daily'; 
let currentViewMode = 'timeline'; 
let studioShifts = []; 
let engineSpecificDates = []; 
let clipboardShift = null; 

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 智能排班中心：${deptName}`;
    
    try { const savedOrder = localStorage.getItem('staffOrder_' + currentDept); if (savedOrder) customStaffOrder = JSON.parse(savedOrder); } catch(e) {}
    
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('viewTimelineDate').value = `${currMonthStr}-01`;
    document.getElementById('engineTargetMonth').value = currMonthStr;
    document.getElementById('viewMatrixMonth').value = currMonthStr;
    
    refreshTemplateLists();
    switchAdminTab('daily');
}

function switchAdminTab(tab) {
    currentAdminTab = tab;
    document.getElementById('viewDaily').classList.add('hidden');
    document.getElementById('viewTemplate').classList.add('hidden');
    document.getElementById('tabDaily').className = 'px-6 py-2 rounded-md font-bold transition text-slate-600 hover:bg-white/50 border border-transparent';
    document.getElementById('tabTemplate').className = 'px-6 py-2 rounded-md font-bold transition text-slate-600 hover:bg-white/50 border border-transparent';
    
    if (tab === 'daily') {
        document.getElementById('viewDaily').classList.remove('hidden');
        document.getElementById('tabDaily').className = 'px-6 py-2 rounded-md font-bold transition shadow-sm bg-white text-blue-700 border border-slate-300';
    } else {
        document.getElementById('viewTemplate').classList.remove('hidden');
        document.getElementById('tabTemplate').className = 'px-6 py-2 rounded-md font-bold transition shadow-sm bg-white text-purple-700 border border-slate-300';
        currentViewMode = 'timeline'; 
        switchViewMode('timeline'); 
        loadTemplateToStudio();
    }
    renderUnifiedGrid();
}

function switchViewMode(mode) {
    currentViewMode = mode;
    const btnTime = document.getElementById('btnViewTimeline');
    const btnMat = document.getElementById('btnViewMatrix');
    
    document.getElementById('viewTimelineDate').classList.add('hidden');
    document.getElementById('viewMatrixFilters').classList.add('hidden');
    
    if (mode === 'timeline') {
        btnTime.className = 'px-4 py-1.5 rounded text-sm font-bold bg-white text-blue-600 shadow-sm border border-slate-200 transition';
        btnMat.className = 'px-4 py-1.5 rounded text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent transition';
        document.getElementById('viewTimelineDate').classList.remove('hidden');
    } else {
        btnMat.className = 'px-4 py-1.5 rounded text-sm font-bold bg-white text-blue-600 shadow-sm border border-slate-200 transition';
        btnTime.className = 'px-4 py-1.5 rounded text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-white/50 border border-transparent transition';
        document.getElementById('viewMatrixFilters').classList.remove('hidden');
        document.getElementById('viewMatrixFilters').classList.add('flex');
    }
    renderUnifiedGrid();
}

function getActiveContextDate() { return currentAdminTab === 'template' ? 'TEMPLATE' : document.getElementById('viewTimelineDate').value; }
function getActiveShifts(forMatrixDate = null) {
    if (currentAdminTab === 'template') return studioShifts;
    if (currentViewMode === 'matrix' && forMatrixDate) return appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === forMatrixDate);
    return appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === document.getElementById('viewTimelineDate').value);
}

function updateActiveShift(data) {
    if (currentAdminTab === 'template') {
        const idx = studioShifts.findIndex(s => s['排班ID'] === data.shiftId);
        const newData = { '排班ID': data.shiftId, '日期': 'TEMPLATE', '部門名稱': currentDept, '員工編號': data.empId, '工作名稱': data.task, '開始時間': data.start, '結束時間': data.end, '工作類別': data.category, '備註': data.remark1, '備註2': data.remark2 };
        if (idx > -1) studioShifts[idx] = newData; else studioShifts.push(newData);
    } else {
        markDraft(data);
    }
}

function guardUnifiedAction(targetDate, callback) {
    if (currentAdminTab === 'template') { callback(); return; }
    const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === targetDate && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
    if (sysTemp) {
        if(confirm(`⚠️ 脫鉤警告：${targetDate} 已套用模板【${sysTemp['備註'] || sysTemp['remark1'] || '未知模板'}】。\n您現在的修改將會使該日獨立脫鉤。\n\n確定要脫鉤並修改嗎？`)) {
            sysTemp['工作名稱'] = 'SYS_DECOUPLED';
            markDraft({ shiftId: sysTemp['排班ID'], date: targetDate, dept: currentDept, empId: 'SYS_TEMPLATE', task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: '' });
            callback();
        }
    } else { callback(); }
}

function handleUnifiedAction(action, dateContext, ...args) {
    const targetDate = currentAdminTab === 'template' ? 'TEMPLATE' : (dateContext || document.getElementById('viewTimelineDate').value);
    
    guardUnifiedAction(targetDate, () => {
        if (action === 'add_shift') { openShiftModal(args[0] || null, targetDate); }
        else if (action === 'update_remarks') {
            const empId = args[0]; const r1 = args[1]; const r2 = args[2];
            if(!empId) return;
            let shifts = getActiveShifts(targetDate);
            let shift = shifts.find(s => s['員工編號'] === empId && s['工作名稱'] !== 'EMP_REMARK');
            if(!shift) {
                const remarkCarrier = shifts.find(s => s['員工編號'] === empId && s['工作名稱'] === 'EMP_REMARK');
                if (remarkCarrier) {
                    updateActiveShift({ shiftId: remarkCarrier['排班ID'], date: targetDate, dept: currentDept, empId, task: 'EMP_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: r1 !== null ? r1 : remarkCarrier['備註'], remark2: r2 !== null ? r2 : remarkCarrier['備註2'] });
                } else {
                    updateActiveShift({ shiftId: 'R'+new Date().getTime(), date: targetDate, dept: currentDept, empId, task: 'EMP_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: r1||'', remark2: r2||'' });
                }
            } else { updateActiveShift({ shiftId: shift['排班ID'], date: targetDate, dept: currentDept, empId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: r1 !== null ? r1 : shift['備註'], remark2: r2 !== null ? r2 : shift['備註2'] }); }
            renderUnifiedGrid();
        }
        else if (action === 'update_sys_remark') {
            const r1 = args[0]; const r2 = args[1];
            let sysShift = getActiveShifts(targetDate).find(s => s['員工編號'] === 'SYS_REMARK');
            if (!sysShift) { updateActiveShift({ shiftId: 'SYS_R_' + new Date().getTime(), date: targetDate, dept: currentDept, empId: 'SYS_REMARK', task: 'SYS_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: r1 !== null ? r1 : '', remark2: r2 !== null ? r2 : '' }); } 
            else { updateActiveShift({ shiftId: sysShift['排班ID'], date: targetDate, dept: currentDept, empId: 'SYS_REMARK', task: 'SYS_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: r1 !== null ? r1 : sysShift['備註'], remark2: r2 !== null ? r2 : sysShift['備註2'] }); }
            renderUnifiedGrid();
        }
        else if (action === 'assign_matrix_emp' || action === 'move_shift_emp') {
            const shiftId = args[0]; const newEmpId = args[1];
            const shift = getActiveShifts(targetDate).find(s => s['排班ID'] === shiftId);
            if (shift) { updateActiveShift({ shiftId: shift['排班ID'], date: targetDate, dept: currentDept, empId: newEmpId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] }); renderUnifiedGrid(); }
        }
        else if (action === 'delete_shift') {
            const shiftId = args[0];
            if (currentAdminTab === 'template') {
                studioShifts = studioShifts.filter(s => s['排班ID'] !== shiftId);
                closeShiftModal(); renderUnifiedGrid();
            } else {
                if(confirm("確定要刪除此工作嗎？(刪除將立即寫入雲端)")) {
                    appData.shifts = appData.shifts.filter(s => s['排班ID'] !== shiftId);
                    fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_shift', shiftId: shiftId }) }).catch(e=>console.error(e));
                    closeShiftModal(); renderUnifiedGrid();
                }
            }
        }
    });
}

function manualDecouple(dateStr) {
    if(confirm('確定要解除此日的模板綁定嗎？\n解除後即可自由修改此日排班，且系統不會再跳出警告。')) {
        const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE');
        if(sysTemp) {
            sysTemp['工作名稱'] = 'SYS_DECOUPLED';
            markDraft({ shiftId: sysTemp['排班ID'], date: dateStr, dept: currentDept, empId: 'SYS_TEMPLATE', task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: '' });
            showToast('✂️ 已解除模板綁定'); renderUnifiedGrid();
        }
    }
}

// === 模板 CRUD 與套用引擎 ===
function refreshTemplateLists() {
    const temps = (appData.templates || []).filter(t => t['部門'] === currentDept);
    const optionsHtml = temps.length ? temps.map(t => `<option value="${t['模板ID']}">[${t['類型']||'無分類'}] ${t['模板名稱']}</option>`).join('') : '<option value="">(尚無模板)</option>';
    if (document.getElementById('engineTempSelect')) document.getElementById('engineTempSelect').innerHTML = optionsHtml;
    if (document.getElementById('studioTempSelect')) document.getElementById('studioTempSelect').innerHTML = '<option value="new">-- ✨ 建立全新模板 --</option>' + optionsHtml;
}

function loadTemplateToStudio() {
    const tempId = document.getElementById('studioTempSelect').value;
    if (tempId === 'new') {
        studioShifts = []; document.getElementById('studioTempName').value = ''; document.getElementById('studioTempCat').value = '平日';
    } else {
        const template = appData.templates.find(t => t['模板ID'] === tempId);
        document.getElementById('studioTempName').value = template['模板名稱']; document.getElementById('studioTempCat').value = template['類型'] || '平日';
        try { studioShifts = JSON.parse(template['排班快照']); } catch(e) { studioShifts = []; }
    }
    renderUnifiedGrid();
}

async function saveTemplateFromStudio() {
    const tempId = document.getElementById('studioTempSelect').value;
    const tempName = document.getElementById('studioTempName').value.trim();
    const tempCat = document.getElementById('studioTempCat').value.trim() || '自訂';
    if (!tempName) return alert('請輸入模板名稱！');
    let targetId = tempId === 'new' ? 'T' + new Date().getTime() : tempId;
    document.body.style.cursor = 'wait';
    await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'save_template', templateId: targetId, templateName: tempName, dept: currentDept, type: tempCat, snapshot: JSON.stringify(studioShifts) }) });
    showToast('💾 模板儲存成功！'); await reloadData(); refreshTemplateLists(); document.getElementById('studioTempSelect').value = targetId; document.body.style.cursor = 'default';
}

async function deleteCurrentTemplate() {
    const tempId = document.getElementById('studioTempSelect').value;
    if(tempId === 'new') return;
    if(confirm('確定要永久刪除此模板嗎？')) {
        document.body.style.cursor = 'wait';
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_template', templateId: tempId }) });
        showToast('🗑️ 模板已刪除'); await reloadData(); refreshTemplateLists(); loadTemplateToStudio(); document.body.style.cursor = 'default';
    }
}

function toggleEngineSpecificDates() { document.getElementById('engineSpecificDatesPanel').classList.toggle('hidden'); }
function addEngineSpecificDate() { const d = document.getElementById('engineSpecificDateInput').value; if(!d || engineSpecificDates.includes(d)) return; engineSpecificDates.push(d); engineSpecificDates.sort(); renderEngineSpecificDates(); }
function removeEngineSpecificDate(d) { engineSpecificDates = engineSpecificDates.filter(x => x !== d); renderEngineSpecificDates(); }
function renderEngineSpecificDates() { document.getElementById('engineSpecificDatesList').innerHTML = engineSpecificDates.map(d => `<span class="bg-teal-100 text-teal-800 text-[10px] px-2 py-1 rounded flex items-center gap-1 font-mono shadow-sm">${d} <b class="cursor-pointer text-red-500 hover:text-red-700 text-sm ml-1" onclick="removeEngineSpecificDate('${d}')">×</b></span>`).join(''); }

function executeAdvancedApply() {
    const tempId = document.getElementById('engineTempSelect').value; if (!tempId) return alert('請選擇模板');
    const template = appData.templates.find(t => t['模板ID'] === tempId);
    let sourceShifts = []; try { sourceShifts = JSON.parse(template['排班快照']); } catch(e) {}
    let targetDates = new Set([...engineSpecificDates]);
    const monthVal = document.getElementById('engineTargetMonth').value;
    if (monthVal) {
        const checkboxes = document.querySelectorAll('input[name="engineRule"]:checked');
        let allowedDow = []; checkboxes.forEach(cb => { if(cb.value === 'weekday') allowedDow.push(1,2,3,4,5); else allowedDow.push(parseInt(cb.value)); });
        if (allowedDow.length > 0) { const [y, m] = monthVal.split('-'); const daysInMonth = new Date(y, m, 0).getDate(); for (let d = 1; d <= daysInMonth; d++) { let dt = new Date(y, parseInt(m)-1, d); if (allowedDow.includes(dt.getDay())) targetDates.add(`${y}-${m}-${String(d).padStart(2,'0')}`); } }
    }
    if (targetDates.size === 0) return alert('請設定至少一個目標條件或加入特定日期！');
    const dateArray = Array.from(targetDates).sort();
    if (!confirm(`系統將把模板【${template['模板名稱']}】套用至以下 ${dateArray.length} 天：\n${dateArray.slice(0,5).join(', ')}${dateArray.length>5?'...等':''}\n\n(目標日現有班表將被覆蓋並脫鉤)，確定嗎？`)) return;
    
    dateArray.forEach(tDate => {
        const oldShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === tDate && !s['員工編號'].startsWith('SYS_'));
        oldShifts.forEach(oldS => { appData.shifts = appData.shifts.filter(s => s['排班ID'] !== oldS['排班ID']); });
        sourceShifts.forEach(shift => { markDraft({ ...shift, shiftId: 'C' + new Date().getTime() + Math.random().toString(36).substr(2, 5), date: tDate }); });
        const oldSys = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === tDate && s['員工編號'] === 'SYS_TEMPLATE');
        markDraft({ shiftId: oldSys ? oldSys['排班ID'] : 'T_LNK' + tDate.replace(/-/g,''), date: tDate, dept: currentDept, empId: 'SYS_TEMPLATE', task: tempId, start: '00:00', end: '00:00', category: 'SYS', remark1: template['模板名稱'], remark2: '' });
    });
    
    showToast(`✅ 成功套用模板至 ${dateArray.length} 天！`); engineSpecificDates = []; renderEngineSpecificDates();
    if (currentAdminTab === 'daily') { document.getElementById('viewTimelineDate').value = dateArray[0]; document.getElementById('viewMatrixMonth').value = dateArray[0].substring(0,7); }
    renderUnifiedGrid();
}

// === 拖曳縮放時間引擎 (Drag-to-Resize) ===
let resizeState = null;
function timeToMins(t) { const [h,m] = (t||'08:00').split(':').map(Number); return h*60+m; }
function minsToTime(m) { 
    let h = Math.floor(m/60); let min = Math.floor(m%60); 
    if(h<8) h=8; if(h>=22 && min>0) {h=22; min=0;} 
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
function initResize(e, shiftId, edge) {
    e.stopPropagation(); e.preventDefault();
    const targetDate = getActiveContextDate();
    const shift = getActiveShifts(targetDate).find(s => s['排班ID'] === shiftId);
    if(!shift) return;
    const track = e.target.closest('.relative');
    if(!track) return;
    resizeState = { shiftId, targetDate, edge, startX: e.clientX, startMins: timeToMins(shift['開始時間']), endMins: timeToMins(shift['結束時間']), trackWidth: track.offsetWidth };
    document.addEventListener('mousemove', handleResize); document.addEventListener('mouseup', stopResize);
}
function handleResize(e) {
    if(!resizeState) return;
    const dx = e.clientX - resizeState.startX;
    const minsDelta = Math.round((dx / resizeState.trackWidth) * 840 / 15) * 15;
    const shift = getActiveShifts(resizeState.targetDate).find(s => s['排班ID'] === resizeState.shiftId);
    if(resizeState.edge === 'start') {
        let newStart = resizeState.startMins + minsDelta;
        if (newStart >= resizeState.endMins) newStart = resizeState.endMins - 15;
        if (newStart < 8*60) newStart = 8*60;
        shift['開始時間'] = minsToTime(newStart);
    } else {
        let newEnd = resizeState.endMins + minsDelta;
        if (newEnd <= resizeState.startMins) newEnd = resizeState.startMins + 15;
        if (newEnd > 22*60) newEnd = 22*60;
        shift['結束時間'] = minsToTime(newEnd);
    }
    renderUnifiedGrid();
}
function stopResize(e) {
    document.removeEventListener('mousemove', handleResize); document.removeEventListener('mouseup', stopResize);
    if(resizeState) { const shift = getActiveShifts(resizeState.targetDate).find(s => s['排班ID'] === resizeState.shiftId); updateActiveShift({...shift}); resizeState = null; }
}

// === 大統一渲染引擎 ===
function renderUnifiedGrid() { if (currentAdminTab === 'template' || currentViewMode === 'timeline') renderTimelineView(); else renderMatrixView(); }

function renderTimelineView() {
    const container = document.getElementById('unifiedGrid'); 
    const targetDate = getActiveContextDate();
    const shifts = getActiveShifts(targetDate);
    
    let html = '';
    
    if (currentAdminTab === 'daily') {
        const activeTemplate = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
        const statusContainer = document.getElementById('dailyTemplateStatus');
        if (activeTemplate) {
            statusContainer.innerHTML = `<span class="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md text-xs font-bold border border-indigo-200 shadow-sm flex items-center gap-1">🏷️ 已套用模板：${activeTemplate['備註'] || activeTemplate['remark1'] || '未知模板'}</span>
            <button onclick="manualDecouple('${targetDate}')" class="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-md border border-red-200 font-bold shadow-sm transition">✂️ 解除綁定 (獨立修改)</button>`;
        } else {
            const decoupled = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] === 'SYS_DECOUPLED');
            statusContainer.innerHTML = decoupled ? `<span class="text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1.5 rounded-md border border-orange-200 shadow-sm">⚠️ 已與模板脫鉤 (獨立修改)</span>` : `<span class="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">📝 自由排班模式</span>`;
        }
    }

    const sysRemarkShift = shifts.find(s => s['員工編號'] === 'SYS_REMARK') || {};
    html += `<div class="bg-yellow-50/50 border-b border-yellow-200 p-3 flex items-center gap-4 sticky top-0 z-30">
        <span class="text-yellow-800 font-bold text-sm shrink-0 flex items-center gap-1">📢 頂部備註：</span>
        <input type="text" class="flex-1 bg-white border border-yellow-300 focus:ring-2 focus:ring-yellow-400 rounded p-1.5 outline-none text-sm text-yellow-900 font-bold shadow-inner" value="${sysRemarkShift['備註'] || ''}" placeholder="輸入跨列顯示的頂部備註..." onblur="handleUnifiedAction('update_sys_remark', '${targetDate}', this.value, null)">
    </div>`;

    html += `<div class="flex border-b bg-slate-200 text-[11px] font-bold text-slate-700 sticky top-[52px] z-30 shadow-sm"><div class="w-24 p-2 border-r text-center shrink-0 flex items-center justify-center bg-slate-200/90 backdrop-blur"><span class="w-4 text-slate-400">#</span> <span class="flex-1">人員名單</span></div><div class="w-32 p-2 border-r text-center shrink-0 flex items-center justify-center text-blue-800 bg-blue-100/80 backdrop-blur">個人備註</div><div class="flex-1 flex min-w-[500px]">`;
    for(let i=8; i<=21; i++) html += `<div class="flex-1 border-l border-slate-300 pl-1 py-1">${i}:00</div><div class="flex-1 border-l border-dashed border-slate-300 pl-1 py-1 text-[9px] text-slate-400">30</div>`;
    html += `<div class="w-8 border-l border-slate-300 pl-1 py-1">22</div></div><div class="w-40 p-2 border-l text-center shrink-0 flex items-center justify-center text-teal-800 bg-teal-100/80 backdrop-blur">工作補充</div></div>`;

    let poolRows = [];
    shifts.filter(s => s['員工編號'] === '').forEach(shift => { poolRows.push({ '員工編號': '', '姓名': '待分發工作', '所屬單位': currentDept, '所屬組別': currentDept, isDummy: true, rowId: shift['排班ID'], shiftData: shift }); });
    
    const monthEmpIds = new Set(appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(targetDate === 'TEMPLATE' ? document.getElementById('viewTimelineDate').value.substring(0, 7) : targetDate.substring(0, 7))).map(s => s['員工編號']));
    let staffRows = [];
    appData.staff.forEach(s => { if ((monthEmpIds.has(s['員工編號']) || (s['所屬組別'] === currentDept && s['所屬單位'] !== '離職')) && !s['員工編號'].startsWith('SYS_')) staffRows.push({ ...s, isDummy: false, rowId: s['員工編號'] }); });
    staffRows.sort((a, b) => { let idxA = customStaffOrder.indexOf(a.rowId); let idxB = customStaffOrder.indexOf(b.rowId); return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB); });

    function generateRowHtml(emp, index, isDummy) {
        let myShifts = isDummy ? [emp.shiftData] : shifts.filter(s => s['員工編號'] == emp['員工編號'] && s['工作名稱'] !== 'EMP_REMARK');
        let remarkCarrier = shifts.find(s => s['員工編號'] == emp['員工編號'] && s['工作名稱'] === 'EMP_REMARK');
        let mainShift = myShifts.length > 0 ? myShifts[0] : remarkCarrier;
        let r1 = mainShift ? (mainShift['備註'] || '') : ''; let r2 = mainShift ? (mainShift['備註2'] || '') : '';
        
        let rowClass = isDummy ? 'bg-amber-50/60 border-b-2 border-dashed border-amber-300' : (index % 2 === 0 ? 'bg-white hover:bg-slate-50 border-b border-slate-200' : 'bg-blue-50/30 hover:bg-blue-50/80 border-b border-slate-200');
        
        let nameActionHtml = isDummy ? 
            `<div class="text-amber-800 text-sm font-extrabold cursor-pointer hover:bg-amber-200 px-2 py-1 rounded shadow-sm border border-amber-300 bg-amber-100 transition" onclick="openStaffPicker('', currentDept, (newEmp) => handleUnifiedAction('move_shift_emp', '${targetDate}', '${emp.shiftData['排班ID']}', newEmp))">指派給... <span class="text-[10px]">👆</span></div>` : 
            `<span class="text-blue-800 font-bold w-full text-center tracking-wide">${emp['姓名']}</span>`;

        let dragProps = isDummy ? '' : `draggable="true" ondragstart="dragRow(event, '${emp.rowId}')" ondragover="allowDrop(event)" ondrop="dropRow(event, '${emp.rowId}')"`;
        
        // ★ 修復：判斷有拷貝資料時，才顯示貼上按鈕
        let pasteBtnHtml = (clipboardShift && !isDummy) ? `<button onclick="pasteShift('${emp['員工編號']}')" class="text-[10px] bg-indigo-600 text-white px-2 py-0.5 mt-1 rounded shadow-md hover:bg-indigo-700 transition absolute bottom-0.5 z-20">📋 貼上</button>` : '';

        let overlapIds = new Set();
        if (!isDummy) {
            for(let i=0; i<myShifts.length; i++){
                for(let j=i+1; j<myShifts.length; j++){
                    let s1 = timeToMins(myShifts[i]['開始時間']); let e1 = timeToMins(myShifts[i]['結束時間']);
                    let s2 = timeToMins(myShifts[j]['開始時間']); let e2 = timeToMins(myShifts[j]['結束時間']);
                    if (s1 < e2 && e1 > s2) { overlapIds.add(myShifts[i]['排班ID']); overlapIds.add(myShifts[j]['排班ID']); }
                }
            }
        }

        let res = `<div class="flex timeline-container group transition ${rowClass} h-[60px]">
            <div class="w-24 p-1 border-r ${isDummy ? 'bg-amber-100/50 border-r-amber-300' : 'border-r-slate-200'} flex flex-col items-center justify-center shadow-sm z-10 relative ${isDummy?'':'cursor-ns-resize'} shrink-0" ${dragProps}>
                <div class="absolute top-0 left-0 bg-slate-300/80 text-slate-700 text-[9px] px-1.5 py-0.5 rounded-br-lg shadow-sm font-bold z-20">${isDummy ? '池' : (index + 1)}</div>
                <div class="font-bold truncate w-full text-center flex flex-col items-center gap-0 mt-3">${nameActionHtml}</div>
                ${pasteBtnHtml}
            </div>
            <div class="w-32 border-r ${isDummy ? 'bg-amber-50/50 border-r-amber-300' : 'bg-transparent border-r-slate-200'} flex items-center p-1.5 shrink-0">
                <input type="text" class="w-full h-full text-xs p-1.5 border-transparent focus:ring-2 focus:ring-blue-400 rounded-md bg-white/50 focus:bg-white text-blue-900 font-bold shadow-inner transition outline-none" placeholder="備註..." value="${r1}" onblur="handleUnifiedAction('update_remarks', '${targetDate}', '${emp['員工編號']}', this.value, null)">
            </div>
            <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="handleUnifiedAction('move_shift_emp', '${targetDate}', event.dataTransfer.getData('shiftId'), '${emp['員工編號']}')">
                <div class="absolute inset-0 flex pointer-events-none opacity-20">`;
        for(let i=8; i<=21; i++) res += `<div class="flex-1 border-l border-slate-400"></div><div class="flex-1 border-l border-dashed border-slate-400"></div>`;
        res += `</div>`;

        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100; const width = ((eh - sh) + (em - sm)/60) / 14 * 100;
            
            const isOverlapping = overlapIds.has(shift['排班ID']);
            let shiftBg = isOverlapping ? 'bg-red-100 border-2 border-red-500 animate-pulse shadow-md z-30' : (isDummy ? 'bg-amber-100 border-2 border-dashed border-amber-500 hover:bg-amber-200 shadow-md' : 'bg-blue-100 border border-blue-400 hover:bg-blue-200 shadow-sm');
            let textColor = isOverlapping ? 'text-red-900' : (isDummy ? 'text-amber-900' : 'text-blue-900');

            // ★ 修復：加上了 Hover 才會顯示的獨立複製小圖示
            res += `<div class="absolute top-[6px] bottom-[6px] ${shiftBg} rounded-md flex flex-col justify-center items-center cursor-grab active:cursor-grabbing transition overflow-visible z-10 group/shift" draggable="true" ondragstart="dragShift(event, '${shift['排班ID']}')" onclick="handleUnifiedAction('add_shift', '${targetDate}', '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <div class="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-black/5 hover:bg-black/30 z-20 rounded-l-md transition" onmousedown="initResize(event, '${shift['排班ID']}', 'start')"></div>
                <div class="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-black/5 hover:bg-black/30 z-20 rounded-r-md transition" onmousedown="initResize(event, '${shift['排班ID']}', 'end')"></div>
                
                <button onclick="copyShift(event, '${shift['排班ID']}')" class="absolute top-0 right-0.5 text-[9px] opacity-0 group-hover/shift:opacity-100 hover:scale-125 transition z-30 drop-shadow" title="複製此工作">📋</button>
                
                <div class="font-bold ${textColor} text-xs truncate w-full text-center px-2 pointer-events-none">${isOverlapping ? '⚠️ ' : ''}${shift['工作名稱']}</div>
                <div class="text-[10px] ${textColor} font-bold mt-[1px] opacity-80 pointer-events-none">${shift['開始時間']} - ${shift['結束時間']}</div>
            </div>`;
        });
        res += `</div><div class="w-40 border-l ${isDummy ? 'bg-amber-50/50 border-l-amber-300' : 'bg-transparent border-l-slate-200'} flex items-center p-1.5 shrink-0"><input type="text" class="w-full h-full text-xs p-1.5 border-transparent focus:ring-2 focus:ring-teal-400 rounded-md bg-white/50 focus:bg-white text-teal-900 font-bold shadow-inner transition outline-none" placeholder="補充說明..." value="${r2}" onblur="handleUnifiedAction('update_remarks', '${targetDate}', '${emp['員工編號']}', null, this.value)"></div></div>`; 
        return res;
    }

    if (poolRows.length > 0) {
        html += `<div class="bg-indigo-100/80 text-indigo-900 font-bold p-2 text-sm border-y border-indigo-300 shadow-sm flex items-center justify-between sticky top-[80px] z-20 backdrop-blur">
            <span>📥 待指派工作池 (請將右側黃色方塊，拖拉丟入下方人員列)</span>
        </div>`;
        poolRows.forEach((emp, i) => html += generateRowHtml(emp, i, true));
    }
    html += `<div class="bg-slate-200 text-slate-700 font-bold p-2 text-sm border-y border-slate-300 shadow-sm z-20 sticky ${poolRows.length>0 ? 'top-[140px]' : 'top-[80px]'} backdrop-blur">
        <span>🧑‍🤝‍🧑 人員排班區</span>
    </div>`;
    staffRows.forEach((emp, i) => html += generateRowHtml(emp, i, false));

    html += `<div class="bg-yellow-50/50 border-t border-yellow-200 p-3 flex items-center gap-4 mt-2">
        <span class="text-yellow-800 font-bold text-sm shrink-0 flex items-center gap-1">📢 底部備註：</span>
        <input type="text" class="flex-1 bg-white border border-yellow-300 focus:ring-2 focus:ring-yellow-400 rounded p-1.5 outline-none text-sm text-yellow-900 font-bold shadow-inner" value="${sysRemarkShift['備註2'] || ''}" placeholder="輸入跨列顯示的底部備註..." onblur="handleUnifiedAction('update_sys_remark', '${targetDate}', null, this.value)">
    </div>`;
    
    container.innerHTML = html;
}

function renderMatrixView() {
    const container = document.getElementById('unifiedGrid'); container.innerHTML = '';
    const monthStr = document.getElementById('viewMatrixMonth').value;
    if(!monthStr) return;
    const dowFilter = document.getElementById('viewMatrixDow').value;
    const allowedDows = dowFilter === 'ALL' ? [0,1,2,3,4,5,6] : dowFilter.split(',').map(Number);
    const [y, m] = monthStr.split('-'); const daysInMonth = new Date(y, m, 0).getDate();
    let targetDates = [];
    for (let d = 1; d <= daysInMonth; d++) { let dt = new Date(y, parseInt(m)-1, d); if (allowedDows.includes(dt.getDay())) targetDates.push({ date: `${y}-${m}-${String(d).padStart(2,'0')}`, dayName: ['日','一','二','三','四','五','六'][dt.getDay()] }); }
    if(targetDates.length === 0) { container.innerHTML = '<div class="p-8 text-center text-slate-400 font-bold text-lg">此篩選條件下無符合的日期。</div>'; return; }

    const monthShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr));
    let usedTasks = new Set();
    monthShifts.forEach(s => { if(!s['員工編號'].startsWith('SYS_') && s['工作名稱'] !== 'EMP_REMARK') usedTasks.add(s['工作名稱']); });
    appData.tasks.filter(t => t['部門名稱'] === currentDept).forEach(t => usedTasks.add(t['工作名稱']));
    const taskArray = Array.from(usedTasks).sort();

    let tableHtml = `<div class="overflow-x-auto"><table class="w-full text-left border-collapse text-sm"><thead class="bg-slate-200 sticky top-0 z-20 shadow-sm text-slate-700"><tr><th class="border border-slate-300 p-2 w-10 text-center">#</th><th class="border border-slate-300 p-2 w-20 text-center">部門</th><th class="border border-slate-300 p-2 w-32">工作任務</th>`;
    targetDates.forEach(td => { const isWeekend = (td.dayName === '六' || td.dayName === '日'); const thClass = isWeekend ? 'text-pink-600 bg-pink-50' : ''; tableHtml += `<th class="border border-slate-300 p-2 text-center min-w-[100px] leading-tight ${thClass}">${td.date.substring(5)}<br><span class="text-[10px] opacity-70">(${td.dayName})</span></th>`; });
    tableHtml += `</tr></thead><tbody class="bg-white">`;

    taskArray.forEach((taskName, idx) => {
        const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
        tableHtml += `<tr class="${rowClass} hover:bg-blue-50/30 transition"><td class="border border-slate-200 p-2 text-center text-slate-400 font-bold">${idx + 1}</td><td class="border border-slate-200 p-2 text-center text-xs font-bold text-slate-500">${currentDept}</td><td class="border border-slate-200 p-2 font-bold text-blue-800">${taskName}</td>`;
        targetDates.forEach(td => {
            const dailyShifts = monthShifts.filter(s => s['日期'] === td.date && s['工作名稱'] === taskName);
            const isWeekend = (td.dayName === '六' || td.dayName === '日'); const tdClass = isWeekend ? 'bg-pink-50/30' : '';
            tableHtml += `<td class="border border-slate-200 p-1.5 text-center align-top flex flex-col gap-1.5 ${tdClass}">`;
            dailyShifts.forEach(shift => {
                let empName = shift['員工編號'] ? (appData.staff.find(e => e['員工編號'] === shift['員工編號'])?.['姓名'] || shift['員工編號']) : '⚠️ 未指派';
                let btnClass = shift['員工編號'] ? 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50 shadow-sm' : 'bg-amber-50 text-amber-700 border-amber-400 border-dashed animate-pulse hover:bg-amber-100 shadow-sm';
                tableHtml += `<button onclick="openStaffPicker('${shift['員工編號']}', currentDept, (newEmp) => handleUnifiedAction('assign_matrix_emp', '${td.date}', '${shift['排班ID']}', newEmp))" class="w-full text-[11px] p-1.5 rounded border font-bold truncate transition ${btnClass}">${empName}</button>`;
            });
            tableHtml += `<button onclick="handleUnifiedAction('add_shift', '${td.date}')" class="text-[10px] text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50 rounded p-1 transition w-full text-center">➕ 派工</button></td>`;
        });
        tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table></div>`; container.innerHTML = tableHtml;
}

// === 彈出 Modal 與按鈕操作 ===
let modalTargetDate = null;
function updateModalEmp(empId) { document.getElementById('modalEmp').value = empId; document.getElementById('txtModalEmp').innerText = getEmpNameWithDefault(empId, '-- ⚠️ 放入待指派工作池 (留空) --'); }

function openShiftModal(shiftId = null, targetDate = null) {
    modalTargetDate = targetDate || getActiveContextDate();
    const modal = document.getElementById('shiftModal');
    const deptTasks = appData.tasks.filter(t => (t['部門名稱'] === currentDept || !t['部門名稱']) && t['狀態'] !== '停用');
    
    let selectedEmpId = shiftId ? (getActiveShifts(modalTargetDate).find(s => s['排班ID'] === shiftId)?.['員工編號'] || '') : '';
    updateModalEmp(selectedEmpId);
    
    document.getElementById('modalTask').innerHTML = deptTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    
    if(shiftId) {
        const shift = getActiveShifts(modalTargetDate).find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerHTML = '✏️ 編輯工作'; document.getElementById('modalShiftId').value = shiftId; document.getElementById('modalTask').value = shift['工作名稱']; document.getElementById('modalStart').value = shift['開始時間']; document.getElementById('modalEnd').value = shift['結束時間']; document.getElementById('modalCat').value = shift['工作類別']; document.getElementById('modalRemark1').value = shift['備註'] || ''; document.getElementById('modalRemark2').value = shift['備註2'] || ''; document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerHTML = '➕ 新增工作 (留空可加入工作池)'; document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); document.getElementById('modalStart').value = '08:00'; document.getElementById('modalEnd').value = '17:00'; document.getElementById('modalRemark1').value = ''; document.getElementById('modalRemark2').value = ''; document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }
function saveShift() { 
    handleUnifiedAction('update_remarks', modalTargetDate, document.getElementById('modalEmp').value, document.getElementById('modalRemark1').value, document.getElementById('modalRemark2').value); 
    const shiftData = { shiftId: document.getElementById('modalShiftId').value, date: modalTargetDate, dept: currentDept, empId: document.getElementById('modalEmp').value, task: document.getElementById('modalTask').value, start: document.getElementById('modalStart').value, end: document.getElementById('modalEnd').value, category: document.getElementById('modalCat').value, remark1: document.getElementById('modalRemark1').value, remark2: document.getElementById('modalRemark2').value };
    updateActiveShift(shiftData); closeShiftModal(); renderUnifiedGrid();
}
function deleteShift() { handleUnifiedAction('delete_shift', modalTargetDate, document.getElementById('modalShiftId').value); }

// ★ 修復：透過按鈕複製，不再綁定拖拉事件
function copyShift(ev, shiftId) {
    ev.stopPropagation(); // 阻止氣泡傳遞，避免打開 Modal
    const targetDate = getActiveContextDate();
    clipboardShift = getActiveShifts(targetDate).find(s => s['排班ID'] === shiftId);
    showToast("✅ 工作已複製，請在人員名稱下方點擊貼上");
    renderUnifiedGrid(); // 重新渲染以顯示貼上按鈕
}

// ★ 修復：精確指派複製來的資料，並將剪貼簿清空(一次性使用)
function pasteShift(empId) { 
    if (!clipboardShift) return; 
    const targetDate = getActiveContextDate();
    
    // 將 DB 資料格式轉換為 markDraft 支援的英文字段
    const shiftData = { 
        shiftId: 'S' + new Date().getTime(), 
        date: targetDate, 
        dept: currentDept, 
        empId: empId, 
        task: clipboardShift['工作名稱'], 
        start: clipboardShift['開始時間'], 
        end: clipboardShift['結束時間'], 
        category: clipboardShift['工作類別'], 
        remark1: clipboardShift['備註'], 
        remark2: clipboardShift['備註2'] 
    };
    
    updateActiveShift(shiftData); 
    clipboardShift = null; // 一次性使用
    showToast("✅ 已成功貼上工作"); 
    renderUnifiedGrid(); 
}

function allowDrop(ev) { ev.preventDefault(); }
function dragRow(ev, rowId) { ev.dataTransfer.setData("rowEmpId", rowId); }
function dragShift(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
function dropRow(ev, targetRowId) { 
    ev.preventDefault(); ev.stopPropagation(); const sourceRowId = ev.dataTransfer.getData("rowEmpId"); 
    if (sourceRowId && sourceRowId !== targetRowId) { 
        let shifts = getActiveShifts(getActiveContextDate()); let tempRows = [];
        const monthEmpIds = new Set(appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(document.getElementById('viewTimelineDate').value.substring(0, 7))).map(s => s['員工編號']));
        appData.staff.forEach(s => { if ((monthEmpIds.has(s['員工編號']) || (s['所屬組別'] === currentDept && s['所屬單位'] !== '離職')) && !s['員工編號'].startsWith('SYS_')) tempRows.push({ rowId: s['員工編號'], isDummy: false }); });
        tempRows.sort((a, b) => { let idxA = customStaffOrder.indexOf(a.rowId); let idxB = customStaffOrder.indexOf(b.rowId); return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB); });
        let currentOrder = tempRows.map(r => r.rowId);
        const sourceIdx = currentOrder.indexOf(sourceRowId); const targetIdx = currentOrder.indexOf(targetRowId); 
        if (sourceIdx !== -1 && targetIdx !== -1) { 
            currentOrder.splice(sourceIdx, 1); currentOrder.splice(targetIdx, 0, sourceRowId); customStaffOrder = currentOrder; 
            fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'update_staff_order', deptName: currentDept, order: customStaffOrder }) }).catch(e => {}); renderUnifiedGrid(); 
        } 
    } 
}

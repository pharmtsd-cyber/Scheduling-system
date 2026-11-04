let clipboardShift = null; 
let currentAdminMode = 'daily'; // 'daily' 或 'template'
let editingTemplateShifts = []; // 模板專區的暫存沙盒

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 平日排班：${deptName}`;
    
    try { const savedOrder = localStorage.getItem('staffOrder_' + currentDept); if (savedOrder) customStaffOrder = JSON.parse(savedOrder); } catch(e) {}
    
    const now = new Date();
    document.getElementById('interactiveDate').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    clipboardShift = null; 
    
    refreshTemplateSelects();
    switchAdminMode('daily'); // 預設進入每日管理
}

// === 雙模式切換 ===
function switchAdminMode(mode) {
    currentAdminMode = mode;
    const btnDaily = document.getElementById('btnModeDaily');
    const btnTemp = document.getElementById('btnModeTemplate');
    
    document.getElementById('toolbarDaily').classList.add('hidden');
    document.getElementById('toolbarTemplate').classList.add('hidden');
    
    if (mode === 'daily') {
        btnDaily.className = 'px-6 py-2 rounded font-bold transition shadow bg-white text-blue-700 border border-slate-300';
        btnTemp.className = 'px-6 py-2 rounded font-bold transition text-slate-500 hover:bg-slate-200 border border-transparent';
        document.getElementById('toolbarDaily').classList.remove('hidden');
    } else {
        btnTemp.className = 'px-6 py-2 rounded font-bold transition shadow bg-white text-purple-700 border border-slate-300';
        btnDaily.className = 'px-6 py-2 rounded font-bold transition text-slate-500 hover:bg-slate-200 border border-transparent';
        document.getElementById('toolbarTemplate').classList.remove('hidden');
        loadTemplateForEdit(); // 載入沙盒資料
    }
    renderUnifiedGrid();
}

function refreshTemplateSelects() {
    const temps = (appData.templates || []).filter(t => t['部門'] === currentDept && t['類型'] === '平日');
    const optionsHtml = temps.length ? temps.map(t => `<option value="${t['模板ID']}">${t['模板名稱']}</option>`).join('') : '<option value="">(尚無模板)</option>';
    
    const selDaily = document.getElementById('dailyApplyTempSelect');
    const selEdit = document.getElementById('editTempSelect');
    
    if (selDaily) selDaily.innerHTML = optionsHtml;
    if (selEdit) selEdit.innerHTML = '<option value="new">-- ✨ 建立全新模板 (另存) --</option>' + optionsHtml;
}

// === 模板沙盒載入與儲存 ===
function loadTemplateForEdit() {
    const tempId = document.getElementById('editTempSelect').value;
    if (tempId === 'new') {
        editingTemplateShifts = [];
        document.getElementById('editTempName').value = '';
    } else {
        const template = appData.templates.find(t => t['模板ID'] === tempId);
        document.getElementById('editTempName').value = template['模板名稱'];
        try { editingTemplateShifts = JSON.parse(template['排班快照']); } catch(e) { editingTemplateShifts = []; }
    }
    if (currentAdminMode === 'template') renderUnifiedGrid();
}

async function saveTemplateFromEditor() {
    const tempId = document.getElementById('editTempSelect').value;
    const tempName = document.getElementById('editTempName').value.trim();
    
    if (!tempName) return alert('請輸入模板名稱！');
    
    let targetId = tempId === 'new' ? 'T' + new Date().getTime() : tempId;
    
    document.body.style.cursor = 'wait';
    await fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'save_template', templateId: targetId, templateName: tempName, dept: currentDept, type: '平日', snapshot: JSON.stringify(editingTemplateShifts) }) 
    });
    showToast('💾 模板儲存成功！');
    await reloadData();
    refreshTemplateSelects();
    document.getElementById('editTempSelect').value = targetId;
    document.body.style.cursor = 'default';
}

function executeApplyTemplateToDaily() {
    const tempId = document.getElementById('dailyApplyTempSelect').value;
    if (!tempId) return alert('請先選擇模板');
    const template = appData.templates.find(t => t['模板ID'] === tempId);
    const dateStr = document.getElementById('interactiveDate').value;
    
    if (!confirm(`確定要將模板【${template['模板名稱']}】套用至 ${dateStr} 嗎？\n(本日現有班表將被覆蓋)`)) return;
    
    let sourceShifts = []; try { sourceShifts = JSON.parse(template['排班快照']); } catch(e) {}
    
    // 清除舊班表 (保留草稿邏輯)
    const oldShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && !s['員工編號'].startsWith('SYS_'));
    oldShifts.forEach(oldS => { appData.shifts = appData.shifts.filter(s => s['排班ID'] !== oldS['排班ID']); });
    
    // 寫入新草稿
    sourceShifts.forEach(shift => { 
        markDraft({ ...shift, shiftId: 'C' + new Date().getTime() + Math.random().toString(36).substr(2, 5), date: dateStr }); 
    });
    
    // 寫入綁定標籤
    const oldSys = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE');
    markDraft({ shiftId: oldSys ? oldSys['排班ID'] : 'T_LNK' + dateStr.replace(/-/g,''), date: dateStr, dept: currentDept, empId: 'SYS_TEMPLATE', task: tempId, start: '00:00', end: '00:00', category: 'SYS', remark1: template['模板名稱'], remark2: '' });
    
    showToast(`✅ 成功套用模板至 ${dateStr}！`);
    renderUnifiedGrid();
}

// === 統一事件代理 (路由到正確的資料源) ===
function getActiveShifts() {
    return currentAdminMode === 'template' ? editingTemplateShifts : appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === document.getElementById('interactiveDate').value);
}

function updateActiveShift(updatedData) {
    if (currentAdminMode === 'template') {
        const idx = editingTemplateShifts.findIndex(s => s['排班ID'] === updatedData.shiftId);
        const newData = { '排班ID': updatedData.shiftId, '日期': 'TEMPLATE', '部門名稱': currentDept, '員工編號': updatedData.empId, '工作名稱': updatedData.task, '開始時間': updatedData.start, '結束時間': updatedData.end, '工作類別': updatedData.category, '備註': updatedData.remark1, '備註2': updatedData.remark2 };
        if (idx > -1) editingTemplateShifts[idx] = newData; else editingTemplateShifts.push(newData);
    } else {
        markDraft(updatedData);
    }
}

function removeActiveShift(shiftId) {
    if (currentAdminMode === 'template') {
        editingTemplateShifts = editingTemplateShifts.filter(s => s['排班ID'] !== shiftId);
    } else {
        // 實際環境需透過清空 API，為求前端反應速度直接過濾
        appData.shifts = appData.shifts.filter(s => s['排班ID'] !== shiftId);
    }
}

function guardUnifiedAction(callback) {
    if (currentAdminMode === 'template') { callback(); return; } // 模板模式無脫鉤概念
    const dateStr = document.getElementById('interactiveDate').value;
    const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
    if (sysTemp) {
        if(confirm(`⚠️ 注意：本日已套用模板【${sysTemp['備註']}】。\n您現在的修改將會使本日與該模板【脫鉤】(僅變更本日班表)。\n確定要脫鉤並修改本日嗎？`)) {
            sysTemp['工作名稱'] = 'SYS_DECOUPLED';
            markDraft({ shiftId: sysTemp['排班ID'], date: dateStr, dept: currentDept, empId: 'SYS_TEMPLATE', task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: '' });
            callback();
        }
    } else { callback(); }
}

// ★ 確保備註載體存在 (若無實體工作，建立 EMP_REMARK)
function ensureRemarkCarrier(empId, topVal, bottomVal) {
    if (!empId) return; // 待指派列不儲存個人備註
    let shifts = getActiveShifts();
    let myShifts = shifts.filter(s => s['員工編號'] === empId);
    
    if (myShifts.length === 0) {
        const newId = 'R' + new Date().getTime();
        updateActiveShift({ shiftId: newId, date: document.getElementById('interactiveDate').value, dept: currentDept, empId: empId, task: 'EMP_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: topVal || '', remark2: bottomVal || '' });
    } else {
        const shift = myShifts[0];
        updateActiveShift({ shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: topVal !== null ? topVal : shift['備註'], remark2: bottomVal !== null ? bottomVal : shift['備註2'] });
    }
    renderUnifiedGrid();
}

function handleUnifiedAction(actionType, ...args) {
    guardUnifiedAction(() => {
        if (actionType === 'add_shift') {
            openShiftModal();
        } else if (actionType === 'update_remarks') {
            ensureRemarkCarrier(args[0], args[1], args[2]);
        } else if (actionType === 'update_sys_remark') {
            let shifts = getActiveShifts();
            let sysShift = shifts.find(s => s['員工編號'] === 'SYS_REMARK');
            if (!sysShift) {
                updateActiveShift({ shiftId: 'SYS_R_' + new Date().getTime(), date: document.getElementById('interactiveDate').value, dept: currentDept, empId: 'SYS_REMARK', task: 'SYS_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: args[0] !== null ? args[0] : '', remark2: args[1] !== null ? args[1] : '' });
            } else {
                updateActiveShift({ shiftId: sysShift['排班ID'], date: sysShift['日期'], dept: sysShift['部門名稱'], empId: 'SYS_REMARK', task: 'SYS_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: args[0] !== null ? args[0] : sysShift['備註'], remark2: args[1] !== null ? args[1] : sysShift['備註2'] });
            }
        } else if (actionType === 'move_shift_emp') {
            const shift = getActiveShifts().find(s => s['排班ID'] === args[0]);
            if (shift) { updateActiveShift({ shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: args[1], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] }); renderUnifiedGrid(); }
        } else if (actionType === 'delete_shift') {
            removeActiveShift(args[0]); closeShiftModal(); renderUnifiedGrid();
        } else if (actionType === 'save_shift') {
            updateActiveShift({ shiftId: document.getElementById('modalShiftId').value, date: document.getElementById('interactiveDate').value, dept: currentDept, empId: document.getElementById('modalEmp').value, task: document.getElementById('modalTask').value, start: document.getElementById('modalStart').value, end: document.getElementById('modalEnd').value, category: document.getElementById('modalCat').value, remark1: document.getElementById('modalRemark1').value, remark2: document.getElementById('modalRemark2').value });
            closeShiftModal(); renderUnifiedGrid();
        }
    });
}

// === 統一渲染引擎 (Unified Render Engine) ===
function renderUnifiedGrid() {
    const container = document.getElementById('unifiedGrid');
    container.innerHTML = '';
    const shifts = getActiveShifts();
    
    // --- 狀態列 (僅每日模式) ---
    if (currentAdminMode === 'daily') {
        const date = document.getElementById('interactiveDate').value;
        const activeTemplate = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
        const statusContainer = document.getElementById('dailyTemplateStatus');
        if (activeTemplate) {
            statusContainer.innerHTML = `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200 shadow-sm">🏷️ 已套用：${activeTemplate['備註'] || activeTemplate['remark1'] || '模板'}</span>
            <button onclick="manualDecouple('${date}')" class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1.5 rounded border border-red-200 font-bold shadow-sm transition">✂️ 解除綁定</button>`;
        } else {
            const decoupled = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] === 'SYS_DECOUPLED');
            statusContainer.innerHTML = decoupled ? `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded border border-orange-200">⚠️ 此日已與模板脫鉤</span>` : `<span class="text-xs text-slate-400 font-bold px-2 py-1">📝 自由排班模式</span>`;
        }
    }

    // --- 取得人員名單 ---
    const monthEmpIds = new Set(appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(document.getElementById('interactiveDate').value.substring(0, 7))).map(s => s['員工編號']));
    let deptStaffMap = new Map();
    appData.staff.forEach(s => { if (monthEmpIds.has(s['員工編號']) || (s['所屬組別'] === currentDept && s['所屬單位'] !== '離職')) deptStaffMap.set(s['員工編號'], s); });
    deptStaffMap.delete('SYS_REMARK'); deptStaffMap.delete('SYS_TEMPLATE'); deptStaffMap.delete('');
    const deptStaff = Array.from(deptStaffMap.values());

    // --- 系統備註 ---
    const sysRemarkShift = shifts.find(s => s['員工編號'] === 'SYS_REMARK') || {};
    container.innerHTML += `<div class="bg-yellow-50 border-b border-yellow-200 p-2 flex items-center gap-4">
        <span class="text-yellow-700 font-bold text-sm shrink-0">📢 頂部備註：</span>
        <input type="text" class="flex-1 bg-transparent border-b border-yellow-300 focus:border-yellow-600 outline-none text-sm text-yellow-800" value="${sysRemarkShift['備註'] || ''}" placeholder="輸入頂部備註..." onblur="handleUnifiedAction('update_sys_remark', this.value, null)">
    </div>`;

    // --- 表頭 ---
    let headerHtml = `<div class="flex border-b bg-slate-200 text-[11px] font-bold text-slate-600 sticky top-0 z-20">
        <div class="w-24 p-2 border-r text-center shrink-0 flex items-center justify-center bg-slate-200"><span class="w-4">#</span> <span class="flex-1">人員名單</span></div>
        <div class="w-32 p-2 border-r text-center shrink-0 flex items-center justify-center text-blue-700 bg-blue-50">個人備註</div>
        <div class="flex-1 flex min-w-[500px]">`;
    for(let i=8; i<=21; i++) headerHtml += `<div class="flex-1 border-l border-slate-300 pl-1 py-1 text-slate-700">${i}:00</div><div class="flex-1 border-l border-dashed border-slate-300 pl-1 py-1 text-[9px] text-slate-400">30</div>`;
    headerHtml += `<div class="w-8 border-l border-slate-300 pl-1 py-1 text-slate-700">22</div></div><div class="w-40 p-2 border-l text-center shrink-0 flex items-center justify-center text-teal-700 bg-teal-50">工作補充</div></div>`;
    container.innerHTML += headerHtml;

    // --- 排序與整合實體/虛擬列 ---
    let displayRows = [];
    deptStaff.forEach(emp => { displayRows.push({ ...emp, isDummy: false, rowId: emp['員工編號'] }); });
    const unassignedShifts = shifts.filter(s => s['員工編號'] === '');
    unassignedShifts.forEach(shift => { displayRows.push({ '員工編號': '', '姓名': '⚠️ 待指派', '所屬單位': currentDept, '所屬組別': currentDept, isDummy: true, rowId: shift['排班ID'], shiftData: shift }); });

    displayRows.sort((a, b) => {
        let idxA = customStaffOrder.indexOf(a.rowId); let idxB = customStaffOrder.indexOf(b.rowId);
        let defA = a.isDummy ? -1 : 999; let defB = b.isDummy ? -1 : 999;
        return (idxA === -1 ? defA : idxA) - (idxB === -1 ? defB : idxB);
    });

    // --- 繪製列 ---
    let realRowIndex = 0;
    displayRows.forEach((emp, index) => {
        const isDummy = emp.isDummy; 
        let myShifts = isDummy ? [emp.shiftData] : shifts.filter(s => s['員工編號'] == emp['員工編號'] && s['工作名稱'] !== 'EMP_REMARK');
        let remarkCarrier = shifts.find(s => s['員工編號'] == emp['員工編號'] && s['工作名稱'] === 'EMP_REMARK');
        
        // 抓取備註優先序：實體工作 > 虛擬載體
        let mainShift = myShifts.length > 0 ? myShifts[0] : remarkCarrier;
        let r1 = mainShift ? (mainShift['備註'] || '') : '';
        let r2 = mainShift ? (mainShift['備註2'] || '') : '';
        
        let rowClass = isDummy ? 'bg-amber-50/40 border-b-2 border-dashed border-amber-300' : (realRowIndex % 2 === 0 ? 'bg-white hover:bg-slate-50 border-b border-slate-200' : 'bg-blue-50/20 hover:bg-blue-50/60 border-b border-slate-200');
        if (!isDummy) realRowIndex++;
        
        let dragProps = `draggable="true" ondragstart="dragRow(event, '${emp.rowId}')" ondragover="allowDrop(event)" ondrop="dropRow(event, '${emp.rowId}')"`;
        let nameActionHtml = isDummy ? 
            `<div class="text-amber-800 text-sm font-extrabold cursor-pointer hover:bg-amber-200 px-2 py-0.5 rounded shadow-sm border border-amber-300 bg-amber-50" onclick="guardUnifiedAction(() => openStaffPicker('', currentDept, (newEmp) => handleUnifiedAction('move_shift_emp', '${emp.shiftData['排班ID']}', newEmp)))">${emp['姓名']} <span class="text-[10px]">👆</span></div>` : 
            `<span class="text-blue-700 font-bold w-full text-center">${emp['姓名']}</span>`;

        let rowHtml = `<div class="flex timeline-container group transition ${rowClass} h-[50px]">
            <div class="w-24 p-1 border-r ${isDummy ? 'bg-amber-100/60 border-r-amber-300' : 'border-r-slate-200'} flex flex-col items-center justify-center shadow-sm z-10 relative cursor-ns-resize shrink-0" ${dragProps}>
                <div class="absolute top-0 left-0 bg-slate-300 text-slate-700 text-[9px] px-1.5 py-0.5 rounded-br-lg shadow-sm font-bold z-20">${index + 1}</div>
                <div class="font-bold truncate w-full text-center flex flex-col items-center gap-0 mt-3">${nameActionHtml}</div>
            </div>
            
            <div class="w-32 border-r ${isDummy ? 'bg-amber-50/50 border-r-amber-300' : 'bg-transparent border-r-slate-200'} flex items-center p-1 shrink-0">
                <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-blue-400 focus:ring-1 rounded bg-white text-blue-800 font-bold shadow-inner"
                       placeholder="輸入備註..." value="${r1}" onblur="handleUnifiedAction('update_remarks', '${emp['員工編號']}', this.value, null)">
            </div>
            
            <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="guardUnifiedAction(() => dropShift(event, '${emp['員工編號']}'))">
                <div class="absolute inset-0 flex pointer-events-none opacity-20">`;
        for(let i=8; i<=21; i++) rowHtml += `<div class="flex-1 border-l border-slate-400"></div><div class="flex-1 border-l border-dashed border-slate-400"></div>`;
        rowHtml += `</div>`;

        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100; const width = ((eh - sh) + (em - sm)/60) / 14 * 100;
            let shiftBg = isDummy ? 'bg-amber-100 border-2 border-dashed border-amber-500 hover:bg-amber-200' : 'bg-blue-100 border border-blue-400 hover:bg-blue-200';
            
            rowHtml += `<div class="absolute top-[4px] bottom-[4px] ${shiftBg} shadow-sm rounded flex flex-col justify-center items-center cursor-grab active:cursor-grabbing transition overflow-hidden z-10"
                             draggable="true" ondragstart="dragShift(event, '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <div class="font-bold text-${isDummy?'amber':'blue'}-900 text-xs truncate w-full text-center px-1 flex justify-center items-center gap-1">
                    <span class="cursor-pointer hover:opacity-70" onclick="guardUnifiedAction(() => openShiftModal('${shift['排班ID']}'))">${shift['工作名稱']}</span>
                </div>
                <div class="text-[9px] text-${isDummy?'amber':'slate'}-600 font-semibold mt-[2px]">${shift['開始時間']} - ${shift['結束時間']}</div>
            </div>`;
        });
        rowHtml += `</div><div class="w-40 border-l ${isDummy ? 'bg-amber-50/50 border-l-amber-300' : 'bg-transparent border-l-slate-200'} flex items-center p-1 shrink-0">
            <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-teal-400 focus:ring-1 rounded bg-white text-teal-800 shadow-inner"
                   placeholder="補充說明..." value="${r2}" onblur="handleUnifiedAction('update_remarks', '${emp['員工編號']}', null, this.value)">
        </div></div>`; 
        container.innerHTML += rowHtml;
    });

    container.innerHTML += `<div class="bg-yellow-50 border-t border-yellow-200 p-2 flex items-center gap-2 mt-2">
        <span class="text-yellow-700 font-bold text-sm shrink-0">📢 底部備註：</span>
        <input type="text" class="flex-1 bg-transparent border-b border-yellow-300 focus:border-yellow-600 outline-none text-sm text-yellow-800" value="${sysRemarkShift['備註2'] || ''}" placeholder="輸入底部備註..." onblur="handleUnifiedAction('update_sys_remark', null, this.value)">
    </div>`;
}

// === 拖曳與輔助 ===
function allowDrop(ev) { ev.preventDefault(); }
function dragRow(ev, rowId) { ev.dataTransfer.setData("rowEmpId", rowId); }
function dragShift(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
function dropShift(ev, newEmpId) { ev.preventDefault(); const shiftId = ev.dataTransfer.getData("shiftId"); if(shiftId) handleUnifiedAction('move_shift_emp', shiftId, newEmpId); }
function dropRow(ev, targetRowId) { 
    ev.preventDefault(); ev.stopPropagation(); const sourceRowId = ev.dataTransfer.getData("rowEmpId"); 
    if (sourceRowId && sourceRowId !== targetRowId) { 
        let shifts = getActiveShifts();
        let tempRows = [];
        const { deptStaff } = getMixedDeptStaff(document.getElementById('interactiveDate').value.substring(0, 7));
        deptStaff.forEach(emp => tempRows.push({ rowId: emp['員工編號'], isDummy: false }));
        shifts.filter(s => s['員工編號'] === '').forEach(shift => tempRows.push({ rowId: shift['排班ID'], isDummy: true }));
        
        tempRows.sort((a, b) => {
            let idxA = customStaffOrder.indexOf(a.rowId); let idxB = customStaffOrder.indexOf(b.rowId);
            return (idxA === -1 ? (a.isDummy?-1:999) : idxA) - (idxB === -1 ? (b.isDummy?-1:999) : idxB);
        });
        let currentOrder = tempRows.map(r => r.rowId);
        const sourceIdx = currentOrder.indexOf(sourceRowId); const targetIdx = currentOrder.indexOf(targetRowId); 
        if (sourceIdx !== -1 && targetIdx !== -1) { 
            currentOrder.splice(sourceIdx, 1); currentOrder.splice(targetIdx, 0, sourceRowId); 
            customStaffOrder = currentOrder; 
            fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'update_staff_order', deptName: currentDept, order: customStaffOrder }) }).catch(e => {});
            renderUnifiedGrid(); 
        } 
    } 
}

function updateModalEmp(empId) { document.getElementById('modalEmp').value = empId; document.getElementById('txtModalEmp').innerText = getEmpNameWithDefault(empId, '-- ⚠️ 未指派 (留空) --'); }
function openShiftModal(shiftId = null) {
    const modal = document.getElementById('shiftModal');
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']);
    let selectedEmpId = shiftId ? (getActiveShifts().find(s => s['排班ID'] === shiftId)?.['員工編號'] || '') : '';
    updateModalEmp(selectedEmpId);
    document.getElementById('modalTask').innerHTML = deptTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    if(shiftId) {
        const shift = getActiveShifts().find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerText = '編輯工作'; document.getElementById('modalShiftId').value = shiftId; document.getElementById('modalTask').value = shift['工作名稱']; document.getElementById('modalStart').value = shift['開始時間']; document.getElementById('modalEnd').value = shift['結束時間']; document.getElementById('modalCat').value = shift['工作類別']; document.getElementById('modalRemark1').value = shift['備註'] || ''; document.getElementById('modalRemark2').value = shift['備註2'] || ''; document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = '新增工作 (可先不選人)'; document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); document.getElementById('modalStart').value = '08:00'; document.getElementById('modalEnd').value = '12:00'; document.getElementById('modalRemark1').value = ''; document.getElementById('modalRemark2').value = ''; document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}
function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }

let currentAdminTab = 'daily'; // 'daily' 或 'template'
let currentViewMode = 'timeline'; // 'timeline' 或 'matrix'
let studioShifts = []; // 模板設計專區的暫存沙盒
let engineSpecificDates = []; // 進階套用的特定日期清單

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 排班管理中心：${deptName}`;
    
    try { const savedOrder = localStorage.getItem('staffOrder_' + currentDept); if (savedOrder) customStaffOrder = JSON.parse(savedOrder); } catch(e) {}
    
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('viewTimelineDate').value = `${currMonthStr}-01`;
    document.getElementById('engineTargetMonth').value = currMonthStr;
    document.getElementById('viewMatrixMonth').value = currMonthStr;
    
    refreshTemplateLists();
    switchAdminTab('daily');
}

// === 頁籤與視圖切換 ===
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
        currentViewMode = 'timeline'; // 模板設計強制使用時間軸模式
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
        btnTime.className = 'px-3 py-1 rounded text-sm font-bold bg-white text-blue-600 shadow-sm border border-slate-200';
        btnMat.className = 'px-3 py-1 rounded text-sm font-bold text-slate-500 hover:bg-slate-200 border border-transparent';
        document.getElementById('viewTimelineDate').classList.remove('hidden');
    } else {
        btnMat.className = 'px-3 py-1 rounded text-sm font-bold bg-white text-blue-600 shadow-sm border border-slate-200';
        btnTime.className = 'px-3 py-1 rounded text-sm font-bold text-slate-500 hover:bg-slate-200 border border-transparent';
        document.getElementById('viewMatrixFilters').classList.remove('hidden');
        document.getElementById('viewMatrixFilters').classList.add('flex');
    }
    renderUnifiedGrid();
}

// === 共用資料獲取與儲存路由 ===
function getActiveContextDate() {
    return currentAdminTab === 'template' ? 'TEMPLATE' : document.getElementById('viewTimelineDate').value;
}

function getActiveShifts(forMatrixDate = null) {
    if (currentAdminTab === 'template') return studioShifts;
    if (currentViewMode === 'matrix' && forMatrixDate) {
        return appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === forMatrixDate);
    }
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

// 防呆脫鉤攔截 (自動將傳入的 targetDate 脫鉤)
function guardUnifiedAction(targetDate, callback) {
    if (currentAdminTab === 'template') { callback(); return; }
    const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === targetDate && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
    if (sysTemp) {
        if(confirm(`⚠️ 脫鉤警告：${targetDate} 已套用模板【${sysTemp['備註']}】。\n您現在的修改將會使該日獨立脫鉤。\n\n確定要脫鉤並修改嗎？`)) {
            sysTemp['工作名稱'] = 'SYS_DECOUPLED';
            markDraft({ shiftId: sysTemp['排班ID'], date: targetDate, dept: currentDept, empId: 'SYS_TEMPLATE', task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: '' });
            callback();
        }
    } else { callback(); }
}

// 統一動作分配中心
function handleUnifiedAction(action, dateContext, ...args) {
    const targetDate = currentAdminTab === 'template' ? 'TEMPLATE' : (dateContext || document.getElementById('viewTimelineDate').value);
    
    guardUnifiedAction(targetDate, () => {
        if (action === 'add_shift') { openShiftModal(null, targetDate); }
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
            } else {
                updateActiveShift({ shiftId: shift['排班ID'], date: targetDate, dept: currentDept, empId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: r1 !== null ? r1 : shift['備註'], remark2: r2 !== null ? r2 : shift['備註2'] });
            }
            renderUnifiedGrid();
        }
        else if (action === 'assign_matrix_emp') {
            // 矩陣視圖下的直接派工
            const shiftId = args[0]; const newEmpId = args[1];
            const shift = getActiveShifts(targetDate).find(s => s['排班ID'] === shiftId);
            if(shift) { updateActiveShift({ shiftId: shift['排班ID'], date: targetDate, dept: currentDept, empId: newEmpId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] }); renderUnifiedGrid(); }
        }
        else if (action === 'delete_shift') {
            const shiftId = args[0];
            if (currentAdminTab === 'template') studioShifts = studioShifts.filter(s => s['排班ID'] !== shiftId);
            else appData.shifts = appData.shifts.filter(s => s['排班ID'] !== shiftId);
            closeShiftModal(); renderUnifiedGrid();
        }
    });
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
        document.getElementById('studioTempName').value = template['模板名稱'];
        document.getElementById('studioTempCat').value = template['類型'] || '平日';
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

// 引擎：自訂日期 UI 控制
function toggleEngineSpecificDates() { document.getElementById('engineSpecificDatesPanel').classList.toggle('hidden'); }
function addEngineSpecificDate() {
    const d = document.getElementById('engineSpecificDateInput').value;
    if(!d || engineSpecificDates.includes(d)) return;
    engineSpecificDates.push(d); engineSpecificDates.sort(); renderEngineSpecificDates();
}
function removeEngineSpecificDate(d) { engineSpecificDates = engineSpecificDates.filter(x => x !== d); renderEngineSpecificDates(); }
function renderEngineSpecificDates() {
    document.getElementById('engineSpecificDatesList').innerHTML = engineSpecificDates.map(d => `<span class="bg-teal-100 text-teal-800 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">${d} <b class="cursor-pointer text-red-500" onclick="removeEngineSpecificDate('${d}')">×</b></span>`).join('');
}

// 引擎：執行進階套用
function executeAdvancedApply() {
    const tempId = document.getElementById('engineTempSelect').value;
    if (!tempId) return alert('請選擇模板');
    const template = appData.templates.find(t => t['模板ID'] === tempId);
    let sourceShifts = []; try { sourceShifts = JSON.parse(template['排班快照']); } catch(e) {}
    
    let targetDates = new Set([...engineSpecificDates]); // 加入自訂日期
    
    const monthVal = document.getElementById('engineTargetMonth').value;
    if (monthVal) {
        const checkboxes = document.querySelectorAll('input[name="engineRule"]:checked');
        let allowedDow = [];
        checkboxes.forEach(cb => {
            if(cb.value === 'weekday') allowedDow.push(1,2,3,4,5);
            else allowedDow.push(parseInt(cb.value));
        });
        
        if (allowedDow.length > 0) {
            const [y, m] = monthVal.split('-'); const daysInMonth = new Date(y, m, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                let dt = new Date(y, parseInt(m)-1, d);
                if (allowedDow.includes(dt.getDay())) targetDates.add(`${y}-${m}-${String(d).padStart(2,'0')}`);
            }
        }
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
    
    showToast(`✅ 成功套用模板至 ${dateArray.length} 天！請記得儲存發佈。`);
    engineSpecificDates = []; renderEngineSpecificDates();
    if (currentAdminTab === 'daily') {
        document.getElementById('viewTimelineDate').value = dateArray[0];
        document.getElementById('viewMatrixMonth').value = dateArray[0].substring(0,7);
    }
    renderUnifiedGrid();
}

// === 大統一渲染引擎 ===
function renderUnifiedGrid() {
    if (currentAdminTab === 'template' || currentViewMode === 'timeline') {
        renderTimelineView();
    } else {
        renderMatrixView();
    }
}

function renderTimelineView() {
    const container = document.getElementById('unifiedGrid'); container.innerHTML = '';
    const targetDate = getActiveContextDate();
    const shifts = getActiveShifts(targetDate);
    
    // 渲染狀態列
    if (currentAdminTab === 'daily') {
        const activeTemplate = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
        const statusContainer = document.getElementById('dailyTemplateStatus');
        if (activeTemplate) {
            const tName = activeTemplate['備註'] || activeTemplate['remark1'] || '未知模板';
            statusContainer.innerHTML = `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200 shadow-sm">🏷️ 已套用：${tName}</span>
            <button onclick="manualDecouple('${targetDate}')" class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1.5 rounded border border-red-200 font-bold shadow-sm transition">✂️ 解除綁定 (脫鉤)</button>`;
        } else {
            const decoupled = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] === 'SYS_DECOUPLED');
            statusContainer.innerHTML = decoupled ? `<span class="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded border border-orange-200">⚠️ 已獨立脫鉤修改</span>` : `<span class="text-xs text-slate-400 font-bold px-2 py-1">📝 自由排班模式</span>`;
        }
    }

    const { deptStaffMap } = typeof getMixedDeptStaff === 'function' ? getMixedDeptStaff(targetDate === 'TEMPLATE' ? document.getElementById('interactiveDate').value.substring(0,7) : targetDate.substring(0, 7)) : { deptStaffMap: new Map() };
    
    // 人員名單準備 (同舊版邏輯)
    let displayRows = [];
    appData.staff.forEach(s => {
        if ((s['所屬組別'] === currentDept && s['所屬單位'] !== '離職') || shifts.some(sh => sh['員工編號'] === s['員工編號'])) {
            if (!s['員工編號'].startsWith('SYS_')) displayRows.push({ ...s, isDummy: false, rowId: s['員工編號'] });
        }
    });
    shifts.filter(s => s['員工編號'] === '').forEach(shift => { displayRows.push({ '員工編號': '', '姓名': '⚠️ 待指派', '所屬單位': currentDept, '所屬組別': currentDept, isDummy: true, rowId: shift['排班ID'], shiftData: shift }); });
    
    displayRows.sort((a, b) => {
        let idxA = customStaffOrder.indexOf(a.rowId); let idxB = customStaffOrder.indexOf(b.rowId);
        return (idxA === -1 ? (a.isDummy?-1:999) : idxA) - (idxB === -1 ? (b.isDummy?-1:999) : idxB);
    });

    // 繪製表頭 (省略重複程式碼，同舊版時間軸表頭結構)
    let headerHtml = `<div class="flex border-b bg-slate-200 text-[11px] font-bold text-slate-600 sticky top-0 z-20"><div class="w-24 p-2 border-r text-center shrink-0 flex items-center justify-center bg-slate-200"><span class="w-4">#</span> <span class="flex-1">人員名單</span></div><div class="w-32 p-2 border-r text-center shrink-0 flex items-center justify-center text-blue-700 bg-blue-50">個人備註</div><div class="flex-1 flex min-w-[500px]">`;
    for(let i=8; i<=21; i++) headerHtml += `<div class="flex-1 border-l border-slate-300 pl-1 py-1 text-slate-700">${i}:00</div><div class="flex-1 border-l border-dashed border-slate-300 pl-1 py-1 text-[9px] text-slate-400">30</div>`;
    headerHtml += `<div class="w-8 border-l border-slate-300 pl-1 py-1 text-slate-700">22</div></div><div class="w-40 p-2 border-l text-center shrink-0 flex items-center justify-center text-teal-700 bg-teal-50">工作補充</div></div>`;
    container.innerHTML += headerHtml;

    let realRowIndex = 0;
    displayRows.forEach((emp, index) => {
        const isDummy = emp.isDummy; 
        let myShifts = isDummy ? [emp.shiftData] : shifts.filter(s => s['員工編號'] == emp['員工編號'] && s['工作名稱'] !== 'EMP_REMARK');
        let remarkCarrier = shifts.find(s => s['員工編號'] == emp['員工編號'] && s['工作名稱'] === 'EMP_REMARK');
        let mainShift = myShifts.length > 0 ? myShifts[0] : remarkCarrier;
        let r1 = mainShift ? (mainShift['備註'] || '') : ''; let r2 = mainShift ? (mainShift['備註2'] || '') : '';
        
        let rowClass = isDummy ? 'bg-amber-50/40 border-b-2 border-dashed border-amber-300' : (realRowIndex % 2 === 0 ? 'bg-white hover:bg-slate-50 border-b border-slate-200' : 'bg-blue-50/20 hover:bg-blue-50/60 border-b border-slate-200');
        if (!isDummy) realRowIndex++;
        
        let nameActionHtml = isDummy ? 
            `<div class="text-amber-800 text-sm font-extrabold cursor-pointer hover:bg-amber-200 px-2 py-0.5 rounded shadow-sm border border-amber-300 bg-amber-50" onclick="openStaffPicker('', currentDept, (newEmp) => handleUnifiedAction('move_shift_emp', '${targetDate}', '${emp.shiftData['排班ID']}', newEmp))">${emp['姓名']} <span class="text-[10px]">👆</span></div>` : 
            `<span class="text-blue-700 font-bold w-full text-center">${emp['姓名']}</span>`;

        let rowHtml = `<div class="flex timeline-container group transition ${rowClass} h-[50px]">
            <div class="w-24 p-1 border-r ${isDummy ? 'bg-amber-100/60 border-r-amber-300' : 'border-r-slate-200'} flex flex-col items-center justify-center shadow-sm z-10 relative shrink-0">
                <div class="absolute top-0 left-0 bg-slate-300 text-slate-700 text-[9px] px-1.5 py-0.5 rounded-br-lg shadow-sm font-bold z-20">${index + 1}</div>
                <div class="font-bold truncate w-full text-center flex flex-col items-center gap-0 mt-3">${nameActionHtml}</div>
            </div>
            
            <div class="w-32 border-r ${isDummy ? 'bg-amber-50/50 border-r-amber-300' : 'bg-transparent border-r-slate-200'} flex items-center p-1 shrink-0">
                <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-blue-400 focus:ring-1 rounded bg-transparent text-blue-800 font-bold"
                       placeholder="備註..." value="${r1}" onblur="handleUnifiedAction('update_remarks', '${targetDate}', '${emp['員工編號']}', this.value, null)">
            </div>
            
            <div class="flex-1 relative">
                <div class="absolute inset-0 flex pointer-events-none opacity-20">`;
        for(let i=8; i<=21; i++) rowHtml += `<div class="flex-1 border-l border-slate-400"></div><div class="flex-1 border-l border-dashed border-slate-400"></div>`;
        rowHtml += `</div>`;

        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100; const width = ((eh - sh) + (em - sm)/60) / 14 * 100;
            let shiftBg = isDummy ? 'bg-amber-100 border-2 border-dashed border-amber-500 hover:bg-amber-200' : 'bg-blue-100 border border-blue-400 hover:bg-blue-200';
            
            rowHtml += `<div class="absolute top-[4px] bottom-[4px] ${shiftBg} shadow-sm rounded flex flex-col justify-center items-center cursor-pointer transition overflow-hidden z-10"
                             onclick="handleUnifiedAction('add_shift', '${targetDate}', '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <div class="font-bold text-${isDummy?'amber':'blue'}-900 text-xs truncate w-full text-center px-1">${shift['工作名稱']}</div>
                <div class="text-[9px] text-${isDummy?'amber':'slate'}-600 font-semibold mt-[2px]">${shift['開始時間']} - ${shift['結束時間']}</div>
            </div>`;
        });
        rowHtml += `</div><div class="w-40 border-l ${isDummy ? 'bg-amber-50/50 border-l-amber-300' : 'bg-transparent border-l-slate-200'} flex items-center p-1 shrink-0">
            <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-teal-400 focus:ring-1 rounded bg-transparent text-teal-800"
                   placeholder="補充..." value="${r2}" onblur="handleUnifiedAction('update_remarks', '${targetDate}', '${emp['員工編號']}', null, this.value)">
        </div></div>`; 
        container.innerHTML += rowHtml;
    });
}

function renderMatrixView() {
    const container = document.getElementById('unifiedGrid'); container.innerHTML = '';
    const monthStr = document.getElementById('viewMatrixMonth').value;
    if(!monthStr) return;
    const dowFilter = document.getElementById('viewMatrixDow').value;
    const allowedDows = dowFilter === 'ALL' ? [0,1,2,3,4,5,6] : dowFilter.split(',').map(Number);
    
    const [y, m] = monthStr.split('-'); const daysInMonth = new Date(y, m, 0).getDate();
    let targetDates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        let dt = new Date(y, parseInt(m)-1, d);
        if (allowedDows.includes(dt.getDay())) targetDates.push({ date: `${y}-${m}-${String(d).padStart(2,'0')}`, dayName: ['日','一','二','三','四','五','六'][dt.getDay()] });
    }
    if(targetDates.length === 0) { container.innerHTML = '<div class="p-4 text-slate-500 font-bold">此篩選條件下無符合的日期。</div>'; return; }

    const monthShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr));
    let usedTasks = new Set();
    monthShifts.forEach(s => { if(!s['員工編號'].startsWith('SYS_') && s['工作名稱'] !== 'EMP_REMARK') usedTasks.add(s['工作名稱']); });
    appData.tasks.filter(t => t['部門名稱'] === currentDept).forEach(t => usedTasks.add(t['工作名稱']));
    const taskArray = Array.from(usedTasks).sort();

    let tableHtml = `<table class="w-full text-left border-collapse text-sm"><thead class="bg-slate-200 sticky top-0 z-20 shadow-sm text-slate-700"><tr>
        <th class="border p-2 w-10 text-center">#</th>
        <th class="border p-2 w-20 text-center">部門</th>
        <th class="border p-2 w-32">工作名稱</th>`;
    
    targetDates.forEach(td => { tableHtml += `<th class="border p-2 text-center w-24 leading-tight">${td.date.substring(5)}<br><span class="text-[10px] text-slate-500">(${td.dayName})</span></th>`; });
    tableHtml += `</tr></thead><tbody class="bg-white">`;

    taskArray.forEach((taskName, idx) => {
        const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
        tableHtml += `<tr class="${rowClass} hover:bg-blue-50/30 transition">
            <td class="border p-2 text-center text-slate-400 font-bold">${idx + 1}</td>
            <td class="border p-2 text-center text-xs font-bold text-slate-600">${currentDept}</td>
            <td class="border p-2 font-bold text-blue-800">${taskName}</td>`;
        
        targetDates.forEach(td => {
            const dailyShifts = monthShifts.filter(s => s['日期'] === td.date && s['工作名稱'] === taskName);
            tableHtml += `<td class="border p-1 text-center align-top gap-1 flex flex-col">`;
            
            dailyShifts.forEach(shift => {
                let empName = shift['員工編號'] ? (appData.staff.find(e => e['員工編號'] === shift['員工編號'])?.['姓名'] || shift['員工編號']) : '⚠️ 未指派';
                let btnClass = shift['員工編號'] ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse hover:bg-amber-200';
                tableHtml += `<button onclick="openStaffPicker('${shift['員工編號']}', currentDept, (newEmp) => handleUnifiedAction('assign_matrix_emp', '${td.date}', '${shift['排班ID']}', newEmp))" class="w-full text-[10px] p-1 rounded border shadow-sm font-bold truncate transition ${btnClass}">${empName}</button>`;
            });
            tableHtml += `<button onclick="handleUnifiedAction('add_shift', '${td.date}')" class="text-[9px] text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 rounded p-0.5 mt-1 transition">➕</button>`;
            tableHtml += `</td>`;
        });
        tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table>`; container.innerHTML = tableHtml;
}

// === 彈出 Modal 控制邏輯 (與舊版相容，補上 targetDate 傳遞) ===
let modalTargetDate = null;
function openShiftModal(shiftId = null, targetDate) {
    modalTargetDate = targetDate;
    const modal = document.getElementById('shiftModal');
    // ...(其餘邏輯同舊版，需於 saveShift() 中讀取 modalTargetDate 寫回)
    modal.classList.remove('hidden');
}
function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }
function manualDecouple(dateStr) { handleUnifiedAction('decouple', dateStr); }

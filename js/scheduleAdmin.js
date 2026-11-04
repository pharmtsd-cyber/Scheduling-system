let clipboardShift = null; 
let tempTargetDaysList = [];

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 平日排班：${deptName}`;
    
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('interactiveDate').value = `${nextMonthStr}-01`;
    clipboardShift = null; 
    renderTemplateSelect();
    renderInteractiveGrid();
}

// 取得該部門該月份應顯示的「混合員工名單」
function getMixedDeptStaff(monthStr) {
    const monthShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr));
    const monthEmpIds = new Set(monthShifts.map(s => s['員工編號']));
    
    let deptStaffMap = new Map();
    appData.staff.forEach(s => {
        if (monthEmpIds.has(s['員工編號']) || (s['所屬組別'] === currentDept && s['所屬單位'] !== '離職')) {
            deptStaffMap.set(s['員工編號'], s);
        }
    });
    deptStaffMap.delete('SYS_REMARK'); 
    deptStaffMap.delete('SYS_TEMPLATE'); // 排除系統模板關聯帳號
    
    let deptStaff = Array.from(deptStaffMap.values());
    deptStaff.sort((a, b) => {
        let idxA = customStaffOrder.indexOf(a['員工編號']); let idxB = customStaffOrder.indexOf(b['員工編號']);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
    return { deptStaff, deptStaffMap };
}

function buildEmpSelectOptions(deptStaffMap, selectedEmpId = '') {
    let options = `<optgroup label="本單位 / 本月相關人員">`;
    Array.from(deptStaffMap.values()).forEach(emp => {
        const selected = emp['員工編號'] === selectedEmpId ? 'selected' : '';
        options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']}</option>`;
    });
    options += `</optgroup><optgroup label="全院其他人員 (跨單位支援)">`;
    appData.staff.forEach(emp => {
        if (!deptStaffMap.has(emp['員工編號']) && emp['員工編號'] !== 'SYS_REMARK' && emp['員工編號'] !== 'SYS_TEMPLATE' && emp['所屬單位'] !== '離職') {
            const selected = emp['員工編號'] === selectedEmpId ? 'selected' : '';
            options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']} (${emp['所屬組別']||'無'})</option>`;
        }
    });
    options += `</optgroup>`;
    return options;
}

// ⚠️ 防呆攔截器：檢查修改的日期是否綁定模板
function guardTemplate(dateStr, callback) {
    // 尋找當天是否有綁定模板的系統紀錄 (未脫鉤)
    const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
    
    if (sysTemp) {
        if(confirm(`⚠️ 注意：本日已套用模板【${sysTemp['備註']}】。\n\n您現在的修改將會使本日與該模板【脫鉤】(僅變更本日班表)。\n如有需要異動一個月的工作，請退回並直接修改模板。\n\n確定要脫鉤並修改本日嗎？`)) {
            // 標記為脫鉤 (DECOUPLED)
            markDraft({
                shiftId: sysTemp['排班ID'], date: dateStr, dept: currentDept, empId: 'SYS_TEMPLATE',
                task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: ''
            });
            callback();
        }
    } else {
        callback(); // 沒綁模板，直接放行
    }
}

function renderInteractiveGrid() {
    const container = document.getElementById('interactiveGrid');
    container.innerHTML = '';
    const date = document.getElementById('interactiveDate').value;
    const currentMonthStr = date.substring(0, 7);
    
    // 更新「儲存為新模板」的日期顯示
    if(document.getElementById('saveTempDateDisplay')) document.getElementById('saveTempDateDisplay').innerText = date;

    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === date);
    
    const dailyRemarkShift = shifts.find(s => s['員工編號'] === 'SYS_REMARK') || {};
    const topRemark = dailyRemarkShift['備註'] || '';
    const bottomRemark = dailyRemarkShift['備註2'] || '';
    const dailyRemarkId = dailyRemarkShift['排班ID'] || ('SYS_' + date.replace(/-/g,''));

    // 檢查模板掛載狀態
    const activeTemplate = shifts.find(s => s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
    let templateBadge = activeTemplate ? `<span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-200">🏷️ 已套用模板：${activeTemplate['備註']}</span>` : '';

    const { deptStaff, deptStaffMap } = getMixedDeptStaff(currentMonthStr);

    let topRemarkHtml = `<div class="bg-yellow-50 border-b border-yellow-200 p-2 flex items-center gap-4">
        <span class="text-yellow-700 font-bold text-sm shrink-0">📢 頂部備註：</span>
        <input type="text" class="flex-1 bg-transparent border-b border-yellow-300 focus:border-yellow-600 outline-none text-sm text-yellow-800" value="${topRemark}" placeholder="輸入顯示於班表最上方的備註..." onblur="guardTemplate('${date}', () => saveDailyRemark('${dailyRemarkId}', this.value, null))">
        ${templateBadge}
    </div>`;
    container.innerHTML += topRemarkHtml;

    let headerHtml = `<div class="flex border-b bg-slate-200 text-[11px] font-bold text-slate-600 sticky top-0 z-20">
        <div class="w-24 p-2 border-r text-center shrink-0 flex items-center justify-center bg-slate-200">人員名單</div>
        <div class="w-32 p-2 border-r text-center shrink-0 flex items-center justify-center text-blue-700 bg-blue-50">個人備註</div>
        <div class="flex-1 flex min-w-[500px]">`;
    for(let i=8; i<=21; i++) headerHtml += `<div class="flex-1 border-l border-slate-300 pl-1 py-1 text-slate-700">${i}:00</div><div class="flex-1 border-l border-dashed border-slate-300 pl-1 py-1 text-[9px] text-slate-400">30</div>`;
    headerHtml += `<div class="w-8 border-l border-slate-300 pl-1 py-1 text-slate-700">22</div></div>
        <div class="w-40 p-2 border-l text-center shrink-0 flex items-center justify-center text-teal-700 bg-teal-50">工作補充</div>
    </div>`;
    container.innerHTML += headerHtml;

    deptStaff.forEach(emp => {
        const myShifts = shifts.filter(s => s['員工編號'] == emp['員工編號']);
        let mainShift = myShifts.length > 0 ? myShifts[0] : null;
        let shiftId = mainShift ? mainShift['排班ID'] : '';
        let r1 = mainShift ? (mainShift['備註'] || '') : '';
        let r2 = mainShift ? (mainShift['備註2'] || '') : '';
        
        let empStatusTag = '';
        if (emp['所屬單位'] === '離職') empStatusTag = `<span class="text-[9px] text-red-500 bg-red-50 rounded px-1 border border-red-200">離職</span>`;
        else if (emp['所屬組別'] !== currentDept) empStatusTag = `<span class="text-[9px] text-orange-500 bg-orange-50 rounded px-1 border border-orange-200" title="跨單位支援">外援</span>`;

        let rowHtml = `<div class="flex timeline-container group hover:bg-slate-50 transition border-b h-[50px]">
            <div class="w-24 p-1 border-r bg-white flex flex-col items-center justify-center shadow-sm z-10 relative cursor-ns-resize shrink-0"
                 draggable="true" ondragstart="dragRow(event, '${emp['員工編號']}')" ondragover="allowDrop(event)" ondrop="dropRow(event, '${emp['員工編號']}')">
                <div class="font-bold text-blue-700 cursor-pointer hover:bg-blue-50 py-1 rounded text-sm truncate w-full text-center flex flex-col items-center gap-0.5" onclick="openRowActionModal('${emp['員工編號']}')">
                    <span>${emp['姓名']} <span class="text-slate-400 text-xs">⚙️</span></span> ${empStatusTag}
                </div>
                ${clipboardShift ? `<button onclick="pasteShift('${emp['員工編號']}')" class="text-[9px] bg-indigo-100 text-indigo-700 px-2 mt-1 rounded shadow hover:bg-indigo-200">📋貼上</button>` : ''}
            </div>
            
            <div class="w-32 border-r bg-blue-50/50 flex items-center p-1 shrink-0">
                <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-blue-400 focus:ring-1 rounded bg-white text-blue-800 font-bold"
                       placeholder="${mainShift ? '輸入備註...' : ''}" value="${r1}" ${mainShift ? `onblur="guardTemplate('${date}', () => updateShiftRemarks('${shiftId}', this.value, null))"` : 'disabled'}>
            </div>
            
            <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="guardTemplate('${date}', () => dropShift(event, '${emp['員工編號']}'))">
                <div class="absolute inset-0 flex pointer-events-none opacity-20">`;
        
        for(let i=8; i<=21; i++) rowHtml += `<div class="flex-1 border-l border-slate-400"></div><div class="flex-1 border-l border-dashed border-slate-400"></div>`;
        rowHtml += `</div>`;

        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100;
            const width = ((eh - sh) + (em - sm)/60) / 14 * 100;

            rowHtml += `<div class="absolute top-[4px] bottom-[4px] bg-blue-100 border border-blue-400 rounded shadow-sm flex flex-col justify-center items-center cursor-grab active:cursor-grabbing hover:bg-blue-200 transition overflow-hidden z-10"
                             draggable="true" ondragstart="dragShift(event, '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <div class="font-bold text-blue-900 text-xs truncate w-full text-center px-1 flex justify-center items-center gap-1">
                    <span class="cursor-pointer hover:text-blue-600" onclick="openShiftModal('${shift['排班ID']}')">${shift['工作名稱']}</span>
                    <button onclick="copyShift('${shift['排班ID']}')" class="text-slate-400 hover:text-indigo-700 text-[10px]">📋</button>
                </div>
                <div class="text-[9px] text-slate-600 font-semibold mt-[2px]">${shift['開始時間']} - ${shift['結束時間']}</div>
            </div>`;
        });
        rowHtml += `</div><div class="w-40 border-l bg-teal-50/50 flex items-center p-1 shrink-0">
            <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-teal-400 focus:ring-1 rounded bg-white text-teal-800"
                   placeholder="${mainShift ? '補充說明...' : ''}" value="${r2}" ${mainShift ? `onblur="guardTemplate('${date}', () => updateShiftRemarks('${shiftId}', null, this.value))"` : 'disabled'}>
        </div></div>`; 
        container.innerHTML += rowHtml;
    });

    let bottomRemarkHtml = `<div class="bg-yellow-50 border-t border-yellow-200 p-2 flex items-center gap-2 mt-2">
        <span class="text-yellow-700 font-bold text-sm shrink-0">📢 底部備註：</span>
        <input type="text" class="flex-1 bg-transparent border-b border-yellow-300 focus:border-yellow-600 outline-none text-sm text-yellow-800" value="${bottomRemark}" placeholder="輸入顯示於班表最下方的備註..." onblur="guardTemplate('${date}', () => saveDailyRemark('${dailyRemarkId}', null, this.value))">
    </div>`;
    container.innerHTML += bottomRemarkHtml;
}

// ==========================================
// 🏷️ 版本模板中心邏輯
// ==========================================

function toggleTempMode() {
    const mode = document.querySelector('input[name="tempMode"]:checked').value;
    document.getElementById('tempModeApply').classList.add('hidden');
    document.getElementById('tempModeSave').classList.add('hidden');
    if (mode === 'apply') document.getElementById('tempModeApply').classList.remove('hidden');
    if (mode === 'save') document.getElementById('tempModeSave').classList.remove('hidden');
}

function toggleTargetInput() {
    const tType = document.getElementById('applyTargetType').value;
    document.getElementById('targetMultiDayInput').classList.add('hidden');
    document.getElementById('targetMonthInput').classList.add('hidden');
    document.getElementById('tempTargetDaysContainer').classList.add('hidden');
    
    if (tType === 'multi-day') {
        document.getElementById('targetMultiDayInput').classList.remove('hidden');
        document.getElementById('tempTargetDaysContainer').classList.remove('hidden');
    } else {
        document.getElementById('targetMonthInput').classList.remove('hidden');
    }
}

function renderTemplateSelect() {
    const sel = document.getElementById('applyTempSelect');
    if (!sel) return;
    const temps = (appData.templates || []).filter(t => t['部門'] === currentDept && t['類型'] === '平日');
    sel.innerHTML = temps.length ? temps.map(t => `<option value="${t['模板ID']}">${t['模板名稱']}</option>`).join('') : '<option value="">(尚無模板)</option>';
}

function addTempTargetDay() {
    const dateInput = document.getElementById('targetDateVal').value;
    if (!dateInput) return alert('請先選擇日期'); if (tempTargetDaysList.includes(dateInput)) return alert('日期已在清單中');
    tempTargetDaysList.push(dateInput); tempTargetDaysList.sort(); renderTempTargetDays();
}

function removeTempTargetDay(dateStr) { tempTargetDaysList = tempTargetDaysList.filter(d => d !== dateStr); renderTempTargetDays(); }
function renderTempTargetDays() {
    const container = document.getElementById('tempTargetDaysContainer');
    if (tempTargetDaysList.length === 0) return container.innerHTML = '<span class="text-xs text-slate-400">尚未加入目標日期...</span>';
    container.innerHTML = tempTargetDaysList.map(date => `<span class="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded flex items-center gap-1 border border-indigo-200 shadow-sm font-mono">${date} <button onclick="removeTempTargetDay('${date}')" class="text-red-500 hover:text-red-700 font-bold text-sm leading-none">×</button></span>`).join('');
}

async function saveCurrentAsTemplate() {
    const name = document.getElementById('newTempName').value.trim();
    const dateStr = document.getElementById('interactiveDate').value;
    if (!name) return alert('請輸入模板名稱！');
    
    // 只取人員實體班表，排除 SYS_REMARK 與 SYS_TEMPLATE
    const currentShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && !s['員工編號'].startsWith('SYS_'));
    if (currentShifts.length === 0) return alert('本日無任何排班，無法存為模板。');
    
    document.body.style.cursor = 'wait';
    await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'save_template',
            templateId: 'T' + new Date().getTime(), templateName: name, dept: currentDept, type: '平日',
            snapshot: JSON.stringify(currentShifts)
        })
    });
    showToast('💾 模板儲存成功！');
    document.getElementById('newTempName').value = '';
    await reloadData();
    renderTemplateSelect();
    document.querySelector('input[value="apply"]').click(); toggleTempMode();
    document.body.style.cursor = 'default';
}

function executeApplyTemplate() {
    const tempId = document.getElementById('applyTempSelect').value;
    if (!tempId) return alert('請先選擇模板');
    const template = appData.templates.find(t => t['模板ID'] === tempId);
    let sourceShifts = [];
    try { sourceShifts = JSON.parse(template['排班快照']); } catch(e) {}
    
    const tType = document.getElementById('applyTargetType').value;
    let targetDates = [];
    
    if (tType === 'multi-day') {
        if (tempTargetDaysList.length === 0) return alert('請加入目標日期');
        targetDates = [...tempTargetDaysList];
    } else {
        const monthVal = document.getElementById('targetMonthVal').value;
        if (!monthVal) return alert('請選擇目標月份');
        const [y, m] = monthVal.split('-');
        const daysInMonth = new Date(y, m, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            let dt = new Date(y, parseInt(m)-1, d);
            if (dt.getDay() !== 0 && dt.getDay() !== 6) {
                targetDates.push(`${y}-${m}-${String(d).padStart(2,'0')}`);
            }
        }
    }
    
    if (!confirm(`確定要將模板【${template['模板名稱']}】套用至 ${targetDates.length} 天嗎？\n(現有班表將被覆蓋並轉為草稿)`)) return;
    
    targetDates.forEach(tDate => {
        // 先標記刪除該日現有的實體班表 (標記為已刪除草稿邏輯)
        const oldShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === tDate && !s['員工編號'].startsWith('SYS_'));
        oldShifts.forEach(oldS => {
             appData.shifts = appData.shifts.filter(s => s['排班ID'] !== oldS['排班ID']); 
             // 實際環境需透過清空 API，為求速度前端直接蓋掉
        });
        
        // 寫入模板班表草稿
        sourceShifts.forEach(shift => {
            markDraft({
                shiftId: 'C' + new Date().getTime() + Math.random().toString(36).substr(2, 5),
                date: tDate, dept: currentDept, empId: shift['員工編號'], task: shift['工作名稱'], 
                start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2']
            });
        });
        
        // ★ 核心：掛上模板綁定識別 (SYS_TEMPLATE)
        const oldSys = appData.shifts.find(s => s['部門名稱'] === currentDept && s['日期'] === tDate && s['員工編號'] === 'SYS_TEMPLATE');
        markDraft({
            shiftId: oldSys ? oldSys['排班ID'] : 'T_LNK' + tDate.replace(/-/g,''),
            date: tDate, dept: currentDept, empId: 'SYS_TEMPLATE', task: tempId, start: '00:00', end: '00:00', category: 'SYS', remark1: template['模板名稱'], remark2: ''
        });
    });
    
    showToast(`✅ 成功套用模板至 ${targetDates.length} 天！請記得儲存發佈。`);
    document.getElementById('interactiveDate').value = targetDates[0];
    if (tType === 'multi-day') { tempTargetDaysList = []; renderTempTargetDays(); }
    renderInteractiveGrid();
}

// ... 下方保留您原有的操作輔助邏輯 (saveDailyRemark, updateShiftRemarks, copyShift, pasteShift, dropRow, dropShift, ShiftModal 等) ...

function saveDailyRemark(shiftId, topVal, bottomVal) { const existing = appData.shifts.find(s => s['排班ID'] === shiftId) || {}; markDraft({ shiftId, date: document.getElementById('interactiveDate').value, dept: currentDept, empId: 'SYS_REMARK', task: 'SYS_REMARK', start: '00:00', end: '00:00', category: 'SYS', remark1: topVal !== null ? topVal : (existing['備註'] || ''), remark2: bottomVal !== null ? bottomVal : (existing['備註2'] || '') }); }
function updateShiftRemarks(shiftId, r1, r2) { const shift = appData.shifts.find(s => s['排班ID'] === shiftId); if(shift) { markDraft({ shiftId, date: shift['日期'], dept: shift['部門名稱'], empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: r1 !== null ? r1 : shift['備註'], remark2: r2 !== null ? r2 : shift['備註2'] }); } }
function copyShift(shiftId) { clipboardShift = appData.shifts.find(s => s['排班ID'] === shiftId); showToast("✅ 已複製"); renderInteractiveGrid(); }
function pasteShift(empId) { if (!clipboardShift) return; openShiftModal(); document.getElementById('modalEmp').value = empId; document.getElementById('modalTask').value = clipboardShift['工作名稱']; document.getElementById('modalStart').value = clipboardShift['開始時間']; document.getElementById('modalEnd').value = clipboardShift['結束時間']; document.getElementById('modalCat').value = clipboardShift['工作類別']; document.getElementById('modalRemark1').value = clipboardShift['備註'] || ''; document.getElementById('modalRemark2').value = clipboardShift['備註2'] || ''; document.getElementById('modalTitle').innerText = '📋 貼上工作'; }
function allowDrop(ev) { ev.preventDefault(); }
function dragRow(ev, empId) { ev.dataTransfer.setData("rowEmpId", empId); }
function dropRow(ev, targetEmpId) { ev.preventDefault(); ev.stopPropagation(); const sourceEmpId = ev.dataTransfer.getData("rowEmpId"); if (sourceEmpId && sourceEmpId !== targetEmpId) { if (!customStaffOrder.includes(sourceEmpId)) customStaffOrder.push(sourceEmpId); if (!customStaffOrder.includes(targetEmpId)) customStaffOrder.push(targetEmpId); const sourceIdx = customStaffOrder.indexOf(sourceEmpId); const targetIdx = customStaffOrder.indexOf(targetEmpId); if (sourceIdx !== -1 && targetIdx !== -1) { customStaffOrder.splice(sourceIdx, 1); customStaffOrder.splice(targetIdx, 0, sourceEmpId); renderInteractiveGrid(); } } }
function dragShift(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
function dropShift(ev, newEmpId) { ev.preventDefault(); const shiftId = ev.dataTransfer.getData("shiftId"); if(!shiftId) return; const shift = appData.shifts.find(s => s['排班ID'] === shiftId); if(shift && shift['員工編號'] !== newEmpId) { markDraft({ shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: newEmpId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] }); renderInteractiveGrid(); } }

function openShiftModal(shiftId = null) {
    const modal = document.getElementById('shiftModal');
    const { deptStaffMap } = getMixedDeptStaff(document.getElementById('interactiveDate').value.substring(0,7));
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']);
    let selectedEmpId = shiftId ? (appData.shifts.find(s => s['排班ID'] === shiftId)?.['員工編號'] || '') : '';
    document.getElementById('modalEmp').innerHTML = buildEmpSelectOptions(deptStaffMap, selectedEmpId);
    document.getElementById('modalTask').innerHTML = deptTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    if(shiftId) {
        const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerText = '編輯工作'; document.getElementById('modalShiftId').value = shiftId; document.getElementById('modalTask').value = shift['工作名稱']; document.getElementById('modalStart').value = shift['開始時間']; document.getElementById('modalEnd').value = shift['結束時間']; document.getElementById('modalCat').value = shift['工作類別']; document.getElementById('modalRemark1').value = shift['備註'] || ''; document.getElementById('modalRemark2').value = shift['備註2'] || ''; document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = '新增工作'; document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); document.getElementById('modalStart').value = '08:00'; document.getElementById('modalEnd').value = '12:00'; document.getElementById('modalRemark1').value = ''; document.getElementById('modalRemark2').value = ''; document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}
function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }
function saveShift() { guardTemplate(document.getElementById('interactiveDate').value, () => { markDraft({ shiftId: document.getElementById('modalShiftId').value, date: document.getElementById('interactiveDate').value, dept: currentDept, empId: document.getElementById('modalEmp').value, task: document.getElementById('modalTask').value, start: document.getElementById('modalStart').value, end: document.getElementById('modalEnd').value, category: document.getElementById('modalCat').value, remark1: document.getElementById('modalRemark1').value, remark2: document.getElementById('modalRemark2').value }); closeShiftModal(); renderInteractiveGrid(); }); }
async function deleteShift() { guardTemplate(document.getElementById('interactiveDate').value, async () => { if(confirm("確定刪除此工作？(立即生效)")) { await postAction({ action: 'delete_shift', shiftId: document.getElementById('modalShiftId').value }); closeShiftModal(); } }); }

// ⚙️ 整合操作面板
function openRowActionModal(empId) {
    const emp = appData.staff.find(e => e['員工編號'] === empId); if(!emp) return;
    document.getElementById('raEmpId').value = empId; document.getElementById('raEmpName').innerText = emp['姓名'];
    const { deptStaffMap } = getMixedDeptStaff(document.getElementById('interactiveDate').value.substring(0, 7));
    document.getElementById('raReplaceEmp').innerHTML = '<option value="">--請選擇接收人員--</option>' + buildEmpSelectOptions(deptStaffMap, '');
    document.getElementById('rowActionModal').classList.remove('hidden');
}
function openQuickEmpFromAction() { document.getElementById('rowActionModal').classList.add('hidden'); openQuickEmpEdit(document.getElementById('raEmpId').value); }
function replaceEmp(scope) {
    guardTemplate(document.getElementById('interactiveDate').value, () => {
        const oldEmpId = document.getElementById('raEmpId').value; const newEmpId = document.getElementById('raReplaceEmp').value;
        const dateStr = document.getElementById('interactiveDate').value; const monthStr = dateStr.substring(0, 7);
        if (!newEmpId || oldEmpId === newEmpId) return alert('請選擇不同的接收人員！');
        let shiftsToReplace = scope === 'day' ? appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && s['員工編號'] === oldEmpId) : appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr) && s['員工編號'] === oldEmpId);
        if (shiftsToReplace.length === 0) return alert(`此人員無工作可移交。`);
        if (confirm(`確定要移交 ${shiftsToReplace.length} 筆工作嗎？`)) {
            shiftsToReplace.forEach(shift => { markDraft({ shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: newEmpId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] }); });
            document.getElementById('rowActionModal').classList.add('hidden'); showToast(`✅ 已移交`); renderInteractiveGrid();
        }
    });
}
async function clearEmpShifts(scope) {
    guardTemplate(document.getElementById('interactiveDate').value, async () => {
        const empId = document.getElementById('raEmpId').value; const dateStr = document.getElementById('interactiveDate').value; const monthStr = dateStr.substring(0, 7);
        let shiftsToDelete = scope === 'day' ? appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === dateStr && s['員工編號'] === empId) : appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr) && s['員工編號'] === empId);
        if (shiftsToDelete.length === 0) return alert(`此人員無工作。`);
        if (confirm(`⚠️ 確定要刪除 ${shiftsToDelete.length} 筆工作嗎？`)) {
            document.body.style.cursor = 'wait'; document.getElementById('rowActionModal').classList.add('hidden');
            const promises = shiftsToDelete.map(shift => fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_shift', shiftId: shift['排班ID'] }) }).then(r => r.json()));
            try { await Promise.all(promises); const idsToDelete = new Set(shiftsToDelete.map(s => s['排班ID'])); appData.shifts = appData.shifts.filter(s => !idsToDelete.has(s['排班ID'])); showToast(`🗑️ 已刪除`); } catch(e) { } finally { document.body.style.cursor = 'default'; renderInteractiveGrid(); }
        }
    });
}
function openQuickEmpEdit(empId) {
    const emp = appData.staff.find(e => e['員工編號'] === empId); if(!emp) return;
    document.getElementById('qEmpId').value = empId; document.getElementById('qEmpName').innerText = emp['姓名']; document.getElementById('qDept').value = emp['所屬單位'] || '藥學部'; document.getElementById('qAuth').value = emp['權限'] || ''; document.getElementById('qStartDisplay').innerText = emp['啟用時間'] || '無紀錄'; document.getElementById('qStart').value = emp['啟用時間'] || '';
    let endStr = emp['停用時間'] || ''; if(endStr && !endStr.includes('T')) endStr = endStr.replace(' ', 'T'); document.getElementById('qEnd').value = endStr;
    document.getElementById('qCategory').value = emp['所屬類別'] || ''; document.getElementById('qGroup').value = emp['所屬組別'] || ''; document.getElementById('quickEmpModal').classList.remove('hidden');
}
function handleDeptChange(val) {
    if(val === '離職') { const now = new Date(); document.getElementById('qEnd').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`; }
}
async function saveQuickEmpEdit() {
    let endVal = document.getElementById('qEnd').value; if(endVal) endVal = endVal.replace('T', ' '); 
    const updateData = { '所屬單位': document.getElementById('qDept').value, '權限': document.getElementById('qAuth').value, '停用時間': endVal, '所屬類別': document.getElementById('qCategory').value, '所屬組別': document.getElementById('qGroup').value };
    document.getElementById('quickEmpModal').classList.add('hidden');
    await postAction({ action: 'update_employee', empId: document.getElementById('qEmpId').value, updateData });
    if (!document.getElementById('employeeAdminView').classList.contains('hidden') && typeof renderEmployeeList === 'function') renderEmployeeList();
}

// ==========================================
// 🔍 模板預覽邏輯 (平日/假日共用)
// ==========================================
function previewSelectedTemplate(type) {
    const selectId = type === 'weekday' ? 'applyTempSelect' : 'hApplyTempSelect';
    const tempId = document.getElementById(selectId).value;
    
    if (!tempId) return alert('請先選擇一個模板');

    const template = appData.templates.find(t => t['模板ID'] === tempId);
    if (!template) return;

    document.getElementById('tpModalTitle').innerText = template['模板名稱'];
    let shifts = [];
    try { shifts = JSON.parse(template['排班快照']); } catch(e) {}

    let html = '';
    if (shifts.length === 0) {
        html = '<div class="text-slate-500 text-center italic mt-4 font-bold">此模板無任何排班內容。</div>';
    } else {
        // 將快照內的班表按「人員」進行群組化，方便閱讀
        const empMap = new Map();
        shifts.forEach(s => {
            if (s['員工編號'].startsWith('SYS_')) return; // 略過系統備註與綁定標籤
            if (!empMap.has(s['員工編號'])) empMap.set(s['員工編號'], []);
            empMap.get(s['員工編號']).push(s);
        });

        if(empMap.size === 0) {
             html = '<div class="text-slate-500 text-center italic mt-4 font-bold">此模板僅包含系統備註，無人員班表。</div>';
        } else {
            const themeColor = type === 'weekday' ? 'blue' : 'pink';
            empMap.forEach((empShifts, empId) => {
                const empName = appData.staff.find(e => e['員工編號'] === empId)?.['姓名'] || (empId === '' ? '未指派 (待補人)' : empId);
                
                html += `<div class="bg-white border p-3 rounded shadow-sm">
                    <div class="font-bold text-${themeColor}-800 border-b border-${themeColor}-100 pb-1 mb-2">${empName}</div>`;
                
                empShifts.forEach(s => {
                    html += `<div class="text-sm text-slate-700 flex justify-between ml-2 mt-1">
                        <span class="font-bold">🔹 [${s['工作名稱']}]</span>
                        <span class="text-slate-500 text-xs">${s['開始時間']} - ${s['結束時間']}</span>
                    </div>`;
                    if(s['備註'] || s['備註2']) {
                        html += `<div class="text-xs text-slate-400 ml-6 mt-0.5">↳ ${s['備註']} ${s['備註2']}</div>`;
                    }
                });
                html += `</div>`;
            });
        }
    }

    document.getElementById('tpContent').innerHTML = html;
    document.getElementById('templatePreviewModal').classList.remove('hidden');
}

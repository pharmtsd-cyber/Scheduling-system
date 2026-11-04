let currentHolidayDept = null;
let hTempTargetDaysList = [];

function openHolidayAdmin() {
    hideAllViews();
    document.getElementById('holidayAdminView').classList.remove('hidden');

    const deptSelect = document.getElementById('holidayDeptSelect');
    deptSelect.innerHTML = '<option value="">--請選擇部門--</option>';
    allowedDepts.forEach(d => deptSelect.innerHTML += `<option value="${d}">${d}</option>`);

    const now = new Date();
    document.getElementById('holidayMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('holidayCatFilter').value = 'ALL'; 

    renderHolidayTemplateSelect();
    renderHolidayGrid();
}

// ⚠️ 假日版防呆攔截器
function guardHolidayTemplate(dateStr, callback) {
    const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentHolidayDept && s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
    if (sysTemp) {
        if(confirm(`⚠️ 注意：本日已套用模板【${sysTemp['備註']}】。\n\n您現在的修改將會使本日與該模板【脫鉤】(僅變更本日班表)。\n如有需要異動全月工作，請退回並直接修改模板。\n\n確定要脫鉤並修改嗎？`)) {
            markDraft({ shiftId: sysTemp['排班ID'], date: dateStr, dept: currentHolidayDept, empId: 'SYS_TEMPLATE', task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: '' });
            callback();
        }
    } else { callback(); }
}

// 明確的假日脫鉤按鈕功能
function manualHolidayDecouple(dateStr) {
    if(confirm('確定要解除此日的模板綁定嗎？\n解除後即可自由修改此日排班，且系統不會再跳出警告。')) {
        const sysTemp = appData.shifts.find(s => s['部門名稱'] === currentHolidayDept && s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE');
        if(sysTemp) {
            markDraft({
                shiftId: sysTemp['排班ID'], date: dateStr, dept: currentHolidayDept, empId: 'SYS_TEMPLATE',
                task: 'SYS_DECOUPLED', start: '00:00', end: '00:00', category: 'SYS', remark1: sysTemp['備註'], remark2: ''
            });
            showToast('✂️ 已解除假日模板綁定，可自由編輯');
            renderHolidayGrid();
        }
    }
}

function renderHolidayGrid() {
    currentHolidayDept = document.getElementById('holidayDeptSelect').value;
    const monthStr = document.getElementById('holidayMonth').value;
    const catFilter = document.getElementById('holidayCatFilter').value;
    const table = document.getElementById('holidayTable');
    table.innerHTML = '';

    if(!currentHolidayDept || !monthStr) { table.innerHTML = '<tr><td class="p-10 text-slate-400 font-bold">👆 請先於上方選擇「部門」與「月份」</td></tr>'; return; }

    const { deptStaffMap } = typeof getMixedDeptStaff === 'function' ? getMixedDeptStaff(monthStr) : { deptStaffMap: new Map() };

    let monthShifts = appData.shifts.filter(s => s['部門名稱'] === currentHolidayDept && s['日期'].startsWith(monthStr));
    
    const [yyyy, mm] = monthStr.split('-');
    const daysInMonth = new Date(yyyy, mm, 0).getDate();

    let tbody = `<tbody class="bg-white">`;
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${yyyy}-${mm}-${String(d).padStart(2,'0')}`;
        const dateObj = new Date(dateStr);
        const dayOfWeek = ['日','一','二','三','四','五','六'][dateObj.getDay()];
        const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
        const rowClass = isWeekend ? 'bg-pink-50' : '';
        const dateColor = isWeekend ? 'text-red-500 font-bold' : 'text-slate-700 font-bold';

        let dailyShifts = monthShifts.filter(s => s['日期'] === dateStr && !s['員工編號'].startsWith('SYS_'));
        if (catFilter !== 'ALL') dailyShifts = dailyShifts.filter(s => s['工作類別'] === catFilter);

        // ★ 處理格子內的模板狀態與脫鉤按鈕
        const activeTemplate = monthShifts.find(s => s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] !== 'SYS_DECOUPLED');
        const decoupled = monthShifts.find(s => s['日期'] === dateStr && s['員工編號'] === 'SYS_TEMPLATE' && s['工作名稱'] === 'SYS_DECOUPLED');
        
        let templateHtml = '';
        if (activeTemplate) {
            templateHtml = `<div class="mt-2 text-[10px] bg-pink-100 text-pink-700 px-1 py-1 rounded border border-pink-200 font-bold leading-tight shadow-sm">🏷️ ${activeTemplate['備註']}</div>
                            <button onclick="manualHolidayDecouple('${dateStr}')" class="mt-1 w-full text-[9px] bg-red-100 text-red-600 hover:bg-red-200 px-1 py-1 rounded border border-red-200 font-bold shadow-sm transition">✂️ 解除綁定</button>`;
        } else if (decoupled) {
            templateHtml = `<div class="mt-2 text-[9px] text-orange-500 font-bold bg-orange-50 px-1 py-1 rounded border border-orange-200 leading-tight">⚠️ 已與模板脫鉤</div>`;
        }

        tbody += `<tr class="${rowClass} hover:bg-slate-50 transition border-b">`;
        tbody += `<td class="border-r p-2 ${dateColor} align-top w-32 shrink-0">
                    <div>${mm}/${String(d).padStart(2,'0')} (${dayOfWeek})</div>
                    ${templateHtml}
                    <div class="mt-2"><button onclick="guardHolidayTemplate('${dateStr}', () => openHolidayTaskModal('${dateStr}'))" class="w-full text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded shadow hover:bg-indigo-200 font-bold">+ 新增工作</button></div>
                  </td>`;
        
        tbody += `<td class="p-2 flex flex-wrap gap-2">`;
        if (dailyShifts.length === 0) {
            tbody += `<div class="text-slate-400 text-xs mt-2 italic">該日尚無指派工作 (或被篩選器隱藏)</div>`;
        } else {
            dailyShifts.forEach(shift => {
                const optionsHTML = typeof buildEmpSelectOptions === 'function' ? buildEmpSelectOptions(deptStaffMap, shift['員工編號']) : '';
                tbody += `<div class="bg-white border border-pink-200 rounded shadow-sm p-2 flex flex-col gap-1 w-40 shrink-0 relative hover:border-pink-300 transition">
                    <div class="text-xs font-bold text-pink-800 flex justify-between items-center border-b border-pink-100 pb-1 mb-1">
                        <span class="truncate" title="${shift['工作名稱']}">${shift['工作名稱']}</span>
                        <button onclick="guardHolidayTemplate('${dateStr}', () => deleteHolidayShift('${shift['排班ID']}'))" class="text-red-400 hover:text-red-600 font-bold" title="刪除此工作">✖</button>
                    </div>
                    <select class="w-full border p-1 rounded text-xs text-slate-700 focus:ring-1 focus:ring-pink-400 font-bold"
                            onchange="guardHolidayTemplate('${dateStr}', () => updateHolidayEmp('${shift['排班ID']}', this.value))">
                        <option value="">--待指派--</option>
                        ${optionsHTML}
                    </select>
                    <div class="text-[9px] text-slate-400 text-right mt-1">${shift['工作類別']}</div>
                </div>`;
            });
        }
        tbody += `</td></tr>`;
    }
    tbody += `</tbody>`;
    table.innerHTML = tbody;
}

// ==========================================
// 🏷️ 假日版模板中心邏輯
// ==========================================
function toggleHolidayTempMode() {
    const mode = document.querySelector('input[name="hTempMode"]:checked').value;
    document.getElementById('hTempModeApply').classList.add('hidden');
    document.getElementById('hTempModeSave').classList.add('hidden');
    if (mode === 'apply') document.getElementById('hTempModeApply').classList.remove('hidden');
    if (mode === 'save') document.getElementById('hTempModeSave').classList.remove('hidden');
}

function toggleHolidayTargetInput() {
    const tType = document.getElementById('hApplyTargetType').value;
    document.getElementById('hTargetMultiDayInput').classList.add('hidden');
    document.getElementById('hTargetMonthWeekdayInput').classList.add('hidden');
    document.getElementById('hTempTargetDaysContainer').classList.add('hidden');
    
    if (tType === 'multi-day') {
        document.getElementById('hTargetMultiDayInput').classList.remove('hidden');
        document.getElementById('hTempTargetDaysContainer').classList.remove('hidden');
    } else {
        document.getElementById('hTargetMonthWeekdayInput').classList.remove('hidden');
    }
}

function renderHolidayTemplateSelect() {
    const selApply = document.getElementById('hApplyTempSelect');
    const selUpdate = document.getElementById('hUpdateTempSelect');
    if (!selApply) return;
    
    const temps = (appData.templates || []).filter(t => t['部門'] === currentHolidayDept && t['類型'] === '假日');
    const optionsHtml = temps.length ? temps.map(t => `<option value="${t['模板ID']}">${t['模板名稱']}</option>`).join('') : '<option value="">(尚無假日模板)</option>';
    
    selApply.innerHTML = optionsHtml;
    
    if (selUpdate) {
        selUpdate.innerHTML = '<option value="">-- 建立全新模板 (另存) --</option>' + optionsHtml;
    }
}

async function saveHolidayAsTemplate() {
    const updateId = document.getElementById('hUpdateTempSelect').value;
    const newName = document.getElementById('hNewTempName').value.trim();
    const dateStr = document.getElementById('hSaveSourceDate').value;
    
    if (!dateStr) return alert('請選擇來源日期！');
    
    let targetId = updateId;
    let targetName = newName;
    
    if (updateId) {
        const tempInfo = appData.templates.find(t => t['模板ID'] === updateId);
        if (tempInfo) targetName = newName || tempInfo['模板名稱'];
    } else {
        if (!newName) return alert('請輸入新模板名稱！');
        targetId = 'TH' + new Date().getTime();
    }
    
    const currentShifts = appData.shifts.filter(s => s['部門名稱'] === currentHolidayDept && s['日期'] === dateStr && !s['員工編號'].startsWith('SYS_'));
    if (currentShifts.length === 0) return alert('該日無任何排班，無法存為模板。');
    
    document.body.style.cursor = 'wait';
    await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'save_template', 
            templateId: targetId, templateName: targetName, dept: currentHolidayDept, type: '假日', 
            snapshot: JSON.stringify(currentShifts) 
        })
    });
    showToast('💾 假日模板儲存/更新成功！');
    document.getElementById('hNewTempName').value = '';
    await reloadData(); renderHolidayTemplateSelect();
    document.querySelector('input[value="apply"][name="hTempMode"]').click(); toggleHolidayTempMode();
    document.body.style.cursor = 'default';
}

function addHolidayTempTargetDay() {
    const dateInput = document.getElementById('hTargetDateVal').value;
    if (!dateInput) return alert('請先選擇日期'); if (hTempTargetDaysList.includes(dateInput)) return alert('日期已在清單中');
    hTempTargetDaysList.push(dateInput); hTempTargetDaysList.sort(); renderHolidayTempTargetDays();
}
function removeHolidayTempTargetDay(dateStr) { hTempTargetDaysList = hTempTargetDaysList.filter(d => d !== dateStr); renderHolidayTempTargetDays(); }
function renderHolidayTempTargetDays() {
    const container = document.getElementById('hTempTargetDaysContainer');
    if (hTempTargetDaysList.length === 0) return container.innerHTML = '<span class="text-xs text-slate-400">尚未加入目標日期...</span>';
    container.innerHTML = hTempTargetDaysList.map(date => `<span class="bg-pink-100 text-pink-800 text-xs px-2 py-1 rounded flex items-center gap-1 border border-pink-200 shadow-sm font-mono">${date} <button onclick="removeHolidayTempTargetDay('${date}')" class="text-red-500 hover:text-red-700 font-bold text-sm leading-none">×</button></span>`).join('');
}


function executeApplyHolidayTemplate() {
    const tempId = document.getElementById('hApplyTempSelect').value;
    if (!tempId) return alert('請先選擇假日模板');
    const template = appData.templates.find(t => t['模板ID'] === tempId);
    let sourceShifts = [];
    try { sourceShifts = JSON.parse(template['排班快照']); } catch(e) {}
    
    const tType = document.getElementById('hApplyTargetType').value;
    let targetDates = [];
    
    if (tType === 'multi-day') {
        if (hTempTargetDaysList.length === 0) return alert('請加入目標日期');
        targetDates = [...hTempTargetDaysList];
    } else {
        const monthVal = document.getElementById('hTargetMonthVal').value;
        if (!monthVal) return alert('請選擇目標月份');
        
        const checkboxes = document.querySelectorAll('input[name="hTargetWeekdays"]:checked');
        if (checkboxes.length === 0) return alert('請至少勾選一個星期幾');
        const allowedWeekdays = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        const [y, m] = monthVal.split('-');
        const daysInMonth = new Date(y, m, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            let dt = new Date(y, parseInt(m)-1, d);
            if (allowedWeekdays.includes(dt.getDay())) {
                targetDates.push(`${y}-${m}-${String(d).padStart(2,'0')}`);
            }
        }
    }
    
    if (targetDates.length === 0) return alert('目標日期清空，無符合條件的日子。');
    if (!confirm(`確定要將假日模板【${template['模板名稱']}】套用至 ${targetDates.length} 天嗎？\n(現有班表將被覆蓋並轉為草稿)`)) return;
    
    targetDates.forEach(tDate => {
        const oldShifts = appData.shifts.filter(s => s['部門名稱'] === currentHolidayDept && s['日期'] === tDate && !s['員工編號'].startsWith('SYS_'));
        oldShifts.forEach(oldS => { appData.shifts = appData.shifts.filter(s => s['排班ID'] !== oldS['排班ID']); });
        
        sourceShifts.forEach(shift => {
            markDraft({ shiftId: 'C' + new Date().getTime() + Math.random().toString(36).substr(2, 5), date: tDate, dept: currentHolidayDept, empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] });
        });
        
        const oldSys = appData.shifts.find(s => s['部門名稱'] === currentHolidayDept && s['日期'] === tDate && s['員工編號'] === 'SYS_TEMPLATE');
        markDraft({ shiftId: oldSys ? oldSys['排班ID'] : 'T_LNK' + tDate.replace(/-/g,''), date: tDate, dept: currentHolidayDept, empId: 'SYS_TEMPLATE', task: tempId, start: '00:00', end: '00:00', category: 'SYS', remark1: template['模板名稱'], remark2: '' });
    });
    
    showToast(`✅ 成功套用假日模板至 ${targetDates.length} 天！請記得儲存發佈。`);
    if (tType === 'multi-day') { hTempTargetDaysList = []; renderHolidayTempTargetDays(); }
    renderHolidayGrid();
}

// === 任務編輯與修改 ===
function openHolidayTaskModal(dateStr) {
    document.getElementById('hTaskDate').value = dateStr;
    const currentFilter = document.getElementById('holidayCatFilter').value;
    document.getElementById('hTaskCat').value = currentFilter !== 'ALL' ? currentFilter : '假日班(常規)';
    filterHolidayTaskOptions();
    document.getElementById('holidayTaskModal').classList.remove('hidden');
}

function filterHolidayTaskOptions() {
    const selectedCat = document.getElementById('hTaskCat').value;
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentHolidayDept || !t['部門名稱']);
    let filteredTasks = selectedCat !== 'ALL' ? deptTasks.filter(t => t['預設類別'] === selectedCat) : deptTasks;
    const select = document.getElementById('hTaskSelect');
    select.innerHTML = filteredTasks.length ? filteredTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('') : '<option value="">(此類別無可用工作項目)</option>';
}

function saveHolidayTask() {
    const dateStr = document.getElementById('hTaskDate').value;
    const taskName = document.getElementById('hTaskSelect').value;
    let taskCat = document.getElementById('hTaskCat').value;
    if(!taskName) return alert('請選擇有效的工作項目');
    if (taskCat === 'ALL') { const taskInfo = appData.tasks.find(t => t['工作名稱'] === taskName); taskCat = taskInfo ? taskInfo['預設類別'] : '假日班(常規)'; }
    document.getElementById('holidayTaskModal').classList.add('hidden');
    markDraft({ shiftId: 'H' + new Date().getTime(), date: dateStr, dept: currentHolidayDept, empId: '', task: taskName, start: '08:00', end: '17:00', category: taskCat, remark1: '', remark2: '' });
    renderHolidayGrid();
}

function updateHolidayEmp(shiftId, empId) {
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) { markDraft({ shiftId, date: shift['日期'], dept: shift['部門名稱'], empId: empId, task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] }); renderHolidayGrid(); }
}

async function deleteHolidayShift(shiftId) {
    if(confirm("確定刪除此工作指派？(刪除將立即生效)")) { await postAction({ action: 'delete_shift', shiftId: shiftId }); renderHolidayGrid(); }
}

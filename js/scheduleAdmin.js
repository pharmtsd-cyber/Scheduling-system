function switchMode(mode) {
    scheduleMode = mode;
    document.getElementById('btnModePerson').className = mode === 'person' ? "px-4 py-1 rounded bg-white shadow text-blue-600" : "px-4 py-1 rounded text-slate-500 hover:text-slate-700 cursor-pointer";
    document.getElementById('btnModeTask').className = mode === 'task' ? "px-4 py-1 rounded bg-white shadow text-blue-600" : "px-4 py-1 rounded text-slate-500 hover:text-slate-700 cursor-pointer";
    renderInteractiveGrid();
}

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `[管理模式] ${deptName}`;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('interactiveDate').value = today;
    document.getElementById('previewMonth').value = today.substring(0, 7);
    
    renderInteractiveGrid();
}

function renderInteractiveGrid() {
    const container = document.getElementById('interactiveGrid');
    container.innerHTML = '';
    const date = document.getElementById('interactiveDate').value;
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === date);
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);

    let headerHtml = '<div class="flex border-b bg-slate-50 text-xs font-bold text-slate-500"><div class="w-32 p-2 border-r text-center">' + (scheduleMode === 'person' ? '人員' : '工作名稱') + '</div><div class="flex-1 flex">';
    for(let i=8; i<=22; i++) headerHtml += `<div class="flex-1 border-l pl-1 py-1">${i}:00</div>`;
    headerHtml += '</div></div>';
    container.innerHTML += headerHtml;

    if (scheduleMode === 'person') {
        deptStaff.forEach(emp => {
            const myShifts = shifts.filter(s => s['員工編號'] == emp['員工編號']);
            let rowHtml = `<div class="flex timeline-container group">
                <div class="w-32 p-2 border-r bg-white font-bold flex items-center justify-center shadow-sm z-10">${emp['姓名']}</div>
                <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="drop(event, '${emp['員工編號']}')">`;
            
            myShifts.forEach(shift => {
                const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
                const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
                const left = ((sh - 8) + sm/60) / 14 * 100;
                const width = ((eh - sh) + (em - sm)/60) / 14 * 100;
                
                rowHtml += `<div class="timeline-block" draggable="true" ondragstart="drag(event, '${shift['排班ID']}')" onclick="openShiftModal('${shift['排班ID']}')" style="left:${left}%; width:${width}%;" title="點擊編輯">
                    <div class="font-bold text-blue-900 border-b border-blue-200 pb-[1px] mb-[1px] truncate">${shift['工作名稱']}</div>
                    <div class="text-[10px] text-slate-600 truncate">${shift['開始時間']}-${shift['結束時間']}</div>
                    ${shift['備註'] ? `<div class="text-[9px] text-red-500 truncate">${shift['備註']}</div>` : ''}
                </div>`;
            });
            rowHtml += `</div></div>`;
            container.innerHTML += rowHtml;
        });
    } else {
        const usedTasks = [...new Set(shifts.map(s => s['工作名稱']))]; 
        if(usedTasks.length === 0) container.innerHTML += '<div class="p-8 text-center text-slate-400">當日尚無任何假日工作指派。請點擊上方「新增班表」建立。</div>';

        usedTasks.forEach(taskName => {
            const taskShifts = shifts.filter(s => s['工作名稱'] === taskName);
            let rowHtml = `<div class="flex timeline-container group">
                <div class="w-32 p-2 border-r bg-white font-bold text-sm flex items-center justify-center text-center leading-tight">${taskName}</div>
                <div class="flex-1 relative">`;
            
            taskShifts.forEach(shift => {
                const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
                const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
                const left = ((sh - 8) + sm/60) / 14 * 100;
                const width = ((eh - sh) + (em - sm)/60) / 14 * 100;

                let options = '<option value="">--待指派--</option>';
                deptStaff.forEach(e => options += `<option value="${e['員工編號']}" ${e['員工編號']==shift['員工編號']?'selected':''}>${e['姓名']}</option>`);

                rowHtml += `<div class="timeline-block" style="left:${left}%; width:${width}%;">
                    <select onchange="updateShiftInline('${shift['排班ID']}', this.value, null)">${options}</select>
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-[9px]">${shift['開始時間']}-${shift['結束時間']}</span>
                        <button onclick="openShiftModal('${shift['排班ID']}')" class="text-blue-500 hover:text-blue-700">✏️</button>
                    </div>
                </div>`;
            });
            rowHtml += `</div></div>`;
            container.innerHTML += rowHtml;
        });
    }
}

// Drag & Drop
function allowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('drag-over'); }
function drag(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
async function drop(ev, newEmpId) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const shiftId = ev.dataTransfer.getData("shiftId");
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift && shift['員工編號'] !== newEmpId) {
        shift['員工編號'] = newEmpId;
        renderInteractiveGrid(); 
        await postAction({ action: 'save_shift', ...shift, shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark: shift['備註'] });
    }
}

async function updateShiftInline(shiftId, empId, remark) {
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) {
        await postAction({ 
            action: 'save_shift', shiftId, date: shift['日期'], dept: shift['部門名稱'], 
            empId: empId !== null ? empId : shift['員工編號'], task: shift['工作名稱'], 
            start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], 
            remark: remark !== null ? remark : shift['備註'] 
        });
        renderInteractiveGrid();
    }
}

// Modal 處理
function openShiftModal(shiftId = null) {
    const modal = document.getElementById('shiftModal');
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']);
    
    document.getElementById('modalEmp').innerHTML = deptStaff.map(e => `<option value="${e['員工編號']}">${e['姓名']}</option>`).join('');
    document.getElementById('modalTask').innerHTML = deptTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    
    if(shiftId) {
        const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerText = '編輯班表';
        document.getElementById('modalShiftId').value = shiftId;
        document.getElementById('modalEmp').value = shift['員工編號'];
        document.getElementById('modalTask').value = shift['工作名稱'];
        document.getElementById('modalStart').value = shift['開始時間'];
        document.getElementById('modalEnd').value = shift['結束時間'];
        document.getElementById('modalCat').value = shift['工作類別'];
        document.getElementById('modalRemark').value = shift['備註'] || '';
        document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = '新增班表';
        document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); 
        document.getElementById('modalStart').value = '08:00';
        document.getElementById('modalEnd').value = '12:00';
        document.getElementById('modalRemark').value = '';
        document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }

async function saveShift() {
    const payload = {
        action: 'save_shift',
        shiftId: document.getElementById('modalShiftId').value,
        date: document.getElementById('interactiveDate').value,
        dept: currentDept,
        empId: document.getElementById('modalEmp').value,
        task: document.getElementById('modalTask').value,
        start: document.getElementById('modalStart').value,
        end: document.getElementById('modalEnd').value,
        category: document.getElementById('modalCat').value,
        remark: document.getElementById('modalRemark').value
    };
    closeShiftModal();
    await postAction(payload);
    renderInteractiveGrid();
}

async function deleteShift() {
    if(confirm("確定刪除此班表？")) {
        const shiftId = document.getElementById('modalShiftId').value;
        closeShiftModal();
        await postAction({ action: 'delete_shift', shiftId });
        renderInteractiveGrid();
    }
}

async function copyMonthSchedule() {
    const sourceMonth = document.getElementById('previewMonth').value;
    const targetMonth = document.getElementById('targetMonth').value;
    if(sourceMonth && targetMonth && confirm(`承襲 ${sourceMonth} 至 ${targetMonth}？`)) {
        await postAction({ action: 'copy_month_template', sourceMonth, targetMonth, deptName: currentDept });
    }
}

let currentAdminDept = null;

function openAdminDept(deptName) {
    currentAdminDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `管理員模式：${deptName}`;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('interactiveDate').value = today;
    document.getElementById('previewMonth').value = today.substring(0, 7);
    renderInteractiveGrid();
}

async function copyMonthSchedule() {
    const sourceMonth = document.getElementById('previewMonth').value;
    const targetMonth = document.getElementById('targetMonth').value;
    if(!sourceMonth || !targetMonth) return alert("請確認選擇月份！");
    if(confirm(`承襲 [${sourceMonth}] 至 [${targetMonth}]，確定嗎？`)) {
        const res = await postAction({ action: 'copy_month_template', sourceMonth, targetMonth, deptName: currentAdminDept });
        alert(`成功承襲 ${res.copied} 筆！`);
        location.reload();
    }
}

function renderInteractiveGrid() {
    const container = document.getElementById('interactiveGrid');
    container.innerHTML = '';
    const date = document.getElementById('interactiveDate').value;
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentAdminDept && s['日期'] === date);
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentAdminDept);
    
    let rulerHtml = '<div class="flex text-xs text-slate-400 font-bold mb-3 border-b pb-1">';
    for(let i=8; i<=22; i++) rulerHtml += `<div class="flex-1 border-l-2 border-slate-300 pl-1">${i}:00</div>`;
    rulerHtml += '</div>';
    container.innerHTML += rulerHtml;

    if(shifts.length === 0) return container.innerHTML += '<div class="text-center py-6 text-slate-400">尚無資料</div>';

    shifts.forEach(shift => {
        const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
        const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
        const startPercent = ((sh - 8) + sm/60) / 14 * 100;
        const widthPercent = ((eh - sh) + (em - sm)/60) / 14 * 100;

        let options = '<option value="">--待指派--</option>';
        deptStaff.forEach(emp => {
            const selected = emp['員工編號'] == shift['員工編號'] ? 'selected' : '';
            options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']}</option>`;
        });

        container.innerHTML += `
            <div class="timeline-container relative">
                <div class="timeline-block" style="left: ${startPercent}%; width: ${widthPercent}%;">
                    <div class="font-bold text-blue-900 border-b border-blue-200 pb-[2px] truncate">${shift['工作名稱']}</div>
                    <select onchange="updateShiftInline('${shift['排班ID']}', this.value, null)">${options}</select>
                    <input type="text" placeholder="備註" value="${shift['備註'] || ''}" onblur="updateShiftInline('${shift['排班ID']}', null, this.value)">
                </div>
            </div>`;
    });
}

async function updateShiftInline(shiftId, empId, remark) {
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) {
        if(empId !== null) shift['員工編號'] = empId;
        if(remark !== null) shift['備註'] = remark;
        await postAction({ action: 'update_shift_inline', shiftId, empId: shift['員工編號'], remark: shift['備註'] });
    }
}

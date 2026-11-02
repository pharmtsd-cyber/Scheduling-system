function openHolidayAdmin() {
    hideAllViews();
    document.getElementById('holidayAdminView').classList.remove('hidden');

    const deptSelect = document.getElementById('holidayDeptSelect');
    deptSelect.innerHTML = '<option value="">--請選擇部門--</option>';
    allowedDepts.forEach(d => deptSelect.innerHTML += `<option value="${d}">${d}</option>`);

    const now = new Date();
    document.getElementById('holidayMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    renderHolidayGrid();
}

function renderHolidayGrid() {
    const dept = document.getElementById('holidayDeptSelect').value;
    const monthStr = document.getElementById('holidayMonth').value;
    const table = document.getElementById('holidayTable');
    table.innerHTML = '';

    if(!dept || !monthStr) {
        table.innerHTML = '<tr><td class="p-10 text-slate-400 font-bold">👆 請先於上方選擇「部門」與「月份」</td></tr>';
        return;
    }

    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === dept || !t['部門名稱']);
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === dept);

    if(deptTasks.length === 0) {
        table.innerHTML = '<tr><td class="p-10 text-red-500 font-bold">該部門尚無任何「工作項目」，請先至清單維護新增。</td></tr>';
        return;
    }

    const [yyyy, mm] = monthStr.split('-');
    const daysInMonth = new Date(yyyy, mm, 0).getDate();

    // 建立表頭
    let thead = `<thead class="bg-pink-100 text-pink-900 border-b-2 border-pink-300"><tr><th class="border border-pink-200 p-2 w-28 shrink-0">日期</th>`;
    deptTasks.forEach(t => thead += `<th class="border border-pink-200 p-2 min-w-[120px]">${t['工作名稱']}</th>`);
    thead += `</tr></thead>`;

    // 建立每日選單
    let tbody = `<tbody>`;
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${yyyy}-${mm}-${String(d).padStart(2,'0')}`;
        const dateObj = new Date(dateStr);
        const dayOfWeek = ['日','一','二','三','四','五','六'][dateObj.getDay()];
        const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
        const rowClass = isWeekend ? 'bg-pink-50/40' : 'bg-white';
        const dateColor = isWeekend ? 'text-red-500 font-bold' : 'text-slate-700 font-bold';

        tbody += `<tr class="${rowClass} hover:bg-pink-100 transition border-b border-pink-100">`;
        tbody += `<td class="border border-pink-200 p-2 ${dateColor}">${mm}/${String(d).padStart(2,'0')} (${dayOfWeek})</td>`;

        deptTasks.forEach(t => {
            const existingShift = appData.shifts.find(s => s['部門名稱'] === dept && s['日期'] === dateStr && s['工作名稱'] === t['工作名稱']);
            const shiftId = existingShift ? existingShift['排班ID'] : 'H' + new Date().getTime() + Math.random().toString().substr(2,4);

            let options = '<option value="">--待指派--</option>';
            deptStaff.forEach(emp => {
                const selected = (existingShift && existingShift['員工編號'] === emp['員工編號']) ? 'selected' : '';
                options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']}</option>`;
            });

            // 當選項改變時，直接觸發儲存 (預設時間設為整天或常規)
            tbody += `<td class="border border-pink-200 p-1">
                <select class="w-full border p-1 rounded text-sm font-bold text-blue-800 focus:ring-2 focus:ring-pink-400 bg-white shadow-sm"
                        onchange="saveHolidayShift('${shiftId}', '${dateStr}', '${dept}', this.value, '${t['工作名稱']}')">
                    ${options}
                </select>
            </td>`;
        });
        tbody += `</tr>`;
    }
    tbody += `</tbody>`;

    table.innerHTML = thead + tbody;
}

async function saveHolidayShift(shiftId, date, dept, empId, task) {
    if(!empId) {
        await postAction({ action: 'delete_shift', shiftId: shiftId });
    } else {
        await postAction({
            action: 'save_shift', shiftId, date, dept, empId, task,
            start: '08:00', end: '17:00', category: '假日', remark1: '', remark2: ''
        });
    }
}

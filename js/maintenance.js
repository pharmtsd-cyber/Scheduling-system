function showEmployeeMaint() {
    hideAllViews(); 
    document.getElementById('employeeAdminView').classList.remove('hidden');
    if (document.getElementById('empSearchInput')) document.getElementById('empSearchInput').value = '';
    renderEmployeeList();
}

function renderEmployeeList() {
    const tbody = document.getElementById('empTableBody'); tbody.innerHTML = '';
    const deptFilter = document.getElementById('empDeptFilter') ? document.getElementById('empDeptFilter').value : 'ALL';
    const keywordInput = document.getElementById('empSearchInput');
    const keyword = keywordInput ? keywordInput.value.toLowerCase() : '';
    let staff = [...appData.staff];
    if (deptFilter !== 'ALL') staff = staff.filter(s => (s['所屬單位'] || '') === deptFilter);
    if (keyword) staff = staff.filter(s => s['員工編號'].toLowerCase().includes(keyword) || s['姓名'].toLowerCase().includes(keyword));
    staff.sort((a, b) => String(a['員工編號']).localeCompare(String(b['員工編號'])));
    if (document.getElementById('empListCount')) document.getElementById('empListCount').innerText = `共 ${staff.length} 人`;
    if(staff.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-bold">查無資料</td></tr>';

    staff.forEach(emp => {
        const isResigned = (emp['所屬單位'] === '離職');
        const rowClass = isResigned ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50 transition';
        const nameColor = isResigned ? 'text-slate-500 line-through' : 'text-slate-800';
        tbody.innerHTML += `<tr class="border-b ${rowClass}"><td class="p-3 text-slate-500 font-mono">${emp['員工編號']}</td><td class="p-3 font-bold ${nameColor}">${emp['姓名']}</td><td class="p-3 text-blue-700 font-bold">${emp['所屬組別'] || '<span class="text-slate-400 font-normal">未指派</span>'}</td><td class="p-3 text-center"><button onclick="openQuickEmpEdit('${emp['員工編號']}')" class="text-blue-600 font-bold hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded transition">編輯屬性</button></td></tr>`;
    });
}

function openQuickEmpEdit(empId) { 
    const emp = appData.staff.find(e => e['員工編號'] === empId); if(!emp) return; 
    document.getElementById('qEmpId').value = empId; document.getElementById('qEmpName').innerText = emp['姓名']; document.getElementById('qDept').value = emp['所屬單位'] || '藥學部'; document.getElementById('qAuth').value = emp['權限'] || ''; document.getElementById('qStartDisplay').innerText = emp['啟用時間'] || '無紀錄'; document.getElementById('qStart').value = emp['啟用時間'] || ''; let endStr = emp['停用時間'] || ''; if(endStr && !endStr.includes('T')) endStr = endStr.replace(' ', 'T'); document.getElementById('qEnd').value = endStr; document.getElementById('qCategory').value = emp['所屬類別'] || ''; document.getElementById('qGroup').value = emp['所屬組別'] || ''; document.getElementById('quickEmpModal').classList.remove('hidden'); 
}
function handleDeptChange(val) { if(val === '離職') { const now = new Date(); document.getElementById('qEnd').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`; } }
async function saveQuickEmpEdit() { let endVal = document.getElementById('qEnd').value; if(endVal) endVal = endVal.replace('T', ' '); const updateData = { '所屬單位': document.getElementById('qDept').value, '權限': document.getElementById('qAuth').value, '停用時間': endVal, '所屬類別': document.getElementById('qCategory').value, '所屬組別': document.getElementById('qGroup').value }; document.getElementById('quickEmpModal').classList.add('hidden'); await postAction({ action: 'update_employee', empId: document.getElementById('qEmpId').value, updateData }); if (typeof renderEmployeeList === 'function') renderEmployeeList(); }

// === 工作項目清單維護邏輯 ===
function showTaskMaint() {
    hideAllViews(); document.getElementById('taskAdminView').classList.remove('hidden');
    
    // 渲染部門選項
    const deptSelect = document.getElementById('taskDeptFilter');
    const newDeptSelect = document.getElementById('newTaskDept');
    let deptOptions = '<option value="ALL">全部部門 (依部門分群)</option>';
    let newDeptOptions = '';
    appData.depts.forEach(d => {
        const selected = (d['部門名稱'] === currentDept) ? 'selected' : '';
        deptOptions += `<option value="${d['部門名稱']}" ${selected}>${d['部門名稱']}</option>`;
        newDeptOptions += `<option value="${d['部門名稱']}" ${selected}>${d['部門名稱']}</option>`;
    });
    if(deptSelect) deptSelect.innerHTML = deptOptions;
    if(newDeptSelect) newDeptSelect.innerHTML = newDeptOptions;
    
    // 提取目前所有存在的類別建立下拉清單
    const uniqueCats = [...new Set(appData.tasks.map(t => t['預設類別']).filter(Boolean))];
    const catSelect = document.getElementById('taskCatFilter');
    const dataList = document.getElementById('dynamicCatList');
    if(catSelect) catSelect.innerHTML = '<option value="ALL">全部類別</option>' + uniqueCats.map(c => `<option value="${c}">${c}</option>`).join('');
    if(dataList) dataList.innerHTML = uniqueCats.map(c => `<option value="${c}">`).join('');
    
    if (document.getElementById('taskSearchInput')) document.getElementById('taskSearchInput').value = '';
    resetTaskForm(); renderTaskList();
}

function renderTaskList() {
    const tbody = document.getElementById('taskTableBody'); tbody.innerHTML = '';
    const deptFilter = document.getElementById('taskDeptFilter').value;
    const catFilter = document.getElementById('taskCatFilter').value;
    const keyword = document.getElementById('taskSearchInput').value.toLowerCase();
    
    let tasks = [...appData.tasks];
    if (deptFilter !== 'ALL') tasks = tasks.filter(t => t['部門名稱'] === deptFilter);
    if (catFilter !== 'ALL') tasks = tasks.filter(t => (t['預設類別'] || '') === catFilter);
    if (keyword) tasks = tasks.filter(t => t['工作名稱'].toLowerCase().includes(keyword) || (t['預設類別']||'').toLowerCase().includes(keyword));
    
    // ★ 排序：依據部門 -> 類別 -> 名稱排序
    tasks.sort((a, b) => {
        const deptCmp = (a['部門名稱'] || '').localeCompare(b['部門名稱'] || '');
        if (deptCmp !== 0) return deptCmp;
        const catCmp = (a['預設類別'] || '').localeCompare(b['預設類別'] || '');
        if (catCmp !== 0) return catCmp;
        return a['工作名稱'].localeCompare(b['工作名稱']);
    });
    
    if (document.getElementById('taskListCount')) document.getElementById('taskListCount').innerText = `共 ${tasks.length} 項`;
    if(tasks.length === 0) return tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 font-bold">查無符合條件之工作</td></tr>';
    
    tasks.forEach(t => {
        const escapedName = t['工作名稱'].replace(/'/g, "\\'");
        const status = t['狀態'] || '啟用';
        const isInactive = status === '停用';
        const rowClass = isInactive ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50 transition';
        const nameColor = isInactive ? 'text-slate-500 line-through' : 'text-slate-800';
        const statusTag = isInactive ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">停用</span>' : '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">啟用</span>';

        tbody.innerHTML += `
            <tr class="border-b ${rowClass}">
                <td class="p-3 text-center">${statusTag}</td>
                <td class="p-3 text-slate-500 text-xs font-bold">${t['部門名稱'] || ''}</td>
                <td class="p-3 font-bold ${nameColor}">${t['工作名稱']}</td>
                <td class="p-3 text-blue-700 font-bold">${t['預設類別'] || '無類別'}</td>
                <td class="p-3 flex justify-center gap-2">
                    <button onclick="editTask('${t['工作代碼']}', '${escapedName}', '${t['預設類別']}', '${status}')" class="text-indigo-600 font-bold hover:text-indigo-800 px-3 py-1 bg-white border border-indigo-200 shadow-sm rounded">✏️ 編輯</button>
                    <button onclick="deleteTask('${escapedName}', '${t['部門名稱']}')" class="text-red-500 font-bold hover:text-red-700 px-3 py-1 bg-white border border-red-200 shadow-sm rounded">🗑️ 刪除</button>
                </td>
            </tr>`;
    });
}

function editTask(taskId, name, category, status) {
    document.getElementById('editTaskId').value = taskId;
    document.getElementById('editTaskId').setAttribute('data-oldname', name);
    document.getElementById('newTaskName').value = name;
    document.getElementById('newTaskCat').value = category || '';
    document.getElementById('newTaskStatus').value = status || '啟用';
    document.getElementById('btnSaveTask').innerText = '💾 儲存修改';
    document.getElementById('btnSaveTask').classList.replace('bg-indigo-600', 'bg-teal-600');
    document.getElementById('btnCancelTask').classList.remove('hidden');
}

function resetTaskForm() {
    document.getElementById('editTaskId').value = '';
    document.getElementById('editTaskId').removeAttribute('data-oldname');
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskCat').value = '';
    document.getElementById('newTaskStatus').value = '啟用';
    document.getElementById('btnSaveTask').innerText = '➕ 新增 / 儲存';
    document.getElementById('btnSaveTask').classList.replace('bg-teal-600', 'bg-indigo-600');
    document.getElementById('btnCancelTask').classList.add('hidden');
}

async function saveTask() {
    const taskId = document.getElementById('editTaskId').value;
    const oldName = document.getElementById('editTaskId').getAttribute('data-oldname');
    const taskName = document.getElementById('newTaskName').value.trim();
    const category = document.getElementById('newTaskCat').value.trim();
    const deptInput = document.getElementById('newTaskDept').value;
    const status = document.getElementById('newTaskStatus').value;
    
    if(!taskName) return alert("請輸入工作名稱！");
    if (!taskId) {
        const isExist = appData.tasks.find(t => t['部門名稱'] === deptInput && t['工作名稱'] === taskName);
        if(isExist) return alert("此工作名稱已經存在本部門，請更換名稱。");
    }
    
    await postAction({ action: 'save_task', taskId: taskId || Utilities.getUuid().substring(0,8), oldTaskName: oldName, taskName, category, dept: deptInput, status });
    resetTaskForm(); showTaskMaint();
}

async function deleteTask(name, dept) {
    if(confirm(`確定要完全刪除 [${dept}] 的工作 [${name}] 嗎？\n(若有歷史資料建議改用「停用」)`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: dept }); showTaskMaint();
    }
}

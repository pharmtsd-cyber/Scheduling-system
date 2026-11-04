function showEmployeeMaint() {
    hideAllViews(); 
    document.getElementById('employeeAdminView').classList.remove('hidden');

    if (document.getElementById('empSearchInput')) {
        document.getElementById('empSearchInput').value = '';
    }
    renderEmployeeList();
}

function renderEmployeeList() {
    const tbody = document.getElementById('empTableBody');
    tbody.innerHTML = '';
    
    const deptFilter = document.getElementById('empDeptFilter') ? document.getElementById('empDeptFilter').value : 'ALL';
    const keywordInput = document.getElementById('empSearchInput');
    const keyword = keywordInput ? keywordInput.value.toLowerCase() : '';
    
    let staff = [...appData.staff];

    if (deptFilter !== 'ALL') staff = staff.filter(s => (s['所屬單位'] || '') === deptFilter);
    
    if (keyword) {
        staff = staff.filter(s => 
            s['員工編號'].toLowerCase().includes(keyword) || 
            s['姓名'].toLowerCase().includes(keyword)
        );
    }

    staff.sort((a, b) => String(a['員工編號']).localeCompare(String(b['員工編號'])));
    
    if (document.getElementById('empListCount')) {
        document.getElementById('empListCount').innerText = `共 ${staff.length} 人`;
    }
    
    if(staff.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-bold">查無符合資料</td></tr>';

    staff.forEach(emp => {
        const isResigned = (emp['所屬單位'] === '離職');
        const rowClass = isResigned ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50 transition';
        const nameColor = isResigned ? 'text-slate-500 line-through' : 'text-slate-800';
        
        tbody.innerHTML += `
            <tr class="border-b ${rowClass}">
                <td class="p-3 text-slate-500 font-mono">${emp['員工編號']}</td>
                <td class="p-3 font-bold ${nameColor}">${emp['姓名']}</td>
                <td class="p-3 text-blue-700 font-bold">${emp['所屬組別'] || '<span class="text-slate-400 font-normal">未指派</span>'}</td>
                <td class="p-3 text-center">
                    <button onclick="openQuickEmpEdit('${emp['員工編號']}')" class="text-blue-600 font-bold hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded transition">編輯屬性</button>
                </td>
            </tr>`;
    });
}

function showTaskMaint() {
    hideAllViews(); 
    document.getElementById('taskAdminView').classList.remove('hidden');
    
    const deptSelect = document.getElementById('taskDeptFilter');
    if (deptSelect) {
        deptSelect.innerHTML = '<option value="ALL">全部部門</option>';
        appData.depts.forEach(d => {
            const selected = (d['部門名稱'] === currentDept) ? 'selected' : '';
            deptSelect.innerHTML += `<option value="${d['部門名稱']}" ${selected}>${d['部門名稱']}</option>`;
        });
    }
    
    resetTaskForm(); 
    renderTaskList();
}

function renderTaskList() {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    const deptSelect = document.getElementById('taskDeptFilter');
    const deptFilter = deptSelect ? deptSelect.value : 'ALL';
    
    let tasks = [...appData.tasks];
    if (deptFilter !== 'ALL') tasks = tasks.filter(t => t['部門名稱'] === deptFilter);
    
    tasks.sort((a, b) => a['工作名稱'].localeCompare(b['工作名稱']));
    
    if(tasks.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-bold">查無符合條件之工作</td></tr>';
    
    tasks.forEach(t => {
        const escapedName = t['工作名稱'].replace(/'/g, "\\'");
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-3 text-slate-500 text-xs">${t['部門名稱'] || ''}</td>
                <td class="p-3 font-bold text-slate-700">${t['工作名稱']}</td>
                <td class="p-3 text-blue-700 font-bold">${t['預設類別'] || '常規'}</td>
                <td class="p-3 flex justify-center gap-2">
                    <button onclick="editTask('${t['工作代碼']}', '${escapedName}', '${t['預設類別']}')" class="text-indigo-600 font-bold hover:text-indigo-800 px-2 py-1 bg-indigo-50 rounded">編輯</button>
                    <button onclick="deleteTask('${escapedName}')" class="text-red-500 font-bold hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded">刪除</button>
                </td>
            </tr>`;
    });
}

function editTask(taskId, name, category) {
    document.getElementById('editTaskId').value = taskId;
    document.getElementById('editTaskId').setAttribute('data-oldname', name);
    document.getElementById('newTaskName').value = name;
    document.getElementById('newTaskCat').value = category || '常規';
    document.getElementById('btnSaveTask').innerText = '💾 儲存修改';
    document.getElementById('btnSaveTask').classList.replace('bg-indigo-600', 'bg-teal-600');
    document.getElementById('btnCancelTask').classList.remove('hidden');
}

function resetTaskForm() {
    document.getElementById('editTaskId').value = '';
    document.getElementById('editTaskId').removeAttribute('data-oldname');
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskCat').value = '常規';
    document.getElementById('btnSaveTask').innerText = '➕ 新增 / 儲存';
    document.getElementById('btnSaveTask').classList.replace('bg-teal-600', 'bg-indigo-600');
    document.getElementById('btnCancelTask').classList.add('hidden');
}

async function saveTask() {
    const taskId = document.getElementById('editTaskId').value;
    const oldName = document.getElementById('editTaskId').getAttribute('data-oldname');
    const taskName = document.getElementById('newTaskName').value.trim();
    const category = document.getElementById('newTaskCat').value;
    const deptInput = document.getElementById('taskDeptFilter').value;
    
    if(deptInput === 'ALL') return alert("請先於左方篩選器選擇「特定部門」後，再新增/編輯工作！");
    if(!taskName) return alert("請輸入工作名稱！");
    if (!taskId) {
        const isExist = appData.tasks.find(t => t['部門名稱'] === deptInput && t['工作名稱'] === taskName);
        if(isExist) return alert("此工作名稱已經存在本部門，請更換名稱。");
    }
    
    await postAction({ action: 'save_task', taskId: taskId || Utilities.getUuid().substring(0,8), oldTaskName: oldName, taskName, category, dept: deptInput });
    resetTaskForm(); 
    showTaskMaint();
}

async function deleteTask(name) {
    const deptInput = document.getElementById('taskDeptFilter').value;
    if(deptInput === 'ALL') return alert("請先選擇特定部門再進行刪除");
    if(confirm(`確定要刪除 [${deptInput}] 的工作 [${name}] 嗎？`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: deptInput }); 
        showTaskMaint();
    }
}

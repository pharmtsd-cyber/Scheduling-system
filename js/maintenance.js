function showEmployeeMaint() {
    hideAllViews(); 
    document.getElementById('employeeAdminView').classList.remove('hidden');
    document.getElementById('empSearchInput').value = '';
    renderEmployeeList();
}

function renderEmployeeList() {
    const tbody = document.getElementById('empTableBody');
    tbody.innerHTML = '';
    const keyword = document.getElementById('empSearchInput').value.toLowerCase();
    
    // 預設依員工編號排序
    let staff = [...appData.staff].sort((a, b) => a['員工編號'].localeCompare(b['員工編號']));
    
    // 模糊搜尋
    if (keyword) {
        staff = staff.filter(s => 
            s['員工編號'].toLowerCase().includes(keyword) || 
            s['姓名'].toLowerCase().includes(keyword) || 
            (s['所屬組別'] || '').toLowerCase().includes(keyword)
        );
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
                <td class="p-3">
                    <button onclick="openQuickEmpEdit('${emp['員工編號']}')" class="text-blue-600 font-bold hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded transition">編輯屬性</button>
                </td>
            </tr>`;
    });
}

function showTaskMaint() {
    hideAllViews(); 
    document.getElementById('taskAdminView').classList.remove('hidden');
    resetTaskForm();
    renderTaskList();
}

function renderTaskList() {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    const keyword = document.getElementById('taskSearchInput').value.toLowerCase();
    const filter = document.getElementById('taskCatFilter').value;
    
    let tasks = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']);
    
    // 名稱排序
    tasks.sort((a, b) => a['工作名稱'].localeCompare(b['工作名稱']));
    
    if (keyword) tasks = tasks.filter(t => t['工作名稱'].toLowerCase().includes(keyword));
    if (filter !== 'ALL') tasks = tasks.filter(t => (t['預設類別'] || '').includes(filter));
    
    if(tasks.length === 0) return tbody.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-slate-400 font-bold">查無資料，請確認篩選條件。</td></tr>';
    
    tasks.forEach(t => {
        // 利用引號處理特殊字元
        const escapedName = t['工作名稱'].replace(/'/g, "\\'");
        
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-3 font-bold text-slate-700">${t['工作名稱']}</td>
                <td class="p-3 text-blue-700 font-bold">${t['預設類別']}</td>
                <td class="p-3 flex gap-2">
                    <button onclick="editTask('${t['工作代碼']}', '${escapedName}', '${t['預設類別']}')" class="text-indigo-600 font-bold hover:text-indigo-800 px-2 py-1 bg-indigo-50 rounded">編輯</button>
                    <button onclick="deleteTask('${escapedName}')" class="text-red-500 font-bold hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded">刪除</button>
                </td>
            </tr>`;
    });
}

function editTask(taskId, name, category) {
    document.getElementById('editTaskId').value = taskId;
    
    // 偷偷藏一個舊名稱，為了讓 GAS 更新時不依賴易變動的 name (如果是舊版沒 ID 的情況)
    document.getElementById('editTaskId').setAttribute('data-oldname', name);
    
    document.getElementById('newTaskName').value = name;
    document.getElementById('newTaskCat').value = category;
    
    document.getElementById('btnSaveTask').innerText = '💾 儲存修改';
    document.getElementById('btnSaveTask').classList.replace('bg-blue-600', 'bg-indigo-600');
    document.getElementById('btnCancelTask').classList.remove('hidden');
}

function resetTaskForm() {
    document.getElementById('editTaskId').value = '';
    document.getElementById('editTaskId').removeAttribute('data-oldname');
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskCat').value = '工作日(常規)';
    document.getElementById('btnSaveTask').innerText = '➕ 新增';
    document.getElementById('btnSaveTask').classList.replace('bg-indigo-600', 'bg-blue-600');
    document.getElementById('btnCancelTask').classList.add('hidden');
}

async function saveTask() {
    const taskId = document.getElementById('editTaskId').value;
    const oldName = document.getElementById('editTaskId').getAttribute('data-oldname');
    const nameInput = document.getElementById('newTaskName');
    const catInput = document.getElementById('newTaskCat');
    const taskName = nameInput.value.trim();
    const category = catInput.value;
    
    if(!currentDept) return alert("請先於左側選單點擊您要管理的部門！");
    if(!taskName) return alert("請輸入工作名稱！");
    
    // 防呆：如果是新增，檢查是否重複
    if (!taskId) {
        const isExist = appData.tasks.find(t => t['部門名稱'] === currentDept && t['工作名稱'] === taskName);
        if(isExist) return alert("此工作名稱已經存在，請更換名稱。");
    }
    
    await postAction({ 
        action: 'save_task', 
        taskId: taskId || Utilities.getUuid().substring(0,8),
        oldTaskName: oldName,
        taskName: taskName, 
        category: category, 
        dept: currentDept 
    });
    
    resetTaskForm();
    showTaskMaint();
}

async function deleteTask(name) {
    if(confirm(`確定要刪除工作 [${name}] 嗎？`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: currentDept });
        showTaskMaint();
    }
}

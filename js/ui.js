function showToast(msg = "已儲存") {
    const toast = document.getElementById('statusToast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}

function hideAllViews() {
    // ★ 移除了 holidayAdminView，並加入 el 安全判斷避免找不到元素時當機
    ['welcomeMsg', 'publicView', 'adminView', 'employeeAdminView', 'taskAdminView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function renderPublicSidebar() {
    const list = document.getElementById('publicDeptList');
    list.innerHTML = '';
    appData.depts.forEach(d => list.innerHTML += `<li class="cursor-pointer p-2 hover:bg-slate-700 rounded transition font-bold" onclick="openPublicDept('${d['部門名稱']}')">🏥 ${d['部門名稱']}</li>`);
}

// ==========================================
// 🔍 全域人員模糊搜尋器邏輯
// ==========================================
let staffPickerCallback = null;
let staffPickerContextDept = null;

function openStaffPicker(currentEmpId, contextDept, callback) {
    staffPickerCallback = callback;
    staffPickerContextDept = contextDept;
    document.getElementById('staffPickerSearch').value = '';
    document.getElementById('staffPickerModal').classList.remove('hidden');
    renderStaffPickerList();
    setTimeout(() => document.getElementById('staffPickerSearch').focus(), 100);
}

function closeStaffPicker() {
    document.getElementById('staffPickerModal').classList.add('hidden');
}

function filterStaffPicker() { renderStaffPickerList(); }

function renderStaffPickerList() {
    const query = document.getElementById('staffPickerSearch').value.toLowerCase();
    const list = document.getElementById('staffPickerList');
    let html = '';
    
    if (!query || "未指派".includes(query)) {
        html += `<li onclick="selectStaffPicker('')" class="cursor-pointer p-2 rounded bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold border border-orange-200 mb-2 shadow-sm flex items-center gap-2">
            ⚠️ 設為待指派 (留空)
        </li>`;
    }

    let staffArr = [...appData.staff].filter(s => s['員工編號'] && !s['員工編號'].startsWith('SYS_') && s['所屬單位'] !== '離職');
    
    if (query) {
        staffArr = staffArr.filter(s => (s['姓名']||'').toLowerCase().includes(query) || (s['員工編號']||'').toLowerCase().includes(query) || (s['所屬組別']||'').toLowerCase().includes(query));
    }
    
    staffArr.sort((a, b) => {
        const aIsDept = a['所屬組別'] === staffPickerContextDept;
        const bIsDept = b['所屬組別'] === staffPickerContextDept;
        if(aIsDept && !bIsDept) return -1;
        if(!aIsDept && bIsDept) return 1;
        return 0;
    });

    if (staffArr.length === 0) {
        html += `<div class="text-center text-slate-400 text-sm mt-4 font-bold">找不到相符的人員</div>`;
    } else {
        staffArr.forEach(s => {
            const isDept = s['所屬組別'] === staffPickerContextDept;
            const tag = isDept ? `<span class="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shadow-sm">本單位</span>` : `<span class="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">${s['所屬組別']||'外援'}</span>`;
            html += `<li onclick="selectStaffPicker('${s['員工編號']}')" class="cursor-pointer p-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 flex justify-between items-center transition mb-1">
                <span class="font-bold text-slate-700">${s['姓名']}</span> ${tag}
            </li>`;
        });
    }
    list.innerHTML = html;
}

function selectStaffPicker(empId) {
    if(staffPickerCallback) staffPickerCallback(empId);
    closeStaffPicker();
}

function getEmpNameWithDefault(empId, defaultTxt) {
    if(!empId) return defaultTxt;
    const emp = appData.staff.find(e => e['員工編號'] === empId);
    return emp ? emp['姓名'] : empId;
}

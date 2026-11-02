let currentAdminDept = null;

function openAdminDept(deptName) {
    currentAdminDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `[管理模式] ${deptName}`;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('interactiveDate').value = today;
    document.getElementById('previewMonth').value = today.substring(0, 7);
    
    renderInteractiveGrid();
}

async function copyMonthSchedule() {
    const sourceMonth = document.getElementById('previewMonth').value;
    const targetMonth = document.getElementById('targetMonth').value;
    if(!sourceMonth || !targetMonth) return alert("請確認瀏覽月份與目標月份皆已選擇！");
    
    if(confirm(`確定將 ${sourceMonth} 的排班結構完全承襲至 ${targetMonth} 嗎？`)) {
        const res = await postAction({
            action: 'copy_month_template', sourceMonth, targetMonth, deptName: currentAdminDept
        });
        alert(`成功套用 ${res.copied} 筆排班資料！畫面將重新載入。`);
        location.reload();
    }
}

// === 核心：在圖像上渲染下拉選單 ===
function renderInteractiveGrid() {
    const container = document.getElementById('interactiveGrid');
    container.innerHTML = '';
    const date = document.getElementById('interactiveDate').value;
    
    // 取出該部門今日所有班表
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentAdminDept && s['日期'] === date);
    
    // 篩選出該部門的員工清單 (依據欄位 I: 所屬組別)
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentAdminDept);
    
    // 建立時間軸標尺 (08:00 - 22:00)
    let rulerHtml = '<div class="flex text-xs text-slate-400 mb-2">';
    for(let i=8; i<=22; i++) rulerHtml += `<div class="flex-1 border-l pl-1">${i}:00</div>`;
    rulerHtml += '</div>';
    container.innerHTML += rulerHtml;

    shifts.forEach(shift => {
        // 計算 left 與 width 百分比 (總共 14 小時 = 100%)
        const [sh, sm] = shift['開始時間'].split(':').map(Number);
        const [eh, em] = shift['結束時間'].split(':').map(Number);
        const startPercent = ((sh - 8) + sm/60) / 14 * 100;
        const widthPercent = ((eh - sh) + (em - sm)/60) / 14 * 100;

        // 建立選單 HTML
        let options = '<option value="">--待指派--</option>';
        deptStaff.forEach(emp => {
            const selected = emp['員工編號'] === shift['員工編號'] ? 'selected' : '';
            options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']}</option>`;
        });

        // 繪製包含選單與備註的動態區塊
        const blockHtml = `
            <div class="timeline-container">
                <div class="timeline-block" style="left: ${startPercent}%; width: ${widthPercent}%;">
                    <div class="font-bold text-blue-900 border-b border-blue-300 pb-1 flex justify-between">
                        <span>${shift['工作名稱']}</span>
                        <span class="text-[10px]">${shift['開始時間']} - ${shift['結束時間']}</span>
                    </div>
                    <!-- 直接在圖上選擇人員 -->
                    <select onchange="updateShiftInline('${shift['排班ID']}', this.value, null)">
                        ${options}
                    </select>
                    <!-- 直接在圖上填寫備註 -->
                    <input type="text" placeholder="備註..." value="${shift['備註'] || ''}" 
                           onblur="updateShiftInline('${shift['排班ID']}', null, this.value)">
                </div>
            </div>
        `;
        container.innerHTML += blockHtml;
    });

    if(shifts.length === 0) container.innerHTML += '<div class="text-center text-slate-400 py-6">該日尚無排班資料</div>';
}

// 觸發更新至後端
async function updateShiftInline(shiftId, empId, remark) {
    // 找出舊資料
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(!shift) return;
    
    if(empId !== null) shift['員工編號'] = empId;
    if(remark !== null) shift['備註'] = remark;

    // 非同步寫入 GAS，畫面不需重整，感覺像原生 APP
    await postAction({
        action: 'update_shift_inline',
        shiftId: shiftId,
        empId: shift['員工編號'],
        remark: shift['備註']
    });
    // 可加入微小的 Toast 提示「儲存成功」
}

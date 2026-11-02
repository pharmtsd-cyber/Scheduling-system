google.charts.load('current', {'packages':['timeline']});
google.charts.setOnLoadCallback(async () => {
    await reloadData();
    
    // 檢查 Session 保持登入狀態
    const savedId = sessionStorage.getItem('loggedInUser');
    if(savedId) {
        document.getElementById('loginId').value = savedId;
        login();
    }
});

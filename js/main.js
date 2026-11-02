google.charts.load('current', {'packages':['timeline']});
google.charts.setOnLoadCallback(async () => {
    await fetchAllData();
});

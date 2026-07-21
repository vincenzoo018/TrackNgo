// Admin specific JS
function toggleRole(roleId) {
    console.log("Toggled role:", roleId);
}

function generateReport(reportType) {
    showToast('Generating ' + reportType + ' report...', 'info');
    setTimeout(() => {
        showToast('Report generated successfully! (Demo)', 'success');
    }, 1500);
}

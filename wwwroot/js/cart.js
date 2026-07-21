// Cart (Compliance Officer) specific JS
function resolveEscalation(docId) {
    showToast('Resolving escalation for ' + docId + '...', 'info');
    setTimeout(() => {
        showToast('Escalation Resolved', 'success');
    }, 1000);
}

function sendSmsReminder() {
    showToast('Dispatching SMS Gateway...', 'info');
    setTimeout(() => {
        showToast('SMS Notification Sent', 'success');
    }, 1500);
}
